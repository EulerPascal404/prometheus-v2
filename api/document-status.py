from http.server import BaseHTTPRequestHandler
import json
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests to document-status"""
        logger.info(f"Received GET request to document-status: {self.path}")
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
        # Parse the path to get user_id from /api/document-status/[user_id]
        path_parts = self.path.split('/')
        user_id = None
        
        if len(path_parts) >= 4:  # /api/document-status/[user_id]
            user_id = path_parts[3]
            # Remove any query string
            if '?' in user_id:
                user_id = user_id.split('?')[0]
        
        logger.info(f"Checking document status for user: {user_id}")
        
        if not user_id:
            logger.warning("Missing user_id in path")
            response = {
                "status": "error",
                "message": "Missing user_id in path"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        # Mock document status check - would query Supabase in the original
        # This is just a placeholder implementation
        
        # Return different statuses based on user_id last character to simulate different states
        last_char = user_id[-1] if user_id else '0'
        
        if last_char in '012':
            # Simulate a non-existent document
            response = {
                "status": "not_found",
                "completion_score": 0,
                "can_proceed": False
            }
        elif last_char in '345':
            # Simulate processing document
            response = {
                "status": "processing_resume",
                "completion_score": 20,
                "can_proceed": False
            }
        elif last_char in '67':
            # Simulate partially completed document
            response = {
                "status": "completed",
                "completion_score": 60,
                "can_proceed": True
            }
        else:
            # Simulate fully processed document
            response = {
                "status": "completed",
                "completion_score": 100,
                "can_proceed": True
            }
        
        logger.info(f"Returning status for user {user_id}: {response['status']}")
        self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers() 