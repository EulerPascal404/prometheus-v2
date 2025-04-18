from http.server import BaseHTTPRequestHandler
import json
import os
import base64
import tempfile
import logging
import sys
import time
from urllib.parse import parse_qs
from typing import Dict, Optional
import PyPDF2
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
from o1_pdf_filler import run

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Supabase setup
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    logger.error("Missing required environment variables")
    raise ValueError(
        "Missing required environment variables. Please check .env.local for:"
        "\n- NEXT_PUBLIC_SUPABASE_URL"
        "\n- SUPABASE_SERVICE_ROLE_KEY"
    )

def get_supabase() -> Client:
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Error creating Supabase client: {str(e)}")
        return None

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
        print("Extracted text:", full_text[:10] if full_text else "No text extracted")

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

class handler(BaseHTTPRequestHandler):
    def handle_cors(self):
        """Set CORS headers for all responses"""
        origins = [
            "http://localhost:3000",
            "https://localhost:3000",
            "https://getprometheus.ai",
            "https://*.getprometheus.ai",
            os.getenv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")
        ]
        
        # Check if the origin is allowed
        origin = self.headers.get('Origin')
        allowed_origin = "*"  # Default to all origins if no match
        
        if origin:
            for allowed in origins:
                if allowed == origin or (allowed.startswith("https://") and "*" in allowed and origin.endswith(allowed.split("*")[1])):
                    allowed_origin = origin
                    break
        
        self.send_header('Access-Control-Allow-Origin', allowed_origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Credentials', 'true')
    
    def send_json_response(self, response_data, status_code=200):
        """Helper to send JSON responses"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.handle_cors()
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode())
    
    def parse_query_params(self):
        """Parse query parameters from path"""
        if '?' not in self.path:
            return {}
        
        query_string = self.path.split('?', 1)[1]
        return {k: v[0] for k, v in parse_qs(query_string).items()}
        
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.handle_cors()
        self.end_headers()
        
    def do_GET(self):
        """Handle GET requests to validate-documents"""
        logger.info(f"Received GET request to {self.path}")
        
        # Extract path and parameters
        if self.path.startswith('/api/test'):
            self.send_json_response({
                "status": "success",
                "message": "HTTP API is working correctly!",
                "version": "1.0.0"
            })
            return
        
        if not self.path.startswith('/api/validate-documents'):
            self.send_json_response({
                "status": "error",
                "message": "Invalid endpoint"
            }, 404)
            return
        
        # Parse query parameters
        params = self.parse_query_params()
        user_id = params.get('user_id')
        
        if not user_id:
            logger.warning("GET request missing user_id parameter")
            self.send_json_response({
                "status": "error",
                "message": "user_id is required as a query parameter",
                "example": "/api/validate-documents?user_id=your-user-id-here"
            }, 400)
            return
        
        try:
            supabase = get_supabase()
            if not supabase:
                logger.error("Failed to connect to Supabase")
                self.send_json_response({
                    "status": "error",
                    "message": "Could not connect to database"
                }, 500)
                return

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
                
                self.send_json_response({
                    "status": "initialized",
                    "completion_score": 0,
                    "can_proceed": False,
                    "message": "Document record created"
                })
                return
                
            user_docs = response.data[0]
            logger.info(f"Successfully retrieved documents for user: {user_id}")
            self.send_json_response({
                "status": "success",
                "completion_score": user_docs.get("completion_score", 0),
                "can_proceed": bool(user_docs.get("resume")),
                "documents": user_docs
            })
            
        except Exception as e:
            logger.error(f"Error processing GET request: {str(e)}")
            self.send_json_response({
                "status": "error",
                "message": f"Error checking validation status: {str(e)}"
            }, 500)
        
    def do_POST(self):
        """Handle POST requests to validate-documents"""
        logger.info(f"Received POST request to {self.path}")
        
        if not self.path.startswith('/api/validate-documents'):
            self.send_json_response({
                "status": "error",
                "message": "Invalid endpoint"
            }, 404)
            return
        
        # Read request data
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            self.send_json_response({
                "status": "error",
                "message": "No data provided"
            }, 400)
            return
            
        post_data = self.rfile.read(content_length)
        try:
            request_data = json.loads(post_data)
        except json.JSONDecodeError:
            self.send_json_response({
                "status": "error",
                "message": "Invalid JSON data"
            }, 400)
            return
        
        logger.info("Processing POST request with data")
        
        try:
            user_id = request_data.get("user_id")
            uploaded_documents = request_data.get("uploaded_documents", {})
            
            if not user_id or not uploaded_documents:
                logger.warning("POST request missing required fields")
                self.send_json_response({
                    "status": "error",
                    "message": "Missing required fields: user_id and uploaded_documents"
                }, 400)
                return

            logger.info(f"Processing documents for user: {user_id}")
            logger.info(f"Uploaded documents: {list(uploaded_documents.keys())}")
            
            # Get documents from Supabase
            supabase = get_supabase()
            if not supabase:
                self.send_json_response({
                    "status": "error",
                    "message": "Could not connect to database"
                }, 500)
                return

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
                                self.send_json_response({
                                    "status": "error",
                                    "message": "Documents are already being processed. Please wait."
                                }, 409)
                                return
                        except Exception as time_error:
                            logger.error(f"Error checking processing time: {str(time_error)}")
                            # Continue with processing if we can't check time
                elif response.data and response.data.get("processing_status") == "completed":
                    # If processing is already completed, return the existing results
                    self.send_json_response({
                        "status": "success",
                        "completion_score": response.data.get("completion_score", 0),
                        "message": "Documents were already processed.",
                        "can_proceed": True,
                        "document_summaries": response.data.get("document_summaries", {})
                    })
                    return
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
                
                self.send_json_response({
                    "status": "success",
                    "completion_score": completion_score,
                    "message": f"Documents validated successfully. Your profile is {completion_score}% complete.",
                    "can_proceed": True,
                    "document_summaries": document_summaries
                })
            except Exception as e:
                logger.error(f"Error updating database: {str(e)}")
                # Even if database update fails, return the processed summaries
                self.send_json_response({
                    "status": "partial",
                    "message": f"Documents processed but database update failed: {str(e)}",
                    "can_proceed": True,
                    "document_summaries": document_summaries
                })
            
        except Exception as e:
            logger.error(f"Error processing documents: {str(e)}")
            # Update status to error if we have a user_id
            if 'user_id' in locals():
                try:
                    supabase = get_supabase()
                    if supabase:
                        supabase.table("user_documents").update({
                            "processing_status": "error"
                        }).eq("user_id", user_id).execute()
                except Exception as update_error:
                    logger.error(f"Error updating status to error: {str(update_error)}")
            
            self.send_json_response({
                "status": "error",
                "message": f"Error processing documents: {str(e)}"
            }, 500)