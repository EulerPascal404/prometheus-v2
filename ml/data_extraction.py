#!/usr/bin/env python3
import os
import sys
import json
import logging
import tempfile
import re
import PyPDF2
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from io import BytesIO

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
            
    def extract_text_from_pdf(self, file_content: bytes) -> Tuple[str, int]:
        """Extract text from a PDF file.
        
        Args:
            file_content: PDF file content in bytes
            
        Returns:
            Tuple of (extracted text, number of pages)
        """
        # Save the PDF content to a temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        try:
            # Extract text using PyPDF2
            text_content = []
            with open(tmp_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                total_pages = len(pdf_reader.pages)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    try:
                        text = page.extract_text()
                        # Ensure text is a string and not empty
                        if isinstance(text, str) and text.strip():
                            text_content.append(text)
                        elif isinstance(text, list):
                            # If text is a list, join it with spaces
                            text = ' '.join(str(item) for item in text if item)
                            if text.strip():
                                text_content.append(text)
                    except Exception as e:
                        logger.error(f"Error extracting text from page {page_num + 1}: {str(e)}")
                        continue

            # Clean up temporary file
            os.unlink(tmp_path)

            # Join all text content and ensure it's a string
            full_text = "\n".join(text_content) if text_content else ""
            return full_text, total_pages
            
        except Exception as e:
            logger.error(f"Error during text extraction: {str(e)}")
            # Clean up temporary file if an exception occurred
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
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
        
        # Detect language
        extracted_fields["language"] = self._detect_language(text)
        
        if doc_type == "resume":
            # Extract common resume fields
            extracted_fields.update(self._extract_resume_fields(text))
        elif doc_type == "recommendations":
            # Extract recommendation fields
            extracted_fields.update(self._extract_recommendation_fields(text))
        elif doc_type in ["i129", "o1"]:
            # Extract form fields - these will be mostly empty for now
            # Later RL agents will learn to fill these
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
        
        # For more complex fields like education and experience, we would need more sophisticated extraction
        # or use LLMs for assistance. This is a simplified version.
        
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
        
        This is mostly placeholder as these will be populated by the RL agents later.
        
        Args:
            text: The form text
            doc_type: Form type
            
        Returns:
            Dictionary of form fields
        """
        # For now, just identify if this is an O-1 form
        is_o1 = "O-1" in text or "extraordinary ability" in text.lower()
        
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
        # Create a basic extraction of key information for future RL training
        form_content = {
            "personal_info": {},
            "employer_info": {},
            "petition_info": {}
        }
        
        # Extract basic name information if present
        name_match = re.search(r'(?i)name\s*:\s*([A-Za-z\s]+)', text)
        if name_match:
            form_content["personal_info"]["name"] = name_match.group(1).strip()
        
        # Extract basic employer information if present
        employer_match = re.search(r'(?i)employer\s*:\s*([A-Za-z0-9\s,\.]+)', text)
        if employer_match:
            form_content["employer_info"]["employer_name"] = employer_match.group(1).strip()
        
        # Extract dates if present
        date_matches = re.findall(r'\b\d{1,2}/\d{1,2}/\d{2,4}\b', text)
        if date_matches:
            form_content["dates"] = date_matches
        
        return form_content
    
    def process_document(self, file_content: bytes, doc_type: str, metadata: Dict = None) -> Dict[str, Any]:
        """Process a document and extract its data.
        
        Args:
            file_content: The document content as bytes
            doc_type: Type of document (resume, recommendations, etc.)
            metadata: Additional metadata about the document
            
        Returns:
            Dictionary of extracted information
        """
        # Extract text from the document
        text, page_count = self.extract_text_from_pdf(file_content)
        
        # If extraction failed, return error
        if not text:
            return {
                "error": "Failed to extract text from document",
                "doc_type": doc_type,
                "page_count": 0,
                "metadata": metadata or {}
            }
        
        # Extract fields from the text
        extracted_data = self.extract_fields_from_text(text, doc_type)
        
        # Add metadata and page count
        extracted_data["page_count"] = page_count
        if metadata:
            extracted_data["metadata"] = metadata
            
        # Generate a unique ID for this document
        doc_id = str(uuid.uuid4())
        extracted_data["doc_id"] = doc_id
        
        # Save to file if output directory exists
        output_path = os.path.join(self.output_dir, doc_type, f"{doc_id}.json")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(extracted_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Processed {doc_type} document with {page_count} pages. Saved to {output_path}")
        
        return extracted_data
    
    def process_batch(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process a batch of documents.
        
        Args:
            documents: List of document dictionaries, each containing:
                - file_content: bytes
                - doc_type: str
                - metadata: Dict (optional)
                
        Returns:
            List of processing results
        """
        results = []
        
        for doc in documents:
            file_content = doc.get("file_content")
            doc_type = doc.get("doc_type")
            metadata = doc.get("metadata", {})
            
            if not file_content or not doc_type:
                results.append({
                    "error": "Missing required fields (file_content or doc_type)",
                    "doc_type": doc_type,
                    "metadata": metadata
                })
                continue
                
            result = self.process_document(file_content, doc_type, metadata)
            results.append(result)
            
        return results

# If running directly, show usage example
if __name__ == "__main__":
    print("O-1 Visa Application Data Extractor")
    print("Usage example:")
    print("  extractor = DataExtractor()")
    print("  result = extractor.process_document(file_content, 'resume')") 