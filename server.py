from flask import Flask, request, jsonify
from flask_cors import CORS
import sys
import json
import os
from io import BytesIO
import importlib.util
import socket
from http.server import BaseHTTPRequestHandler

# Add the current directory to the path to import the API modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Special import for files with hyphens in name
def import_module_from_file(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

# Import modules
test_module = import_module_from_file(
    "test", 
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "api", "test.py")
)

validate_documents_module = import_module_from_file(
    "validate_documents", 
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "api", "validate-documents.py")
)

match_lawyer_module = import_module_from_file(
    "match_lawyer", 
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "api", "match-lawyer.py")
)

app = Flask(__name__)
# Enable CORS for all routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Custom HTTP handler that doesn't use socket communication
class CustomHandler:
    def __init__(self, path, request_data=None, headers=None):
        self.path = path
        self.request_data = request_data or b''
        self.headers = headers or {}
        self.output_buffer = BytesIO()
        self.wfile = self.output_buffer
        self.rfile = BytesIO(self.request_data)
        
        # Add HTTP request line and required attributes
        self.requestline = f"GET {path} HTTP/1.1"
        self.command = "GET"
        if path.startswith("/api/"):
            self.command = "GET"  # Default to GET
        
        # Add other required attributes
        self.request_version = "HTTP/1.1"
        self.client_address = ('127.0.0.1', 12345)
        self.server = type('obj', (object,), {
            'server_name': 'localhost',
            'server_port': 8000,
            'server_address': ('127.0.0.1', 8000)
        })
        self.raw_requestline = f"{self.command} {path} HTTP/1.1\r\n".encode()
        
        # Set up header properties
        self.headers_dict = {}
        for key, value in self.headers.items():
            self.headers_dict[key.lower()] = value
        
        # Response code and headers
        self.response_code = 200
        self.response_headers = {}
        
    def get_header(self, name, default=None):
        """Get header value"""
        return self.headers_dict.get(name.lower(), default)
    
    def send_response(self, code, message=None):
        """Send HTTP response code"""
        self.response_code = code
    
    def send_header(self, keyword, value):
        """Send HTTP header"""
        self.response_headers[keyword] = value
    
    def end_headers(self):
        """End HTTP headers"""
        pass
        
    def handle_cors(self):
        """Handle CORS headers - for compatibility with existing handler code"""
        origins = [
            "http://localhost:3000",
            "https://localhost:3000",
            "https://getprometheus.ai",
            "https://*.getprometheus.ai",
            os.getenv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")
        ]
        
        # Check if the origin is allowed
        origin = self.headers_dict.get('origin')
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
        """Helper to send JSON responses - for compatibility with existing handler code"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.handle_cors()
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode())

class TestHandler(CustomHandler):
    """Handler for the test API endpoint"""
    
    def do_GET(self):
        """Handle GET request to test endpoint"""
        # Call the handler's do_GET method with our custom implementation
        test_module.handler.do_GET(self)

class ValidateDocumentsHandler(CustomHandler):
    """Handler for the validate-documents API endpoint"""
    
    def do_GET(self):
        """Handle GET request to validate-documents endpoint"""
        validate_documents_module.handler.do_GET(self)
    
    def do_POST(self):
        """Handle POST request to validate-documents endpoint"""
        # Set command to POST for this method
        self.command = "POST"
        try:
            validate_documents_module.handler.do_POST(self)
        except Exception as e:
            # Handle potential errors in the original handler
            error_message = str(e)
            self.send_json_response({
                "status": "error",
                "message": f"Error in POST request: {error_message}"
            }, 500)
    
    def do_OPTIONS(self):
        """Handle OPTIONS request to validate-documents endpoint"""
        # Set command to OPTIONS for this method
        self.command = "OPTIONS"
        validate_documents_module.handler.do_OPTIONS(self)

class MatchLawyerHandler(CustomHandler):
    """Handler for the match-lawyer API endpoint"""
    
    def do_POST(self):
        """Handle POST request to match-lawyer endpoint"""
        # Set command to POST for this method
        self.command = "POST"
        try:
            match_lawyer_module.handler.do_POST(self)
        except Exception as e:
            # Handle potential errors in the original handler
            error_message = str(e)
            self.send_json_response({
                "status": "error",
                "message": f"Error in POST request: {error_message}"
            }, 500)
    
    def do_OPTIONS(self):
        """Handle OPTIONS request to match-lawyer endpoint"""
        # Set command to OPTIONS for this method
        self.command = "OPTIONS"
        match_lawyer_module.handler.do_OPTIONS(self)

# Flask routes
@app.route('/api/test', methods=['GET'])
def test_route():
    """Route requests to the test handler."""
    # Add any query parameters to the path
    path = "/api/test"
    if request.query_string:
        path = f"{path}?{request.query_string.decode('utf-8')}"
    
    # Convert Flask headers to a simple dict
    headers = dict(request.headers)
    
    # Create a handler instance
    handler = TestHandler(path, request.data, headers)
    
    # Call the appropriate handler method
    handler.do_GET()
    
    # Get the response from the output buffer
    handler.output_buffer.seek(0)
    response_data = handler.output_buffer.read().decode('utf-8')
    
    # Try to parse the response as JSON
    try:
        response_json = json.loads(response_data)
        return jsonify(response_json), getattr(handler, 'response_code', 200)
    except json.JSONDecodeError:
        return response_data, getattr(handler, 'response_code', 200)

@app.route('/api/validate-documents', methods=['GET', 'POST', 'OPTIONS'])
def validate_documents_route():
    """Route requests to the validate-documents handler."""
    # Add any query parameters to the path
    path = "/api/validate-documents"
    if request.query_string:
        path = f"{path}?{request.query_string.decode('utf-8')}"
    
    # Convert Flask headers to a simple dict
    headers = dict(request.headers)
    
    # Create a handler instance
    handler = ValidateDocumentsHandler(path, request.data, headers)
    
    # Call the appropriate handler method based on the request method
    if request.method == 'GET':
        handler.do_GET()
    elif request.method == 'POST':
        handler.do_POST()
    elif request.method == 'OPTIONS':
        handler.do_OPTIONS()
    
    # Get the response from the output buffer
    handler.output_buffer.seek(0)
    response_data = handler.output_buffer.read().decode('utf-8')
    
    # Try to parse the response as JSON
    try:
        response_json = json.loads(response_data)
        return jsonify(response_json), getattr(handler, 'response_code', 200)
    except json.JSONDecodeError:
        return response_data, getattr(handler, 'response_code', 200)

@app.route('/api/match-lawyer', methods=['POST', 'OPTIONS'])
def match_lawyer_route():
    """Route requests to the match-lawyer handler."""
    # Add any query parameters to the path
    path = "/api/match-lawyer"
    if request.query_string:
        path = f"{path}?{request.query_string.decode('utf-8')}"
    
    # Convert Flask headers to a simple dict
    headers = dict(request.headers)
    
    # Create a handler instance
    handler = MatchLawyerHandler(path, request.data, headers)
    
    # Call the appropriate handler method based on the request method
    if request.method == 'POST':
        handler.do_POST()
    elif request.method == 'OPTIONS':
        handler.do_OPTIONS()
    
    # Get the response from the output buffer
    handler.output_buffer.seek(0)
    response_data = handler.output_buffer.read().decode('utf-8')
    
    # Try to parse the response as JSON
    try:
        response_json = json.loads(response_data)
        return jsonify(response_json), getattr(handler, 'response_code', 200)
    except json.JSONDecodeError:
        return response_data, getattr(handler, 'response_code', 200)

if __name__ == '__main__':
    app.run(debug=True, port=8000) 