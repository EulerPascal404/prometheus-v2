from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import Dict, Optional
import os
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
import PyPDF2
import tempfile
import base64
from o1_pdf_filler import run
from sentence_transformers import SentenceTransformer
import numpy as np
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

app = Flask(__name__)

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",
            "https://localhost:3000",
            "https://getprometheus.ai",
            "https://*.getprometheus.ai",
            os.getenv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

# Add a test route to verify API is working
@app.route("/api/test", methods=["GET"])
def test_route():
    return jsonify({
        "status": "success",
        "message": "Flask API is working correctly!",
        "version": "1.0.0"
    })

# Supabase setup with better error handling
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # Changed to use service role key

if not supabase_url or not supabase_key:
    logger.error("Missing required environment variables")
    raise ValueError(
        "Missing required environment variables. Please check .env.local for:"
        "\n- NEXT_PUBLIC_SUPABASE_URL"
        "\n- SUPABASE_SERVICE_ROLE_KEY"  # Updated error message
    )

def get_supabase() -> Client:
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Error creating Supabase client: {str(e)}")
        return None

# Setup OpenAI
def process_pdf_content(file_content: bytes, doc_type: str, user_id: str, supabase: Client) -> dict:
    try:
        # Save the PDF content to a temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        # Extract text using PyPDF2
        text_content = []
        with open(tmp_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)
            
            # Update status to show page processing progress
            for page_num, page in enumerate(pdf_reader.pages):
                # Update processing status with page progress
                progress_status = f"processing_{doc_type}_page_{page_num+1}_of_{total_pages}"
                supabase.table("user_documents").update({
                    "processing_status": progress_status
                }).eq("user_id", user_id).execute()
                
                try:
                    text = page.extract_text()
                    # Ensure text is a string and not empty
                    if isinstance(text, str) and text.strip():
                        text_content.append(text)
                    elif isinstance(text, list):
                        # If text is a list, join it with spaces
                        text = ' '.join(str(item) for item in text if item)
                        if text.strip():
                            text_content.append(text)
                except Exception as e:
                    print(f"Error extracting text from page {page_num + 1}: {str(e)}")
                    continue

        # Clean up temporary file
        os.unlink(tmp_path)

        print("RUNNING RAG GENERATION")

        # Join all text content and ensure it's a string
        full_text = "\n".join(text_content) if text_content else ""
        print("Extracted text:", full_text[:10] if full_text else "No text extracted")  # Print first 10 chars for debugging

        # Update status to show we're running RAG generation
        supabase.table("user_documents").update({
            "processing_status": f"processing_{doc_type}_analysis"
        }).eq("user_id", user_id).execute()
        
        # Pass context information to run function for progress tracking
        pdf_pages = run(full_text, doc_type=doc_type, user_id=user_id, supabase=supabase)

        # Get OpenAI API key from environment variable
        openai_api_key = os.environ.get("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("Missing OPENAI_API_KEY environment variable")
            
        client = OpenAI(api_key=openai_api_key)

        # Generate summary using OpenAI
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional o1 document reviewer. Review the following documents and specifically list the strengths and weaknesses of the applicants resources in creating a successful o1 application. Additionally, provide a list of recommendations for the applicant to improve their application. Format the output as follows: Strengths: [list of strengths], Weaknesses: [list of weaknesses], Recommendations: [list of recommendations]. Make sure to separate each point with a [SEP] separator. Refer to the applicant as 'you'."},
                {"role": "user", "content": full_text}
            ]
        )

        return {
            "summary": response.choices[0].message.content,
            "pages": total_pages,
            "pdf_filled_pages": pdf_pages,
            "processed": True,
            "text_preview": full_text[:1000],  # Include first 1000 chars of text for verification
        }
    except Exception as e:
        print(f"Error processing PDF: {str(e)}")
        return {
            "summary": "Error processing document",
            "error": str(e),
            "processed": False
        }

