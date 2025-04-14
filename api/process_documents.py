from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
import os
from supabase import create_client, Client
import uvicorn
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
import PyPDF2
import tempfile
import base64
from o1_pdf_filler import run
from sentence_transformers import SentenceTransformer
import numpy as np

# Load .env.local from the parent directory (demo directory)
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", 
                  "https://prometheus-ai.vercel.app",
                  "https://prometheus-v2.vercel.app",
                  "https://prometheus-v2-*-eulerpascal404.vercel.app",
                  "https://*.vercel.app",
                  "https://getprometheus.ai",
                  "https://www.getprometheus.ai",
                  "https://demo-ayqbc45qa-aditya-guptas-projects-1c7bb58d.vercel.app",
                  "https://demo-cylzh6hbe-aditya-guptas-projects-1c7bb58d.vercel.app",
                  "https://demo-gknna7xjs-aditya-guptas-projects-1c7bb58d.vercel.app",
                  "https://demo-38j8p53ms-aditya-guptas-projects-1c7bb58d.vercel.app"],  # Add your Vercel URLs
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Supabase setup with better error handling
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # Changed to use service role key

if not supabase_url or not supabase_key:
    raise ValueError(
        "Missing required environment variables. Please check .env.local for:"
        "\n- NEXT_PUBLIC_SUPABASE_URL"
        "\n- SUPABASE_SERVICE_ROLE_KEY"  # Updated error message
    )

def get_supabase() -> Client:
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        print(f"Error creating Supabase client: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Could not connect to database"
        )

# Setup OpenAI
async def process_pdf_content(file_content: bytes, doc_type: str, user_id: str, supabase: Client) -> dict:
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
                
                text = page.extract_text()
                if text.strip():  # Only add non-empty pages
                    text_content.append(text)

        # Clean up temporary file
        os.unlink(tmp_path)

        print("RUNNING RAG GENERATION")

        # Join all text content
        full_text = "\n".join(text_content)
        print("Extracted text:", full_text[:10])  # Print first 10 chars for debugging

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

class DocumentValidationRequest(BaseModel):
    user_id: str
    uploaded_documents: Dict[str, bool]

@app.post("/api/validate-documents")
async def validate_documents(
    request: DocumentValidationRequest,
    supabase: Client = Depends(get_supabase)
):
    print("Starting document validation")
    try:
        print(f"Processing documents for user: {request.user_id}")
        
        # Get documents from Supabase
        response = supabase.table("user_documents").select("*").eq("user_id", request.user_id).execute()
        
        # Get the actual PDF files from storage
        document_summaries = {}
        
        # First update to "pending" status
        supabase.table("user_documents").update({
            "processing_status": "pending"
        }).eq("user_id", request.user_id).execute()
        
        for doc_type in request.uploaded_documents:
            if request.uploaded_documents[doc_type]:
                try:
                    # Update processing status to current document
                    supabase.table("user_documents").update({
                        "processing_status": f"processing_{doc_type}"
                    }).eq("user_id", request.user_id).execute()
                    
                    # Get the file from storage
                    file_response = supabase.storage.from_('documents').download(
                        f"{request.user_id}/{doc_type}.pdf"
                    )
                    
                    if file_response:
                        # Process the PDF content with page-by-page updates
                        summary = await process_pdf_content(file_response, doc_type, request.user_id, supabase)
                        document_summaries[doc_type] = summary
                
                except Exception as e:
                    print(f"Error processing {doc_type}: {str(e)}")
                    document_summaries[doc_type] = {
                        "error": str(e),
                        "processed": False
                    }

        # Create update data
        update_data = {
            "processing_status": "completed",
            "document_summaries": document_summaries
        }

        if not response.data:
            # Create new record
            insert_data = {
                "user_id": request.user_id,
                "processing_status": "pending",
                "completion_score": 0,
                **request.uploaded_documents,
                "document_summaries": document_summaries
            }
            
            insert_response = supabase.table("user_documents").insert(insert_data).execute()
            user_docs = insert_response.data[0]
        else:
            user_docs = response.data[0]
            # Update existing record
            supabase.table("user_documents").update(update_data).eq("user_id", request.user_id).execute()

        # Calculate completion score
        optional_docs = ["recommendations", "awards", "publications", "salary", "memberships"]
        uploaded_optional = sum(1 for doc in optional_docs if user_docs.get(doc))
        completion_score = (uploaded_optional / len(optional_docs)) * 100
        
        # Final update with completion score
        supabase.table("user_documents").update({
            "completion_score": completion_score,
            "last_validated": "now()"
        }).eq("user_id", request.user_id).execute()
        
        return {
            "status": "success",
            "completion_score": completion_score,
            "message": f"Documents validated successfully. Your profile is {completion_score}% complete.",
            "can_proceed": True,
            "document_summaries": document_summaries
        }
        
    except Exception as e:
        print(f"Error processing documents: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing documents: {str(e)}"
        )

