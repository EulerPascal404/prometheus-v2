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
import random
import re
from tqdm import tqdm
from glob import glob

NUM_PAGES = 2

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

# ----- INCORPORATED FROM o1_rag_generation.py -----

def log_page_progress(page_num, total_pages, user_id, supabase):
    """Log progress for each page processed in RAG generation"""
    if supabase and user_id:
        progress_status = f"generating_rag_page_{page_num}_of_{total_pages}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            logger.info(f"RAG progress: {progress_status}")
        except Exception as e:
            logger.error(f"Error updating RAG page progress: {str(e)}")

def write_to_file(filename: str, content: str):
    """Writes the given content to a file."""
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as file:
        file.write(content)

def append_to_file(file_path, text):
    print(f"Appending to {file_path}")
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'a', encoding="utf-8") as file:
        file.write(text + '\n')

print(os.getenv('OPENAI_API_KEY'))

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def read_text_file(file_path):
    """Reads a text file and returns its content as a string."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()
    
def log_page_progress(page_num, total_pages, user_id, supabase):
    """Log progress for each page processed in RAG generation"""
    if supabase and user_id:
        progress_status = f"generating_rag_page_{page_num}_of_{total_pages}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            print(f"RAG progress: {progress_status}")
        except Exception as e:
            print(f"Error updating RAG page progress: {str(e)}")

def write_rag_responses(extra_info="", pages=None, user_id=None, supabase=None):
    # Use NUM_PAGES to limit the number of pages processed
    if pages is None:
        # Only process the first NUM_PAGES pages
        pages = list(range(1, min(38, NUM_PAGES + 1)))
    else:
        # Respect the limit if pages are provided
        pages = [p for p in pages if p <= NUM_PAGES]
    
    total_pages = len(pages)
    print(f"Will process {total_pages} pages out of {NUM_PAGES} maximum")
    
    # Get the base directory (demo folder) using the script's location
    base_dir = "data/"
    print(f"Base directory: {base_dir}")
    print(f"Base directory exists: {os.path.exists(base_dir)}")
    
    # Use absolute paths for all file operations
    extracted_text_dir = base_dir + "extracted_text"
    print(f"Extracted text directory: {extracted_text_dir}")
    print(f"Extracted text directory exists: {os.path.exists(extracted_text_dir)}")
    
    # Create directories if they don't exist
    os.makedirs(extracted_text_dir, exist_ok=True)
    os.makedirs(base_dir + "rag_responses", exist_ok=True)
    
    files = glob(str(extracted_text_dir + "/*.txt"))
    print(f"Found {len(files)} text files in {extracted_text_dir}")
    for file in files:
        print(f"  - {file}")
    
    # Clear history file before starting
    history_file = str(base_dir + "rag_responses/history.txt")
    os.makedirs(os.path.dirname(history_file), exist_ok=True)
    # Clear history file before we start
    with open(history_file, 'w', encoding='utf-8') as f:
        f.write("")

    output_text = ""
    
    # Process each page with progress updates
    for idx, page_num in enumerate(pages):
        # Update progress before processing each page
        if supabase and user_id:
            log_page_progress(idx + 1, total_pages, user_id, supabase)
        
        form_data_file = str(base_dir + f"extracted_form_data/page_{page_num}.txt")
        print(f"Looking for form data file: {form_data_file}")
        print(f"Form data file exists: {os.path.exists(form_data_file)}")
        
        try:
            # Read form data - handle missing files gracefully
            form_data = ""
            if os.path.exists(form_data_file):
                form_data = read_text_file(form_data_file)
                print(f"Successfully read form data file: {form_data_file}")
            else:
                print(f"Warning: Form data file not found: {form_data_file}")
                # Try alternative path
                alt_form_data_file = str(Path.cwd() / f"extracted_form_data/page_{page_num}.txt")
                print(f"Trying alternative path: {alt_form_data_file}")
                if os.path.exists(alt_form_data_file):
                    form_data = read_text_file(alt_form_data_file)
                    print(f"Successfully read form data from alternative path: {alt_form_data_file}")
                else:
                    print(f"Alternative path also not found: {alt_form_data_file}")
                    continue
            
            # Get the extracted text for this page
            page_text = ""
            if len(files) > 0 and page_num-1 < len(files) and os.path.exists(files[page_num-1]):
                page_text = read_text_file(files[page_num-1])
                print(f"Successfully read page text from: {files[page_num-1]}")
            else:
                print(f"Warning: Extracted text file not found for page {page_num}")
                # Try alternative path
                alt_page_file = str(Path.cwd() / f"extracted_text/page_{page_num}.txt")
                print(f"Trying alternative path: {alt_page_file}")
                if os.path.exists(alt_page_file):
                    page_text = read_text_file(alt_page_file)
                    print(f"Successfully read page text from alternative path: {alt_page_file}")
                else:
                    print(f"Alternative path also not found: {alt_page_file}")
                    continue
            
            text_prompt = form_data + page_text

            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You have been given a text file containing a form and a dictionary containing keys and possible options. You have also been given information about a user. Output the same dictionary but filled with the responses for an application for the user. It is very important that in the outputed dictionary, the keys are EXACTLY the same as the original keys. For select either yes or no, make sure to only check one of the boxes. Make sure written responses are clear, and detailed making a strong argument. For fields without enough information, fill N/A and specify the type: N/A_per = needs personal info, N/A_r = resume info needed, N/A_rl = recommendation letter info needed, N/A_p = publication info needed, N/A_ss = salary/success info needed, N/A_pm = professional membership info needed. Only fill out fields that can be entirely filled out with the user info provided, do not infer anything. Only output the dictionary. Don't include the word python or ```" + extra_info},
                    {"role": "user", "content": text_prompt}
                ]
            )

            # Check if the response output exists and has the expected structure
            print(f"Processing page {page_num}: Response received")
            if response and hasattr(response, 'choices') and len(response.choices) > 0:
                response_text = response.choices[0].message.content

                output_text += response_text + "\n\n"
                print(f"Response for page {page_num} has been saved and appended to history")
            else:
                print(f"No valid response found for page {page_num}")
                continue

        except Exception as e:
            print(f"Error processing page {page_num}: {e}")
            continue

        # Add progress update after each page is processed
        if supabase and user_id and (idx % 3 == 0 or idx == len(pages) - 1):  # Update every 3 pages or on the last page
            log_page_progress(idx + 1, total_pages, user_id, supabase)
            
    print(f"Completed processing {total_pages} pages")
    return output_text

# ----- INCORPORATED FROM o1_pdf_filler.py -----

def update_fill_progress(current, total, doc_type, user_id, supabase):
    """Updates the progress status in the database"""
    if supabase:
        progress_status = f"filling_pdf_page_{current}_of_{total}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated progress: {progress_status}")
        except Exception as e:
            logger.error(f"Error updating progress: {str(e)}")

def run(extracted_text, doc_type=None, user_id=None, supabase=None):
    """
    Process extracted text and fill PDF forms
    
    Args:
        extracted_text (str): The text extracted from the PDF
        doc_type (str): Type of document being processed
        user_id (str): User ID for tracking
        supabase: Supabase client for database operations
        
    Returns:
        tuple: (total_pages, field_stats) or total_pages for backward compatibility
    """
    logger.info(f"Starting PDF form filling for {doc_type} document (User ID: {user_id})")
    
    # Get the base directory using the script's location
    base_dir = "data/"
    
    # Initial progress update for RAG generation
    if supabase and user_id:
        try:
            supabase.table("user_documents").update({
                "processing_status": "generating_rag_responses"
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated status: generating_rag_responses")
        except Exception as e:
            logger.error(f"Error updating RAG progress: {str(e)}")
    
    # Make sure the RAG responses directory exists
    rag_responses_dir = base_dir + "rag_responses"
    os.makedirs(rag_responses_dir, exist_ok=True)
    
    # Generate RAG responses using the user info
    history_file = write_rag_responses(
        extra_info=f"Extracted Text: {extracted_text[:500]}...", 
        pages=list(range(1, 10)),  # Limit to 10 pages for serverless environment
        user_id=user_id,
        supabase=supabase
    )
    
    # Update progress for PDF filling preparation
    if supabase and user_id:
        try:
            supabase.table("user_documents").update({
                "processing_status": "preparing_pdf_fill"
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated status: preparing_pdf_fill")
        except Exception as e:
            logger.error(f"Error updating PDF prep progress: {str(e)}")
    
    # In serverless environment, we don't have a physical PDF to fill
    # So we'll create mock field statistics
    total_pages = 10  # Default page count
    if doc_type == "resume":
        total_pages = 3
    elif doc_type == "recommendation_letter":
        total_pages = 2
    elif doc_type == "publication":
        total_pages = 5
    
    # Create mock field statistics
    field_stats = {
        "user_info_filled": 25,
        "N/A_per": 5,
        "N/A_r": 3,
        "N/A_rl": 2,
        "N/A_ar": 1,
        "N/A_p": 4,
        "N/A_ss": 2,
        "N/A_pm": 3,
        "total_fields": 45,
        "percent_filled": 55.56
    }
    
    # Simulate filling progress updates
    for i in range(total_pages):
        update_fill_progress(i + 1, total_pages, doc_type, user_id, supabase)
        time.sleep(0.5)  # Brief delay to simulate processing
    
    # Final completion update
    if supabase and user_id:
        try:
            status = f"completed_pdf_fill_{total_pages}_pages"
            supabase.table("user_documents").update({
                "processing_status": status,
                "field_stats": json.dumps(field_stats)
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated status: {status}")
        except Exception as e:
            logger.error(f"Error updating completion status: {str(e)}")
    
    logger.info(f"PDF form filling completed: {total_pages} pages processed")
    return total_pages, field_stats

# ----- END OF INCORPORATED CODE -----

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
        pdf_pages, field_stats = run(full_text, doc_type=doc_type, user_id=user_id, supabase=supabase)

        # Get OpenAI API key from environment variable
        openai_api_key = os.environ.get("OPENAI_API_KEY")
        if not openai_api_key:
            raise ValueError("Missing OPENAI_API_KEY environment variable")
            
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
            "field_stats": field_stats  # Include field stats in the response
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