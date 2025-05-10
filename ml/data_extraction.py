#!/usr/bin/env python3
import os
import sys
import json
import logging
import re
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from io import BytesIO

# Add the parent directory to the path to import from api
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import functions from validate-documents.py
from api.validate_documents import (
    process_pdf_content,
    get_supabase,
    parse_summary,
    merge_dicts,
    calculate_field_statistics
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Types of documents relevant to O-1 visa applications
DOCUMENT_TYPES = [
    "resume", 
    "recommendations", 
    "awards", 
    "publications", 
    "salary", 
    "memberships", 
    "o1",
    "i129"
]

class DataExtractor:
    """Extract and standardize data from O-1 visa application documents"""
    
    def __init__(self, output_dir: str = "data/training/processed"):
        """Initialize the data extractor.
        
        Args:
            output_dir: Directory to save processed data
        """
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        logger.info(f"Data will be saved to: {output_dir}")
        
        # Create subdirectories for each document type
        for doc_type in DOCUMENT_TYPES:
            os.makedirs(os.path.join(output_dir, doc_type), exist_ok=True)
        
        # Initialize Supabase client (if available)
        self.supabase = get_supabase()
            
    def extract_text_from_pdf(self, file_content: bytes) -> Tuple[str, int]:
        """Extract text from a PDF file.
        
        Args:
            file_content: PDF file content in bytes
            
        Returns:
            Tuple of (extracted text, number of pages)
        """
        # Use the PDF processing function from validate-documents.py
        result = process_pdf_content(file_content, "generic", None, None)
        
        # Extract the needed information from the result
        if result and "extracted_text" in result:
            full_text = result["extracted_text"]
            total_pages = result.get("pages", 0)
            return full_text, total_pages
        else:
            logger.error("Error extracting text from PDF")
            return "", 0
    
    def extract_fields_from_text(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract key fields from text based on document type.
        
        Args:
            text: The extracted text from the document
            doc_type: Type of document being processed
            
        Returns:
            Dictionary of extracted fields
        """
        extracted_fields = {
            "doc_type": doc_type,
            "extraction_date": datetime.now().isoformat(),
            "full_text": text
        }
        
        try:
            # Use OpenAI processing from validate-documents.py for a more comprehensive analysis
            result = process_pdf_content(text.encode('utf-8'), doc_type, None, None)
            
            if result and "strengths" in result:
                # Include the summary analysis in the extracted fields
                extracted_fields["strengths"] = result["strengths"]
                extracted_fields["weaknesses"] = result["weaknesses"]
                extracted_fields["recommendations"] = result["recommendations"]
                extracted_fields["summary"] = result.get("summary", "")
            
                # Extract language from the summary
                extracted_fields["language"] = self._detect_language(text)
                
                # Add specific extraction based on document type
                if doc_type == "resume":
                    extracted_fields.update(self._extract_resume_fields(text))
                elif doc_type == "recommendations":
                    extracted_fields.update(self._extract_recommendation_fields(text))
                elif doc_type in ["i129", "o1"]:
                    extracted_fields.update(self._extract_form_fields(text, doc_type))
        except Exception as e:
            logger.error(f"Error extracting fields from text: {str(e)}")
            # Fall back to basic extraction if OpenAI processing fails
            extracted_fields["language"] = self._detect_language(text)
            
            if doc_type == "resume":
                extracted_fields.update(self._extract_resume_fields(text))
            elif doc_type == "recommendations":
                extracted_fields.update(self._extract_recommendation_fields(text))
            elif doc_type in ["i129", "o1"]:
                extracted_fields.update(self._extract_form_fields(text, doc_type))
        
        return extracted_fields
    
    def _detect_language(self, text: str) -> str:
        """Simple language detection (English vs non-English).
        
        Args:
            text: Text to analyze
            
        Returns:
            Detected language code
        """
        # Count common English words
        english_words = ["the", "and", "to", "of", "in", "is", "with", "for", "this", "that"]
        word_count = sum(1 for word in english_words if f" {word} " in f" {text.lower()} ")
        
        # If at least 3 common English words are found, assume it's English
        return "en" if word_count >= 3 else "unknown"
    
    def _extract_resume_fields(self, text: str) -> Dict[str, Any]:
        """Extract key fields from a resume.
        
        Args:
            text: The resume text
            
        Returns:
            Dictionary of resume fields
        """
        fields = {
            "name": None,
            "email": None,
            "phone": None,
            "location": None,
            "education": [],
            "experience": [],
            "skills": []
        }
        
        # Basic email extraction
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        if email_match:
            fields["email"] = email_match.group(0)
        
        # Basic phone extraction
        phone_match = re.search(r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
        if phone_match:
            fields["phone"] = phone_match.group(0)
        
        # Simple skill extraction (look for skill sections)
        skills_section = re.search(r'(?i)skills?[\s\n:]+(.*?)(?:\n\n|\Z)', text, re.DOTALL)
        if skills_section:
            # Extract individual skills
            skills_text = skills_section.group(1)
            # Split by common separators
            skills = re.split(r'[,•\n]', skills_text)
            fields["skills"] = [skill.strip() for skill in skills if skill.strip()]
        
        return fields
    
    def _extract_recommendation_fields(self, text: str) -> Dict[str, Any]:
        """Extract key fields from a recommendation letter.
        
        Args:
            text: The recommendation letter text
            
        Returns:
            Dictionary of recommendation fields
        """
        fields = {
            "recommender_name": None,
            "recommender_title": None,
            "recommender_organization": None,
            "recommendation_date": None,
            "relationship": None,
            "key_points": []
        }
        
        # Extract date
        date_match = re.search(r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b', text)
        if date_match:
            fields["recommendation_date"] = date_match.group(0)
        
        # Extract simple relationship context if present
        relationship_match = re.search(r'(?i)(worked with|supervised|mentored|collaborated|professor|advisor|manager)[\s\w]{1,30}(for|over|during)[\s\w]{1,15}(\d+\s+\w+)', text)
        if relationship_match:
            fields["relationship"] = relationship_match.group(0)
        
        return fields
    
    def _extract_form_fields(self, text: str, doc_type: str) -> Dict[str, Any]:
        """Extract form fields from I-129 or O-1 forms.
        
        Args:
            text: The form text
            doc_type: Form type
            
        Returns:
            Dictionary of form fields
        """
        # Check if this is an O-1 form
        is_o1 = "O-1" in text or "extraordinary ability" in text.lower()
        
        # For O-1 forms, try to use the write_rag_responses function from validate-documents.py
        try:
            # Import write_rag_responses from validate-documents.py if not already imported
            from api.validate_documents import write_rag_responses
            
            # Use write_rag_responses to get form field values
            response_dict = write_rag_responses(
                extra_info="You're analyzing a form document.",
                extracted_text=text
            )
            
            # If we got a response, return it
            if response_dict:
                return {
                    "form_type": "O-1" if is_o1 else doc_type.upper(),
                    "form_fields": response_dict,
                    "raw_text": text,
                    "form_content": self._extract_simple_form_content(text)
                }
        except Exception as e:
            logger.error(f"Error using write_rag_responses: {str(e)}")
        
        # Fallback to simple extraction
        return {
            "form_type": "O-1" if is_o1 else doc_type.upper(),
            "raw_text": text,
            "form_content": self._extract_simple_form_content(text)
        }
    
    def _extract_simple_form_content(self, text: str) -> Dict[str, Any]:
        """Extract simple form content using regex patterns.
        
        Args:
            text: Form text content
            
        Returns:
            Dictionary of extracted content
        """
        form_content = {}
        
        # Try to extract name fields
        name_match = re.search(r'(?i)name:?\s*([A-Za-z\s\-\']{2,50})', text)
        if name_match:
            form_content["name"] = name_match.group(1).strip()
        
        # Try to extract dates
        date_match = re.search(r'(?i)date:?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
        if date_match:
            form_content["date"] = date_match.group(1).strip()
        
        # Try to extract IDs
        id_match = re.search(r'(?i)(?:id|identification|case) number:?\s*([A-Z0-9\-]{4,20})', text)
        if id_match:
            form_content["id_number"] = id_match.group(1).strip()
        
        return form_content
    
    def process_document(self, file_content: bytes, doc_type: str, metadata: Dict = None) -> Dict[str, Any]:
        """Process a document and extract structured data.
        
        Args:
            file_content: Document file content in bytes
            doc_type: Type of document
            metadata: Additional metadata about the document
            
        Returns:
            Dictionary of extracted data and metadata
        """
        result = {
            "doc_id": str(uuid.uuid4()),
            "doc_type": doc_type,
            "processing_date": datetime.now().isoformat(),
            "metadata": metadata or {}
        }
        
        try:
            # Use the process_pdf_content function directly from validate-documents.py
            processed_result = process_pdf_content(file_content, doc_type, None, self.supabase)
            
            if processed_result and "extracted_text" in processed_result:
                # Store the results from process_pdf_content
                result.update({
                    "summary": processed_result.get("summary", ""),
                    "pages": processed_result.get("pages", 0),
                    "processed": processed_result.get("processed", False),
                    "text_preview": processed_result.get("text_preview", ""),
                    "strengths": processed_result.get("strengths", []),
                    "weaknesses": processed_result.get("weaknesses", []),
                    "recommendations": processed_result.get("recommendations", [])
                })
                
                # Extract text using our helper method (which now uses validate-documents.py)
                full_text = processed_result["extracted_text"]
                
                # Extract fields from the text
                fields = self.extract_fields_from_text(full_text, doc_type)
                result.update(fields)
                
                # Save the processed data to a file
                output_file = os.path.join(self.output_dir, doc_type, f"{result['doc_id']}.json")
                with open(output_file, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                
                logger.info(f"Saved processed data to: {output_file}")
            else:
                result["error"] = "Failed to extract text from document"
        except Exception as e:
            logger.error(f"Error processing document: {str(e)}")
            result["error"] = str(e)
        
        return result
    
    def process_batch(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a batch of documents.
        
        Args:
            documents: List of dictionaries with keys:
                - file_content: Document file content in bytes
                - doc_type: Type of document
                - metadata: (Optional) Additional metadata
                
        Returns:
            List of processing results
        """
        results = []
        
        for doc_data in documents:
            file_content = doc_data["file_content"]
            doc_type = doc_data["doc_type"]
            metadata = doc_data.get("metadata", {})
            
            result = self.process_document(file_content, doc_type, metadata)
            results.append(result)
        
        return results

# If running directly, show usage example
if __name__ == "__main__":
    print("O-1 Visa Application Data Extractor")
    print("Usage example:")
    print("  extractor = DataExtractor()")
    print("  result = extractor.process_document(file_content, 'resume')") 