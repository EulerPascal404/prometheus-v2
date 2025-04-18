from http.server import BaseHTTPRequestHandler
import json
import os
import datetime
import traceback
import socket
import uuid
from openai import OpenAI

VECTOR_STORE_ID = "vs_680295db3acc8191b3018c1fda9f5f58"

openai_api_key = os.environ.get("OPENAI_API_KEY")

client = OpenAI(api_key=openai_api_key)

# Create logs directory
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

def extract_all_text(data):
    """
    Recursively extract all text content from the request data,
    with special handling for document summaries.
    Returns a consolidated string of all text content found.
    """
    all_text = []
    
    # Add a section header for better organization
    def add_section(title):
        all_text.append("\n" + "=" * 40)
        all_text.append(f"   {title}   ")
        all_text.append("=" * 40 + "\n")
    
    # Special handling for document summaries - this is the main focus
    def extract_document_summaries(summaries):
        if not summaries:
            return
        
        add_section("DOCUMENT SUMMARIES (UPLOADED DOCUMENTS)")
        
        for doc_type, doc_data in summaries.items():
            all_text.append(f"\n--- {doc_type.upper()} DOCUMENT ---")
            
            # Handle strengths
            if 'strengths' in doc_data and doc_data['strengths']:
                all_text.append("\nSTRENGTHS:")
                for strength in doc_data['strengths']:
                    all_text.append(f"  • {strength}")
            
            # Handle weaknesses
            if 'weaknesses' in doc_data and doc_data['weaknesses']:
                all_text.append("\nWEAKNESSES:")
                for weakness in doc_data['weaknesses']:
                    all_text.append(f"  • {weakness}")
            
            # Handle recommendations
            if 'recommendations' in doc_data and doc_data['recommendations']:
                all_text.append("\nRECOMMENDATIONS:")
                for recommendation in doc_data['recommendations']:
                    all_text.append(f"  • {recommendation}")
            
            # Handle summary text
            if 'summary' in doc_data and doc_data['summary']:
                all_text.append("\nSUMMARY:")
                all_text.append(doc_data['summary'])
    
    # Process user information - keep minimal to focus on documents
    def extract_user_info(data):
        if 'user_id' in data:
            add_section("USER INFORMATION")
            all_text.append(f"User ID: {data['user_id']}")
            
            # Add address if available (this comes from the user, not Supabase)
            if 'additional_info' in data and 'address' in data['additional_info']:
                all_text.append(f"Address: {data['additional_info']['address']}")
    
    # Process uploaded documents info - track which documents were uploaded
    def extract_uploaded_docs_info(data):
        if 'uploaded_documents' in data:
            add_section("UPLOADED DOCUMENTS STATUS")
            for doc_type, is_uploaded in data['uploaded_documents'].items():
                status = "UPLOADED" if is_uploaded else "NOT UPLOADED"
                all_text.append(f"  • {doc_type}: {status}")
    
    # Main extraction logic - simplified to reduce noise
    def extract_text(item, prefix='', depth=0):
        """Generic recursive extraction for any data structure"""
        # Skip deep recursion to focus on important data
        if depth > 5:  
            return
            
        if isinstance(item, dict):
            for key, value in item.items():
                # Skip large text fields and non-essential data
                if (key in ['summary', 'text_preview'] and isinstance(value, str) and len(value) > 100) or \
                   key in ['headers', 'raw_data', 'error']:
                    continue
                    
                if isinstance(value, (dict, list)):
                    all_text.append(f"{prefix}{key}:")
                    extract_text(value, f"{prefix}  ", depth + 1)
                else:
                    all_text.append(f"{prefix}{key}: {value}")
        elif isinstance(item, list):
            for idx, value in enumerate(item):
                if isinstance(value, (dict, list)):
                    all_text.append(f"{prefix}Item {idx}:")
                    extract_text(value, f"{prefix}  ", depth + 1)
                else:
                    all_text.append(f"{prefix}• {value}")
        else:
            all_text.append(f"{prefix}{item}")
    
    try:
        # Priority 1: Extract document summaries from uploaded documents
        if 'document_summaries' in data:
            extract_document_summaries(data['document_summaries'])
            
        # Priority 2: Which documents were uploaded
        extract_uploaded_docs_info(data)
        
        # Priority 3: Basic user info (minimal)
        extract_user_info(data)
        
        # We skip the general data extraction to focus only on uploaded documents
    except Exception as e:
        # Handle any errors in extraction
        add_section("ERROR IN TEXT EXTRACTION")
        all_text.append(f"Error: {str(e)}")
        all_text.append(traceback.format_exc())
    
    return "\n".join(all_text)

