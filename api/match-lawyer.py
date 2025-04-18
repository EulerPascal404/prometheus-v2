from http.server import BaseHTTPRequestHandler
import json
import logging
import sys
import os
from openai import OpenAI

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Define a static lawyer database (copy from original index.py)
LAWYER_DB = [
    {
        "Name": "Robert K. D'Andrea",
        "Firm": "D'Andrea Law Corporation",
        "Law School": "Oklahoma City University, School of Law",
        "Bar Admissions": "District of Columbia",
        "Description": """
        D'Andrea Law Corporation is a Southern California immigration law firm with offices located in Pasadena and Glendora. We are committed to providing superior legal services with the experience and effectiveness of a large firm, while retaining the thoroughness and personal interaction of a boutique. Our clientele includes businesses, investors, families and individuals from all over the world.

        Our high rate of success is a result of extensive case experience, dedicated work ethic, exceptional problem solving capabilities, and authoritative contacts. We find immigration solutions where other law offices have failed.

        Robert K. D'Andrea has experience in all aspects of business, investment, employment, family and related immigration matters. Mr. D'Andrea has successfully represented thousands of employers, employees, investors, families, and other immigrant and nonimmigrant foreign nationals across the globe. He has counseled corporate clients in the health care, science, entertainment, technology, investment, communication, import/export, education, athletic, fine art, and manufacturing industries.
        """,
        "Address" : "510 S. Grand Ave Suite 203 Glendora, CA 91741 USA",
    },
    {
        "Name": "Joseph Tsang",
        "Firm": "Tsang & Associates, PLC",
        "Law School": "Pepperdine University, Caruso School of Law",
        "Bar Admissions": "California",
        "Description": """
        At Tsang & Associates, we represent individuals and companies in their immigration, family, and business legal needs.

        Our mission is to provide both breadth of services and depth of expertise with efficiency and professionalism.

        With offices in Los Angeles, Taipei, and Shanghai, our team has been helping clients internationally since 1985.

        As a family-owned international law firm, our home is your home. Just like family, we're constantly striving to provide you with the best legal experience. We focus on transparency and individual communication to provide you with peace of mind at every stage.
        """,
        "Address" : "18830 Norwalk Blvd Artesia, CA 90701 USA",
    },
    {
        "Name" : "Martin F. Breznick",
        "Firm" : "Breznick & Cavallo, P.C.",
        "Law School" : "Western New England University Law School",
        "Bar Admissions" : "New Jersey",
        "Description" : """
        My firm provides individualized service to clients. You will always be able to speak with an attorney - either myself or my partner, John Cavallo (who speaks Spanish and Italian). I have been practicing immigration law since 1977 and have a great deal of experience with the many minefields presented by the practice of immigration and nationality law.
        """,
        "Address" : "Breznick & Cavallo, P.C. 630 9th Avenue Suite 405 New York, NY 10036 USA",
    }
]

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
        logger.info("Received POST request to match-lawyer")
        
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            post_data = self.rfile.read(content_length)
            try:
                request_data = json.loads(post_data.decode('utf-8'))
                logger.info(f"POST request data received: {len(str(request_data))} bytes")
            except Exception as e:
                logger.error(f"Error parsing JSON: {str(e)}")
                request_data = {}
        else:
            request_data = {}
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
        
        # Extract request data
        user_id = request_data.get("user_id")
        uploaded_documents = request_data.get("uploaded_documents", {})
        document_summaries = request_data.get("document_summaries", {})
        additional_info = request_data.get("additional_info", {})

        # Validate required fields
        if not all([user_id, uploaded_documents, document_summaries]):
            response = {
                "status": "error",
                "message": "Missing required fields"
            }
            self.wfile.write(json.dumps(response).encode())
            return
        
        try:
            # Get all summaries from the document summaries
            all_summaries = []
            for doc_type, doc_info in document_summaries.items():
                if isinstance(doc_info, dict) and 'summary' in doc_info:
                    all_summaries.append(doc_info['summary'])
            
            # Add additional information to the text being analyzed
            additional_text = f"\nClient Address: {additional_info.get('address', '')}\nAdditional Comments: {additional_info.get('additional_comments', '')}"
            all_summaries.append(additional_text)
            
            if not all_summaries:
                response = {
                    "status": "error",
                    "message": "No document summaries provided"
                }
                self.wfile.write(json.dumps(response).encode())
                return
            
            # Combine all summaries into one text
            user_text = " ".join(all_summaries)
            
            # Use OpenAI to help match lawyer instead of embeddings
            openai_api_key = os.environ.get("OPENAI_API_KEY")
            if not openai_api_key:
                logger.error("Missing OPENAI_API_KEY environment variable")
                # Fall back to simple matching if OpenAI is not available
                best_match = LAWYER_DB[0]
                match_score = 0.7
            else:
                try:
                    # Initialize OpenAI client
                    client = OpenAI(api_key=openai_api_key)
                    
                    # For each lawyer, use OpenAI to determine match score
                    lawyer_scores = []
                    
                    for lawyer in LAWYER_DB:
                        # Create prompt for OpenAI
                        lawyer_info = f"""
                        Lawyer: {lawyer['Name']}
                        Firm: {lawyer['Firm']}
                        Law School: {lawyer['Law School']}
                        Bar Admissions: {lawyer['Bar Admissions']}
                        Description: {lawyer['Description']}
                        Address: {lawyer['Address']}
                        """
                        
                        prompt = f"""
                        You are an expert in matching immigration lawyers to clients based on their needs.
                        
                        Client information:
                        {user_text[:3000]}  # Limiting to 3000 chars to avoid token limits
                        
                        Lawyer information:
                        {lawyer_info}
                        
                        On a scale of 0 to 100, how well does this lawyer match the client's needs?
                        Consider factors like specialization, geographic location, and expertise.
                        Return only a number representing the match percentage.
                        """
                        
                        # Get match score from OpenAI
                        response = client.chat.completions.create(
                            model="gpt-3.5-turbo",  # Using 3.5 to save on cost for this simple task
                            messages=[
                                {"role": "system", "content": "You are a lawyer matching assistant. Only respond with a number from 0-100."},
                                {"role": "user", "content": prompt}
                            ],
                            max_tokens=10  # Short response needed
                        )
                        
                        # Extract the score
                        score_text = response.choices[0].message.content.strip()
                        try:
                            # Try to extract just a number
                            score = float(''.join(c for c in score_text if c.isdigit() or c == '.'))
                            if score > 100:
                                score = 100
                        except:
                            # Default score if parsing fails
                            score = 50
                        
                        lawyer_scores.append({
                            "lawyer": lawyer,
                            "score": score
                        })
                    
                    # Sort by score and get best match
                    lawyer_scores.sort(key=lambda x: x["score"], reverse=True)
                    best_match = lawyer_scores[0]["lawyer"]
                    match_score = min(0.99, lawyer_scores[0]["score"] / 100)  # Scale to 0-1
                    
                except Exception as e:
                    logger.error(f"Error using OpenAI for matching: {str(e)}")
                    # Fall back to first lawyer if OpenAI fails
                    best_match = LAWYER_DB[0]
                    match_score = 0.7
            
            # Return the best match
            response = {
                "name": best_match["Name"],
                "firm": best_match["Firm"],
                "law_school": best_match["Law School"],
                "bar_admissions": best_match["Bar Admissions"],
                "description": best_match["Description"],
                "address": best_match["Address"],
                "match_score": match_score
            }
            
            logger.info(f"Returning lawyer match for user {user_id}: {best_match['Name']}")
            self.wfile.write(json.dumps(response).encode())
            
        except Exception as e:
            logger.error(f"Error in lawyer matching: {str(e)}")
            response = {
                "status": "error",
                "message": f"Error matching lawyer: {str(e)}"
            }
            self.wfile.write(json.dumps(response).encode()) 