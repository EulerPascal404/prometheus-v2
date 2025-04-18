from http.server import BaseHTTPRequestHandler
import json
import logging
import sys
import os
import tempfile
import base64
from openai import OpenAI
from o1_pdf_filler import run

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests to validate-documents"""
        logger.info(f"Received GET request to validate-documents: {self.path}")
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
        # Get query parameters
        query_components = self.path.split('?')
        user_id = None
        
        if len(query_components) > 1:
            query_params = query_components[1].split('&')
            for param in query_params:
                if '=' in param:
                    name, value = param.split('=', 1)
                    if name == 'user_id':
                        user_id = value
        
        logger.info(f"GET request - user_id: {user_id}")
        
        if not user_id:
            logger.warning("GET request missing user_id parameter")
            response = {
                "status": "error",
                "message": "user_id is required as a query parameter",
                "example": "/api/validate-documents?user_id=your-user-id-here"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Return a mockup of an initialized document record 
        # (simplified from the original which would query Supabase)
        response = {
            "status": "initialized",
            "completion_score": 0,
            "can_proceed": False,
            "message": "Document record created",
            "documents": {
                "user_id": user_id,
                "processing_status": "pending",
                "completion_score": 0,
                "resume": False,
                "recommendations": False,
                "awards": False,
                "publications": False,
                "salary": False,
                "memberships": False
            }
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def process_pdf_content(self, file_content, doc_type, user_id, mock_supabase=None):
        """Process PDF content with OpenAI, similar to original implementation"""
        try:
            # Save the PDF content to a temporary file
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                tmp_file.write(file_content)
                tmp_path = tmp_file.name

            # In a real implementation, this would extract text from the PDF
            # Here we'll simulate the extraction process for simplicity
            
            # Mock extracted text based on document type
            text_content = []
            if doc_type == "resume":
                text_content = ["Resume of John Smith. Experience: Software Engineer at Google 2018-Present.",
                              "Skills: Python, JavaScript, Machine Learning.",
                              "Education: Stanford University, Computer Science, 2018."]
            elif doc_type == "recommendations":
                text_content = ["Letter of Recommendation. I highly recommend John Smith for the position.",
                              "He has demonstrated exceptional skills in his field.",
                              "Signed, Jane Doe, CEO"]
            elif doc_type == "awards":
                text_content = ["Certificate of Achievement presented to John Smith",
                              "for Outstanding Contributions to the field of Artificial Intelligence, 2022."]
            else:
                text_content = [f"Generic {doc_type} document text.",
                               "Contains various information related to the applicant's qualifications and achievements."]
            
            # Clean up temporary file (would be done later in real implementation)
            os.unlink(tmp_path)

            logger.info(f"RUNNING RAG GENERATION FOR {doc_type}")

            # Join all text content and ensure it's a string
            full_text = "\n".join(text_content) if text_content else ""
            logger.info(f"Extracted text: {full_text[:50]}...")  # First 50 chars as log
            
            # If there's a mock supabase, update status
            if mock_supabase:
                logger.info(f"Updating processing status to processing_{doc_type}_analysis")
            
            # Pass context information to run function from o1_pdf_filler for PDF form filling
            try:
                logger.info(f"Calling run function from o1_pdf_filler for {doc_type}")
                pdf_pages = run(full_text, doc_type=doc_type, user_id=user_id, supabase=mock_supabase)
                logger.info(f"PDF filling complete: {pdf_pages} pages processed")
            except Exception as e:
                logger.error(f"Error in PDF filling: {str(e)}")
                pdf_pages = 0

            # Get OpenAI API key from environment variable
            openai_api_key = os.environ.get("OPENAI_API_KEY")
            if not openai_api_key:
                logger.error("Missing OPENAI_API_KEY environment variable")
                return {
                    "summary": "Error: OpenAI API key not configured",
                    "processed": False,
                    "error": "Missing OPENAI_API_KEY environment variable"
                }
            
            # Initialize OpenAI client
            client = OpenAI(api_key=openai_api_key)
            
            # Generate summary using OpenAI - exactly as in original code
            logger.info(f"Sending {doc_type} to OpenAI for analysis")
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a professional O1 document reviewer. Review the following documents and specifically list the strengths and weaknesses of the applicant's resources in creating a successful O1 application. Additionally, provide a list of recommendations for the applicant to improve their application. Format the output as follows: Strengths: [list of strengths], Weaknesses: [list of weaknesses], Recommendations: [list of recommendations]. Make sure to separate each point with a [SEP] separator. Refer to the applicant as 'you'."},
                    {"role": "user", "content": full_text}
                ]
            )
            
            # Extract the response content
            summary = response.choices[0].message.content
            
            return {
                "summary": summary,
                "pages": len(text_content),
                "pdf_filled_pages": pdf_pages,
                "processed": True,
                "text_preview": full_text[:1000],  # First 1000 chars as preview
            }
        except Exception as e:
            logger.error(f"Error processing {doc_type} PDF: {str(e)}")
            return {
                "summary": f"Error processing document: {str(e)}",
                "error": str(e),
                "processed": False
            }
        
    def do_POST(self):
        """Handle POST requests to validate-documents"""
        logger.info("Processing POST request to validate-documents")
        
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            post_data = self.rfile.read(content_length)
            try:
                request_data = json.loads(post_data.decode('utf-8'))
                logger.info(f"POST request data: {request_data}")
            except Exception as e:
                logger.error(f"Error parsing JSON: {str(e)}")
                request_data = {}
        else:
            request_data = {}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
        # Extract data from request
        user_id = request_data.get('user_id')
        uploaded_documents = request_data.get('uploaded_documents', {})
        
        if not user_id or not uploaded_documents:
            logger.warning("POST request missing required fields")
            response = {
                "status": "error",
                "message": "Missing required fields: user_id and uploaded_documents"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        logger.info(f"Processing documents for user: {user_id}")
        logger.info(f"Uploaded documents: {uploaded_documents}")
        
        # Create a mock supabase client for tracking processing status
        # This allows us to call into o1_pdf_filler.run without errors
        class MockSupabase:
            def table(self, name):
                return self
                
            def update(self, data):
                logger.info(f"Mock Supabase update: {data}")
                return self
                
            def eq(self, field, value):
                return self
                
            def execute(self):
                return None

        mock_supabase = MockSupabase()
        
        # Process each document type using OpenAI and PDF filler (similar to original)
        document_summaries = {}
        
        for doc_type in uploaded_documents:
            if uploaded_documents[doc_type]:
                logger.info(f"Processing document type: {doc_type}")
                
                # In a full implementation, you would download the file from storage
                # For this mock version, we'll create dummy content
                mock_file_content = b"%PDF-1.5\n%Mock PDF content for testing"
                
                # Update processing status to the current document
                logger.info(f"Setting processing status to processing_{doc_type}")
                
                # Process with OpenAI and PDF filler
                summary = self.process_pdf_content(
                    file_content=mock_file_content, 
                    doc_type=doc_type, 
                    user_id=user_id, 
                    mock_supabase=mock_supabase
                )
                document_summaries[doc_type] = summary
        
        # Calculate completion score from uploaded documents
        optional_docs = ["recommendations", "awards", "publications", "salary", "memberships"]
        uploaded_optional = sum(1 for doc in optional_docs if uploaded_documents.get(doc))
        completion_score = int((uploaded_optional / len(optional_docs)) * 100)
        
        # Create response similar to the original app
        response = {
            "status": "success",
            "completion_score": completion_score,
            "message": f"Documents validated successfully. Your profile is {completion_score}% complete.",
            "can_proceed": "resume" in uploaded_documents and uploaded_documents["resume"],
            "document_summaries": document_summaries
        }
        
        self.wfile.write(json.dumps(response).encode()) 