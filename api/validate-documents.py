from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests to validate-documents"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
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
        
        if not user_id:
            # Missing user_id parameter
            response = {
                "status": "error",
                "message": "user_id is required as a query parameter",
                "example": "/api/validate-documents?user_id=your-user-id-here"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Return a simplified response for now
        response = {
            "status": "initialized",
            "completion_score": 0,
            "can_proceed": False,
            "message": "Document record created"
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
    def do_POST(self):
        """Handle POST requests to validate-documents"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            post_data = self.rfile.read(content_length)
            try:
                request_data = json.loads(post_data)
            except:
                request_data = {}
        else:
            request_data = {}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # Extract data from request
        user_id = request_data.get('user_id')
        uploaded_documents = request_data.get('uploaded_documents', {})
        
        if not user_id or not uploaded_documents:
            response = {
                "status": "error",
                "message": "Missing required fields: user_id and uploaded_documents"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Return a simplified mock response
        document_summaries = {}
        for doc_type in uploaded_documents:
            if uploaded_documents[doc_type]:
                document_summaries[doc_type] = {
                    "processed": True,
                    "summary": f"Mock summary for {doc_type}",
                    "pages": 5
                }
        
        response = {
            "status": "success",
            "completion_score": 80,
            "message": "Documents validated successfully. Your profile is 80% complete.",
            "can_proceed": True,
            "document_summaries": document_summaries
        }
        
        self.wfile.write(json.dumps(response).encode())