def save_request_data(request_data, extracted_text, handler_instance=None):
    """
    Save both the raw request data and extracted text to separate files
    with timestamps for tracking. Include metadata about the request.
    """
    try:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        request_id = str(uuid.uuid4())[:8]  # Generate a short unique ID for this request
        
        # Create logs directory if it doesn't exist
        os.makedirs(log_dir, exist_ok=True)
        
        # Extract user ID for filename if available
        user_id = request_data.get('user_id', 'unknown')
        user_id = user_id.replace('-', '')[:8]  # Shorten and clean user ID for filename
        
        # Create filenames
        raw_file_path = os.path.join(log_dir, f"lawyer_req_{timestamp}_{user_id}_{request_id}.json")
        text_file_path = os.path.join(log_dir, f"lawyer_text_{timestamp}_{user_id}_{request_id}.txt")
        
        # Add metadata to the extracted text
        metadata = [
            "=" * 60,
            "LAWYER MATCHING REQUEST METADATA",
            "=" * 60,
            f"Timestamp: {datetime.datetime.now().isoformat()}",
            f"Request ID: {request_id}",
            f"User ID: {user_id}",
        ]
        
        # Add client information if available
        if handler_instance:
            client_address = handler_instance.client_address[0] if hasattr(handler_instance, 'client_address') else 'unknown'
            metadata.append(f"Client IP: {client_address}")
            
            try:
                # Try to get hostname
                hostname = socket.gethostbyaddr(client_address)[0]
                metadata.append(f"Client Hostname: {hostname}")
            except:
                pass
                
            # Add headers if available
            if hasattr(handler_instance, 'headers'):
                metadata.append("\nREQUEST HEADERS:")
                for header in handler_instance.headers:
                    metadata.append(f"  {header}: {handler_instance.headers[header]}")
        
        metadata.append("=" * 60 + "\n")
        
        # Combine metadata with extracted text
        full_text = "\n".join(metadata) + "\n" + extracted_text
        
        # Save raw request data with metadata
        with open(raw_file_path, 'w') as f:
            # Add metadata as a comment
            f.write("// " + "\n// ".join(metadata) + "\n\n")
            json.dump(request_data, f, indent=2)
        
        # Save extracted text with metadata
        with open(text_file_path, 'w') as f:
            f.write(full_text)
        
        print(f"Saved request data to {raw_file_path} and {text_file_path}")
        return raw_file_path, text_file_path
    except Exception as e:
        print(f"Error saving request data: {str(e)}")
        print(traceback.format_exc())
        return None, None

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
    def do_POST(self):
        """Handle POST requests to match-lawyer"""
        try:
            # Parse request data
            content_length = int(self.headers.get('Content-Length', 0))
            request_data = {}
            
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                try:
                    request_data = json.loads(post_data)
                except json.JSONDecodeError as e:
                    print(f"Error decoding JSON: {str(e)}")
                    request_data = {
                        "error": "Invalid JSON", 
                        "raw_data": post_data.decode('utf-8', errors='replace')
                    }
            
            # Log request received
            user_id = request_data.get('user_id', 'unknown')
            print(f"Received lawyer matching request from user: {user_id}")
            
            # Process only the document summaries from the request data
            document_summaries = request_data.get('document_summaries', {})
            print(f"Processing {len(document_summaries)} document summaries from request")
            
            # Extract all text from request data
            all_request_text = extract_all_text(request_data)
            print(all_request_text)
            
            # Save request data to files with this instance for metadata
            raw_file, text_file = save_request_data(request_data, all_request_text, self)
            
            # Use only the document summaries for matching
            query_text = ""
            
            # Extract key information from document summaries
            for doc_type, doc_data in document_summaries.items():
                # Add document type
                query_text += f"Document type: {doc_type}\n"
                
                # Add strengths if available
                if 'strengths' in doc_data and doc_data['strengths']:
                    query_text += "Strengths:\n"
                    for strength in doc_data['strengths']:
                        query_text += f"- {strength}\n"
                
                # Add summary if available
                if 'summary' in doc_data and doc_data['summary']:
                    query_text += f"Summary: {doc_data['summary']}\n"
            
            # Use document summaries as query if available, otherwise use all request text
            search_query = query_text if query_text else all_request_text
            
            # Make sure we have a valid query
            if not search_query or len(search_query.strip()) < 10:
                print("Query text too short, using default search")
                search_query = "O-1 visa lawyer for extraordinary ability"
            
            # Truncate if too long (OpenAI limits)
            if len(search_query) > 8000:
                print(f"Query too long ({len(search_query)} chars), truncating")
                search_query = search_query[:8000]
            
            # Search the vector store with the processed query
            results = client.vector_stores.search(
                vector_store_id=VECTOR_STORE_ID,
                query=search_query,
                max_num_results=1,
            )
            
            response_dict = eval(results.data[0].content[0].text)
            response_dict["match_score"] = results.data[0].score
            response_dict = {k.lower().replace(" ", "_"): v for k, v in response_dict.items()}
            
            # Send successful response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            self.wfile.write(json.dumps(response_dict).encode())
            
        except Exception as e:
            # Log the error
            print(f"Error processing request: {str(e)}")
            print(traceback.format_exc())
            
            # Send error response
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            
            error_response = {
                "error": "Internal server error",
                "message": str(e)
            }
            self.wfile.write(json.dumps(error_response).encode())