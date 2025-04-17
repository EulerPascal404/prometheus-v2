from http.server import BaseHTTPRequestHandler
from .index import app

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """Handle GET requests coming to the serverless function"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # Route to Flask app
        with app.test_client() as test_client:
            response = test_client.get(self.path)
            self.wfile.write(response.get_data())
            
    def do_POST(self):
        """Handle POST requests coming to the serverless function"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
        # Route to Flask app
        with app.test_client() as test_client:
            response = test_client.post(self.path, data=post_data, 
                                       content_type=self.headers.get('Content-Type', 'application/json'))
            self.wfile.write(response.get_data()) 