@app.route("/api/validate-documents", methods=["GET", "POST"])
def validate_documents():
    logger.info(f"Received {request.method} request to /api/validate-documents")
    logger.info(f"Request headers: {dict(request.headers)}")
    logger.info(f"Request args: {dict(request.args)}")
    
    if request.method == "GET":
        user_id = request.args.get("user_id")
        logger.info(f"GET request - user_id: {user_id}")
        
        if not user_id:
            logger.warning("GET request missing user_id parameter")
            return jsonify({
                "status": "error",
                "message": "user_id is required as a query parameter",
                "example": "/api/validate-documents?user_id=your-user-id-here"
            }), 400
        
        try:
            supabase = get_supabase()
            if not supabase:
                logger.error("Failed to connect to Supabase")
                return jsonify({
                    "status": "error",
                    "message": "Could not connect to database"
                }), 500

            # Try to get existing document
            logger.info(f"Fetching documents for user: {user_id}")
            response = supabase.table("user_documents").select("*").eq("user_id", user_id).execute()
            
            # If no document exists, create one
            if not response.data:
                logger.info(f"Creating new document record for user: {user_id}")
                insert_response = supabase.table("user_documents").insert({
                    "user_id": user_id,
                    "processing_status": "pending",
                    "completion_score": 0,
                    "resume": False,
                    "recommendations": False,
                    "awards": False,
                    "publications": False,
                    "salary": False,
                    "memberships": False
                }).execute()
                
                return jsonify({
                    "status": "initialized",
                    "completion_score": 0,
                    "can_proceed": False,
                    "message": "Document record created"
                })
                
            user_docs = response.data[0]
            logger.info(f"Successfully retrieved documents for user: {user_id}")
            return jsonify({
                "status": "success",
                "completion_score": user_docs.get("completion_score", 0),
                "can_proceed": bool(user_docs.get("resume")),
                "documents": user_docs
            })
            
        except Exception as e:
            logger.error(f"Error processing GET request: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Error checking validation status: {str(e)}"
            }), 500

    # Handle POST request
    logger.info("Processing POST request")
    try:
        request_data = request.get_json()
        logger.info(f"POST request data: {request_data}")
        
        user_id = request_data.get("user_id")
        uploaded_documents = request_data.get("uploaded_documents", {})
        
        if not user_id or not uploaded_documents:
            logger.warning("POST request missing required fields")
            return jsonify({
                "status": "error",
                "message": "Missing required fields: user_id and uploaded_documents"
            }), 400

        logger.info(f"Processing documents for user: {user_id}")
        logger.info(f"Uploaded documents: {uploaded_documents}")
        
        # Get documents from Supabase
        supabase = get_supabase()
        if not supabase:
            return jsonify({
                "status": "error",
                "message": "Could not connect to database"
            }), 500

        # Check if documents are already being processed
        try:
            response = supabase.table("user_documents").select("processing_status, last_validated").eq("user_id", user_id).single().execute()
            
            # Check if documents are already being processed
            if response.data and response.data.get("processing_status") in ["pending", "processing_resume", "processing_publications", "processing_awards"]:
                # Check if the processing has been running for too long (more than 10 minutes)
                last_validated = response.data.get("last_validated")
                if last_validated:
                    try:
                        from datetime import datetime, timedelta
                        last_validated_time = datetime.fromisoformat(last_validated.replace('Z', '+00:00'))
                        time_diff = datetime.now(last_validated_time.tzinfo) - last_validated_time
                        
                        # If processing has been running for more than 10 minutes, reset it
                        if time_diff > timedelta(minutes=10):
                            logger.info(f"Processing timeout detected for user {user_id}, resetting status")
                            supabase.table("user_documents").update({
                                "processing_status": "pending",
                                "last_validated": "now()"
                            }).eq("user_id", user_id).execute()
                        else:
                            return jsonify({
                                "status": "error",
                                "message": "Documents are already being processed. Please wait."
                            }), 409
                    except Exception as time_error:
                        logger.error(f"Error checking processing time: {str(time_error)}")
                        # Continue with processing if we can't check time
            elif response.data and response.data.get("processing_status") == "completed":
                # If processing is already completed, return the existing results
                return jsonify({
                    "status": "success",
                    "completion_score": response.data.get("completion_score", 0),
                    "message": "Documents were already processed.",
                    "can_proceed": True,
                    "document_summaries": response.data.get("document_summaries", {})
                })
        except Exception as e:
            logger.error(f"Error checking processing status: {str(e)}")
            # Continue with processing if we can't check status

        # First update to "pending" status
        try:
            supabase.table("user_documents").update({
                "processing_status": "pending",
                "last_validated": "now()"
            }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.error(f"Error updating status to pending: {str(e)}")
            # Continue with processing even if status update fails
        
        document_summaries = {}
        
        for doc_type in uploaded_documents:
            if uploaded_documents[doc_type]:
                try:
                    # Update processing status to current document
                    try:
                        supabase.table("user_documents").update({
                            "processing_status": f"processing_{doc_type}"
                        }).eq("user_id", user_id).execute()
                    except Exception as e:
                        logger.error(f"Error updating status for {doc_type}: {str(e)}")
                    
                    # Get the file from storage
                    try:
                        file_response = supabase.storage.from_('documents').download(
                            f"{user_id}/{doc_type}.pdf"
                        )
                    except Exception as e:
                        logger.error(f"Error downloading file for {doc_type}: {str(e)}")
                        document_summaries[doc_type] = {
                            "error": f"Failed to download file: {str(e)}",
                            "processed": False
                        }
                        continue
                    
                    if file_response:
                        # Process the PDF content with page-by-page updates
                        summary = process_pdf_content(file_response, doc_type, user_id, supabase)
                        document_summaries[doc_type] = summary
                
                except Exception as e:
                    logger.error(f"Error processing {doc_type}: {str(e)}")
                    document_summaries[doc_type] = {
                        "error": str(e),
                        "processed": False
                    }
                    # Update status to error for this document
                    try:
                        supabase.table("user_documents").update({
                            "processing_status": f"error_{doc_type}"
                        }).eq("user_id", user_id).execute()
                    except Exception as update_error:
                        logger.error(f"Error updating error status for {doc_type}: {str(update_error)}")

        # Create update data
        update_data = {
            "processing_status": "completed",
            "document_summaries": document_summaries
        }

        try:
            if not response.data:
                # Create new record
                insert_data = {
                    "user_id": user_id,
                    "processing_status": "completed",
                    "completion_score": 0,
                    **uploaded_documents,
                    "document_summaries": document_summaries
                }
                
                insert_response = supabase.table("user_documents").insert(insert_data).execute()
                user_docs = insert_response.data[0]
            else:
                user_docs = response.data[0]
                # Update existing record
                supabase.table("user_documents").update(update_data).eq("user_id", user_id).execute()

            # Calculate completion score
            optional_docs = ["recommendations", "awards", "publications", "salary", "memberships"]
            uploaded_optional = sum(1 for doc in optional_docs if user_docs.get(doc))
            completion_score = (uploaded_optional / len(optional_docs)) * 100
            
            # Final update with completion score
            supabase.table("user_documents").update({
                "completion_score": completion_score,
                "last_validated": "now()"
            }).eq("user_id", user_id).execute()
            
            return jsonify({
                "status": "success",
                "completion_score": completion_score,
                "message": f"Documents validated successfully. Your profile is {completion_score}% complete.",
                "can_proceed": True,
                "document_summaries": document_summaries
            })
        except Exception as e:
            logger.error(f"Error updating database: {str(e)}")
            # Even if database update fails, return the processed summaries
            return jsonify({
                "status": "partial",
                "message": f"Documents processed but database update failed: {str(e)}",
                "can_proceed": True,
                "document_summaries": document_summaries
            })
        
    except Exception as e:
        logger.error(f"Error processing documents: {str(e)}")
        # Update status to error if we have a user_id
        if user_id:
            try:
                supabase = get_supabase()
                if supabase:
                    supabase.table("user_documents").update({
                        "processing_status": "error"
                    }).eq("user_id", user_id).execute()
            except Exception as update_error:
                logger.error(f"Error updating status to error: {str(update_error)}")
        
        return jsonify({
            "status": "error",
            "message": f"Error processing documents: {str(e)}"
        }), 500

@app.route("/api/document-status/<user_id>", methods=["GET"])
def get_document_status(user_id):
    try:
        supabase = get_supabase()
        if not supabase:
            return jsonify({
                "status": "error",
                "message": "Could not connect to database"
            }), 500

        response = supabase.table("user_documents").select("*").eq("user_id", user_id).single().execute()
        
        if not response.data:
            return jsonify({
                "status": "not_found",
                "completion_score": 0,
                "can_proceed": False
            })
            
        return jsonify({
            "status": response.data.get("processing_status", "pending"),
            "completion_score": response.data.get("completion_score", 0),
            "can_proceed": bool(response.data.get("resume"))
        })
        
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error checking document status: {str(e)}"
        }), 500