@app.get("/api/document-status/{user_id}")
async def get_document_status(
    user_id: str,
    supabase: Client = Depends(get_supabase)
):
    try:
        response = supabase.table("user_documents").select("*").eq("user_id", user_id).single().execute()
        
        if not response.data:
            return {
                "status": "not_found",
                "completion_score": 0,
                "can_proceed": False
            }
            
        return {
            "status": response.data.get("processing_status", "pending"),
            "completion_score": response.data.get("completion_score", 0),
            "can_proceed": bool(response.data.get("resume"))
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error checking document status: {str(e)}"
        )

@app.get("/api/validate-documents")
async def get_validation_status(
    user_id: str = None,
    supabase: Client = Depends(get_supabase)
):
    if not user_id:
        return {
            "status": "error",
            "message": "user_id is required as a query parameter",
            "example": "/api/validate-documents?user_id=your-user-id-here"
        }
    
    try:
        # Try to get existing document
        response = supabase.table("user_documents").select("*").eq("user_id", user_id).execute()
        
        # If no document exists, create one
        if not response.data:
            print(f"Creating new document record for user: {user_id}")
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
            
            return {
                "status": "initialized",
                "completion_score": 0,
                "can_proceed": False,
                "message": "Document record created"
            }
            
        user_docs = response.data[0]  # Get first record since we might have multiple now
        return {
            "status": "success",
            "completion_score": user_docs.get("completion_score", 0),
            "can_proceed": bool(user_docs.get("resume")),
            "documents": user_docs
        }
        
    except Exception as e:
        print(f"Error processing documents: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error checking validation status: {str(e)}"
        )
    
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

# Add this new model class near the top with the other models
class AdditionalInfo(BaseModel):
    address: str
    additional_comments: str

class LawyerMatchRequest(BaseModel):
    user_id: str
    uploaded_documents: Dict[str, bool]
    document_summaries: Dict[str, Dict[str, str]]
    additional_info: AdditionalInfo

# Update the lawyer matching endpoint
@app.post("/api/match-lawyer")
async def match_lawyer(request: LawyerMatchRequest):
    try:
        # Get all summaries from the document summaries
        all_summaries = []
        for doc_type, doc_info in request.document_summaries.items():
            if isinstance(doc_info, dict) and 'summary' in doc_info:
                all_summaries.append(doc_info['summary'])
        
        # Add additional information to the text being analyzed
        additional_text = f"\nClient Address: {request.additional_info.address}\nAdditional Comments: {request.additional_info.additional_comments}"
        all_summaries.append(additional_text)
        
        if not all_summaries:
            raise HTTPException(
                status_code=400,
                detail="No document summaries provided"
            )

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

        return {
            "name": best_match["Name"],
            "firm": best_match["Firm"],
            "law_school": best_match["Law School"],
            "bar_admissions": best_match["Bar Admissions"],
            "description": best_match["Description"],
            "address": best_match["Address"],  # Include the address in the response
            "match_score": match_score
        }

    except Exception as e:
        print(f"Error in lawyer matching: {str(e)}")  # Add debug logging
        raise HTTPException(
            status_code=500,
            detail=f"Error matching lawyer: {str(e)}"
        )

# Add this at the end of the file
if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)