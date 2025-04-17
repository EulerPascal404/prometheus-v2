from http.server import BaseHTTPRequestHandler
import json

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
        
        # Return a static lawyer response
        response = {
            "name": "Robert K. D'Andrea",
            "firm": "D'Andrea Law Corporation",
            "law_school": "Oklahoma City University, School of Law",
            "bar_admissions": "District of Columbia",
            "description": "D'Andrea Law Corporation is a Southern California immigration law firm with offices located in Pasadena and Glendora. We are committed to providing superior legal services with the experience and effectiveness of a large firm, while retaining the thoroughness and personal interaction of a boutique. Our clientele includes businesses, investors, families and individuals from all over the world.",
            "address": "510 S. Grand Ave Suite 203 Glendora, CA 91741 USA",
            "match_score": 0.95
        }
        
        self.wfile.write(json.dumps(response).encode()) 