# Add the lawyer database
LAWYER_DB = [
    {
        "Name": "Robert K. D'Andrea",
        "Firm": "D'Andrea Law Corporation",
        "Law School": "Oklahoma City University, School of Law",
        "Bar Admissions": "District of Columbia",
        "Description": """
        D'Andrea Law Corporation is a Southern California immigration law firm with offices located in Pasadena and Glendora. We are committed to providing superior legal services with the experience and effectiveness of a large firm, while retaining the thoroughness and personal interaction of a boutique. Our clientele includes businesses, investors, families and individuals from all over the world.

        Our high rate of success is a result of extensive case experience, dedicated work ethic, exceptional problem solving capabilities, and authoritative contacts. We find immigration solutions where other law offices have failed.

        Robert K. D'Andrea has experience in all aspects of business, investment, employment, family and related immigration matters. Mr. D'Andrea has successfully represented thousands of employers, employees, investors, families, and other immigrant and nonimmigrant foreign nationals across the globe. He has counseled corporate clients in the health care, science, entertainment, technology, investment, communication, import/export, education, athletic, fine art, and manufacturing industries.
        """,
        "Address" : "510 S. Grand Ave Suite 203 Glendora, CA 91741 USA",
    },
    {
        "Name": "Joseph Tsang",
        "Firm": "Tsang & Associates, PLC",
        "Law School": "Pepperdine University, Caruso School of Law",
        "Bar Admissions": "California",
        "Description": """
        At Tsang & Associates, we represent individuals and companies in their immigration, family, and business legal needs.

        Our mission is to provide both breadth of services and depth of expertise with efficiency and professionalism.

        With offices in Los Angeles, Taipei, and Shanghai, our team has been helping clients internationally since 1985.

        As a family-owned international law firm, our home is your home. Just like family, we're constantly striving to provide you with the best legal experience. We focus on transparency and individual communication to provide you with peace of mind at every stage.
        """,
        "Address" : "18830 Norwalk Blvd Artesia, CA 90701 USA",
    },
    {
        "Name" : "Martin F. Breznick",
        "Firm" : "Breznick & Cavallo, P.C.",
        "Law School" : "Western New England University Law School",
        "Bar Admissions" : "New Jersey",
        "Description" : """
        My firm provides individualized service to clients.  You will always be able to speak with an attorney - either myself or my partner, John Cavallo (who speaks Spanish and Italian).  I have been practicing immigration law since 1977 and have a great deal of experience with the many minefields presented by the practice of immigration and nationality law.  It is important to have someone who is experienced with issues presented by U.S. Citizenship and Immigration Services, the U.S. Department of Labor, the U.S. Department of State, U.S. Immigration and Customs Enforcement and the Immigration Court.  We can provide you with that experience and represent you on matters involving family members, businesses, non-immigrant visas, and removal proceedings.  
        """,
        "Address" : "Breznick & Cavallo, P.C. 630 9th Avenue Suite 405 New York, NY 10036 USA",
    },
    {
        "Name" : "Patrick Hatch",
        "Firm" : "Hatch Rockers Immigration",
        "Law School" : "Benjamin N. Cardozo School of Law",
        "Bar Admissions" : "New York",
        "Description" : """
        Hatch Rockers Immigration is a full service United States immigration law firm. Our office provides expert counsel and representation for many types of immigration cases.  Our office has expertise in a full-range of immigration topics, including employment-based, family-based, asylum, and removal defense.  Our clients benefit from our broad knowledge set as we can develop individual, creative strategies for each client's unique situation. 

        At Hatch Rockers, we work closely with each client to make an otherwise intimidating process smooth and worry-free.  Clients work directly with our attorneys.  Mr. Hatch advocates for each client based on his clear commitment to defend immigrants' rights ethically and justly.
        """,
        "Address" : "4909 Waters Edge Drive Suite 218 Raleigh, NC 27606 USA",
    },
    {
        "Name" : "Geri N. Khan",
        "Firm" : "Law Office of Geri N. Khan",
        "Law School" : "University of San Francisco School of Law",
        "Bar Admissions" : "California",
        "Description" : """
        Hi and welcome. Should you wish to know more than what is contained here, you may also wish to check my website: www.gerinkahn.com. zzzzz 

        I practice both Immigration and Nationality Law and Social Security Disability law.

        As to the immigration field, I represent people in removal (deportation) proceedings.  I also assist small businesses in obtaining professional visas such as H-1Bs or L-1s for their employees.  I represent applicants for political asylum, and religious workers and individuals at all stages of the naturalization process.  Finally, I help people who wish to bring their family members to the United States.

        In the Social Security field, I represent disabled individuals at administrative hearings and in federal court.      

        In both areas I have taken cases to the federal court and up through the 9th Circuit Court of Appeals.
        """,
        "Address" : "940 Adams Street Suite 1 Benicia, CA 94510 USA"
    },
    {
        "Name" : "Christopher M. Ingram",
        "Firm" : "Law Offices of Chris M. Ingram",
        "Law School" : "De Montfort University",
        "Bar Admissions" : "New York",
        "Description" : """
        US Immigration Help: Hi – my name is Chris M. Ingram from Northampton, England, now based in Santa Monica, Los Angeles, California. We specialize in O1 Visa and EB1 Green Cards for aliens of Extraordinary Ability and also E2 business purchase and set up investor visas. We provide free initial consultations to help you discover which immigration option is best for you, so  you can relax and put your credit card away while you receive some honest and free US immigration information.  (I've also written over 1200 free web pages www.breakthroughusa.co.uk outlining various visas for your kind perusal).
        """,
        "Address" : "1947 Camino Vida Roble Suite 202 Carlsbad, CA 92008 USA",
    },
    {
        "Name" : "Sassoun A. Nalbandian",
        "Firm" : "Nalbandian Law APC",
        "Law School" : "University of Southern California, Gould School of Law",
        "Bar Admissions" : "California",
        "Description" : """I have specialized exclusively in immigration law since I started my firm in 2002. I have won many complex immigration cases, including asylum, business, family, and criminal removal cases. We have a dedicated staff of 4 paralegals and several attorneys. We are ready to help solve all immigration problems and have won a very high percentage of our cases during the course of over a decade of practice.""",
        "Address" : "400 N Brand Blvd Suite 910 Glendale, CA 91203 USA",
    },
    {
        "Name" : "Shah I. Nawaaz Peerally",
        "Firm" : "Shah Peerally Law Group PC",
        "Law School" : "New College of California School of Law",
        "Bar Admissions" : "California",
        "Description" : """
        The Shah Peerally Law Group is a leading full-service US immigration law firm headquartered in Newark, California, in the heart of the San Francisco Bay Area, serving clients nationwide. The law firm is led by  Shah Peerally, Esq. Based on experience, professional achievements, and industry recognition, we have been rated as "superb" by the Avvo national attorney rating service, which is the highest rating class available.   

        We have assisted several skilled workers placed at Fortune 500 companies in obtaining work visas (H-1B visas), and multinational corporations bringing in intra-company transferees (L-1 visas). We are also skilled in labor certifications (PERM) and employment based green card petitions. As part of our services to employers, we advise on matters including I-9 compliance and DOL audits. We also help individuals, including political asylum seekers in removal proceedings, family-based green card applicants, and those seeking inadmissibility waivers. These are only a few of the services that we offer. Our staff is also multilingual, with members who speak French, Hindi, Urdu, Punjabi. and Arabic. 

        If you are seeking legal representation or advice: We recommend that you call our office at 510-742-5887 to set up a consultation. 

        If you are not sure you need a consultation: Send us an email, and we may review your query to see if we may help you. We also recommend that you explore our website. We provide a general overview of various types of visas and legal services in articles linked to the menu items at the bottom of this main page. We also write articles on an ongoing basis about more specific immigration topics. You can find our articles on the menu bar under "Media & Publications." You may also tune into our radio show, the Shah Peerally Law Show, every Tuesday on AM 1170 KLOK from 11AM to noon, where we take live calls, discuss various immigration topics, and provide news on immigration. Finally, to stay up to date on immigration developments, from immigration reform to changes in filing fees, you may subscribe to our free newsletter. 
        """,
        "Address" : "Shah Peerally Law Group PC 37600 Central Ct Ste 202C Newark, CA 94560 USA",
    },
    {
        "Name" : "Christian Smith",
        "Firm" : "Christian Schmidt, Esq",
        "Law School" : "Golden Gate University School of Law",
        "Bar Admissions" : "Louisiana",
        "Description" : """
        Full Service Immigration Law Firm: All working visa categories (H, J, L, M, F, O, P); Investment/Trade Visa (E, EB-5); Labor Certification (PERM) and EB-1; Permanent Residence (Green Card), Family immigration (K, N-600, Spouses, Children, Parents, Brothers and Sisters); Naturalization
        """,
        "Address" : "PO Box 615 Hopland, CA 95449 USA"
    }

]

