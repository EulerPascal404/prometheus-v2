"""
Dashboard API endpoint to provide document statistics and recent activity data.
"""

import sys
import json
import logging
from http.server import BaseHTTPRequestHandler
from datetime import datetime, timedelta
import os
import jwt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Get JWT secret keys
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
JWT_SECRET_KEY = os.getenv("SECRET_KEY", "a-very-secret-key-should-be-replaced-in-production")

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
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Credentials', 'true')
    
    def send_json_response(self, response_data, status_code=200):
        """Helper to send JSON responses"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.handle_cors()
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode())
    
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.handle_cors()
        self.end_headers()
    
    def verify_token(self, token):
        """Verify JWT token from either Supabase or our backend"""
        if not token:
            return None
            
        # Try Supabase JWT first if configured
        if SUPABASE_JWT_SECRET:
            try:
                # Decode Supabase JWT
                payload = jwt.decode(
                    token,
                    SUPABASE_JWT_SECRET,
                    algorithms=["HS256"],
                    audience="authenticated"
                )
                
                # Extract user data
                user_id = payload.get("sub")
                # Custom user data is stored in the 'user_metadata' field
                user_metadata = payload.get("user_metadata", {})
                
                return {
                    "id": user_id,
                    "email": user_metadata.get("email"),
                    "username": user_metadata.get("email", user_id),
                }
            except Exception as e:
                logger.warning(f"Supabase token validation failed: {str(e)}")
        
        # Try our custom JWT as fallback
        try:
            payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
            username = payload.get("sub")
            if username:
                return {
                    "id": username,
                    "username": username,
                    "email": f"{username}@example.com",  # Placeholder
                }
        except Exception as e:
            logger.error(f"JWT validation error: {str(e)}")
            
        return None
    
    def do_GET(self):
        """Handle GET requests to the dashboard endpoint"""
        logger.info(f"Received GET request to dashboard: {self.path}")
        
        # Check for auth header
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            self.send_json_response({
                "status": "error",
                "message": "Unauthorized: Valid authentication token required"
            }, 401)
            return
        
        # Get token from header and verify
        token = auth_header.split(' ')[1]
        user_info = self.verify_token(token)
        
        if not user_info:
            self.send_json_response({
                "status": "error",
                "message": "Unauthorized: Invalid token"
            }, 401)
            return
        
        try:
            # Get user-specific data (in production this would query the database)
            document_stats = self.get_document_stats(user_info)
            recent_activities = self.get_recent_activities(user_info)
            documents_by_template = self.get_documents_by_template(user_info)
            
            # Combine all data into single response
            response_data = {
                "status": "success",
                "document_stats": document_stats,
                "recent_activities": recent_activities,
                "documents_by_template": documents_by_template
            }
            
            self.send_json_response(response_data)
        
        except Exception as e:
            logger.error(f"Error in dashboard endpoint: {str(e)}")
            self.send_json_response({
                "status": "error",
                "message": f"Internal server error: {str(e)}"
            }, 500)
    
    def get_document_stats(self, user_info):
        """Get document statistics (mock data for demo)"""
        # In a real implementation, query database for actual stats for this user
        # Using user_info['id'] or user_info['username'] to filter by user
        return {
            "total": 12,
            "completed": 8,
            "processing": 3,
            "failed": 1
        }
    
    def get_recent_activities(self, user_info):
        """Get recent document activities (mock data for demo)"""
        # In a real implementation, query database for activity log for this user
        now = datetime.now()
        
        return [
            {
                "id": "act1",
                "type": "creation",
                "document_name": "O-1 Visa Application",
                "timestamp": (now - timedelta(minutes=30)).isoformat()
            },
            {
                "id": "act2",
                "type": "update",
                "document_name": "Recommendation Letter",
                "timestamp": (now - timedelta(hours=2)).isoformat()
            },
            {
                "id": "act3",
                "type": "creation",
                "document_name": "Support Documentation",
                "timestamp": (now - timedelta(hours=5)).isoformat()
            },
            {
                "id": "act4",
                "type": "deletion",
                "document_name": "Draft Application",
                "timestamp": (now - timedelta(days=1)).isoformat()
            },
            {
                "id": "act5",
                "type": "update",
                "document_name": "O-1 Visa Application",
                "timestamp": (now - timedelta(days=2)).isoformat()
            }
        ]
    
    def get_documents_by_template(self, user_info):
        """Get document distribution by template (mock data for demo)"""
        # In a real implementation, query database for template usage for this user
        return [
            {
                "template_name": "O-1 Visa Application",
                "count": 5,
                "percentage": 41.7
            },
            {
                "template_name": "Recommendation Letter",
                "count": 4,
                "percentage": 33.3
            },
            {
                "template_name": "Support Documentation",
                "count": 3,
                "percentage": 25.0
            }
        ] 