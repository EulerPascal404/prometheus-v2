from http.server import BaseHTTPRequestHandler
import json

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests to document-status"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # Parse the path to get user_id from /api/document-status/[user_id]
        path_parts = self.path.split('/')
        user_id = None
        
        if len(path_parts) >= 4:  # /api/document-status/[user_id]
            user_id = path_parts[3]
        
        if not user_id:
            response = {
                "status": "error",
                "message": "Missing user_id in path"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Return a simplified mock response
        response = {
            "status": "completed",
            "completion_score": 80,
            "can_proceed": True
        }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers() 