# Initialize the embedding model
model = SentenceTransformer('all-MiniLM-L6-v2')

# Pre-compute lawyer embeddings
lawyer_embeddings = []
for lawyer in LAWYER_DB:
    lawyer_text = f"{lawyer['Description']} {lawyer['Law School']} {lawyer['Bar Admissions']} {lawyer['Firm']} {lawyer['Name']}"
    embedding = model.encode(lawyer_text)
    lawyer_embeddings.append(embedding)
lawyer_embeddings = np.array(lawyer_embeddings)

@app.route("/api/match-lawyer", methods=["POST"])
def match_lawyer():
    try:
        request_data = request.get_json()
        user_id = request_data.get("user_id")
        uploaded_documents = request_data.get("uploaded_documents", {})
        document_summaries = request_data.get("document_summaries", {})
        additional_info = request_data.get("additional_info", {})

        if not all([user_id, uploaded_documents, document_summaries, additional_info]):
            return jsonify({
                "status": "error",
                "message": "Missing required fields"
            }), 400

        # Get all summaries from the document summaries
        all_summaries = []
        for doc_type, doc_info in document_summaries.items():
            if isinstance(doc_info, dict) and 'summary' in doc_info:
                all_summaries.append(doc_info['summary'])
        
        # Add additional information to the text being analyzed
        additional_text = f"\nClient Address: {additional_info.get('address', '')}\nAdditional Comments: {additional_info.get('additional_comments', '')}"
        all_summaries.append(additional_text)
        
        if not all_summaries:
            return jsonify({
                "status": "error",
                "message": "No document summaries provided"
            }), 400

        # Create embedding for the combined summaries
        user_text = " ".join(all_summaries)
        user_embedding = model.encode(user_text)

        # Calculate cosine similarity with all lawyers
        similarities = np.dot(lawyer_embeddings, user_embedding) / (
            np.linalg.norm(lawyer_embeddings, axis=1) * np.linalg.norm(user_embedding)
        )

        # Find the best match
        best_match_idx = np.argmax(similarities)
        best_match = LAWYER_DB[best_match_idx]
        match_score = float(similarities[best_match_idx])

        return jsonify({
            "name": best_match["Name"],
            "firm": best_match["Firm"],
            "law_school": best_match["Law School"],
            "bar_admissions": best_match["Bar Admissions"],
            "description": best_match["Description"],
            "address": best_match["Address"],
            "match_score": match_score
        })

    except Exception as e:
        print(f"Error in lawyer matching: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Error matching lawyer: {str(e)}"
        }), 500

# Run the Flask app if this file is executed directly (development mode)
if __name__ == "__main__":
    print("Running Flask server in development mode on http://localhost:8000")
    app.run(host="0.0.0.0", port=8000, debug=True)

# Handler for serverless function
from werkzeug.middleware.proxy_fix import ProxyFix

# Apply ProxyFix to handle proxy headers correctly
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

# This is required for Vercel serverless functions
# Need to use `app` as the variable name here to match Vercel's requirements
def handler(event, context):
    return app(event, context)

# To match Vercel serverless requirements
index = app

    