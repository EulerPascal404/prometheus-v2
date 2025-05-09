#!/usr/bin/env python3
"""
Synthetic data generator for O-1 visa applications.

This module provides classes and functions for generating synthetic data
for training RL-based agents on O-1 visa application form filling.
"""

import os
import sys
import json
import random
import logging
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Root directory for saving synthetic data
ROOT_DIR = Path(__file__).resolve().parent.parent
SYNTHETIC_DIR = ROOT_DIR / "data" / "training" / "synthetic"

class SyntheticDataGenerator:
    """Base class for generating synthetic data for O-1 visa applications."""
    
    def __init__(self, output_dir: Optional[str] = None):
        """Initialize the synthetic data generator.
        
        Args:
            output_dir: Directory to save synthetic data (defaults to data/training/synthetic)
        """
        self.output_dir = Path(output_dir) if output_dir else SYNTHETIC_DIR
        os.makedirs(self.output_dir, exist_ok=True)
        logger.info(f"Synthetic data will be saved to: {self.output_dir}")
        
    def generate_synthetic_document(self, doc_type: str, complexity: str = "medium") -> Dict[str, Any]:
        """Generate a synthetic document of the specified type.
        
        Args:
            doc_type: Type of document to generate (resume, o1, i129, etc.)
            complexity: Complexity level of the generated document (simple, medium, complex)
            
        Returns:
            Dictionary containing the synthetic document data
        """
        if doc_type == "resume":
            return self._generate_resume(complexity)
        elif doc_type == "recommendations":
            return self._generate_recommendation_letter(complexity)
        elif doc_type == "awards":
            return self._generate_award_certificate(complexity)
        elif doc_type == "o1":
            return self._generate_o1_form(complexity)
        elif doc_type == "i129":
            return self._generate_i129_form(complexity)
        else:
            raise ValueError(f"Unsupported document type: {doc_type}")
    
    def _generate_resume(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic resume.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic resume data
        """
        # This is a placeholder - subclasses should implement this
        raise NotImplementedError("Subclasses must implement _generate_resume")
    
    def _generate_recommendation_letter(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic recommendation letter.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic recommendation letter data
        """
        # This is a placeholder - subclasses should implement this
        raise NotImplementedError("Subclasses must implement _generate_recommendation_letter")
    
    def _generate_award_certificate(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic award certificate.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic award certificate data
        """
        # This is a placeholder - subclasses should implement this
        raise NotImplementedError("Subclasses must implement _generate_award_certificate")
    
    def _generate_o1_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic O-1 form data.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic O-1 form data
        """
        # This is a placeholder - subclasses should implement this
        raise NotImplementedError("Subclasses must implement _generate_o1_form")
    
    def _generate_i129_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic I-129 form data.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic I-129 form data
        """
        # This is a placeholder - subclasses should implement this
        raise NotImplementedError("Subclasses must implement _generate_i129_form")
    
    def save_synthetic_document(self, doc_data: Dict[str, Any], doc_type: str) -> str:
        """Save a synthetic document to the output directory.
        
        Args:
            doc_data: Document data to save
            doc_type: Type of document
            
        Returns:
            Path to the saved document
        """
        # Ensure the document has an ID
        if "doc_id" not in doc_data:
            doc_data["doc_id"] = str(uuid.uuid4())
        
        # Add generation metadata
        doc_data["generated_date"] = datetime.now().isoformat()
        doc_data["generator_version"] = "0.1"
        
        # Create output directory if it doesn't exist
        doc_type_dir = self.output_dir / doc_type
        os.makedirs(doc_type_dir, exist_ok=True)
        
        # Save to file
        output_path = doc_type_dir / f"{doc_data['doc_id']}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(doc_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved synthetic {doc_type} to {output_path}")
        return str(output_path)
    
    def generate_batch(self, doc_type: str, count: int, complexity: str = "medium") -> List[str]:
        """Generate a batch of synthetic documents.
        
        Args:
            doc_type: Type of documents to generate
            count: Number of documents to generate
            complexity: Complexity level
            
        Returns:
            List of paths to the generated documents
        """
        paths = []
        for i in range(count):
            try:
                doc_data = self.generate_synthetic_document(doc_type, complexity)
                path = self.save_synthetic_document(doc_data, doc_type)
                paths.append(path)
                logger.info(f"Generated synthetic document {i+1}/{count}")
            except Exception as e:
                logger.error(f"Error generating document {i+1}/{count}: {str(e)}")
        
        return paths

# For testing
if __name__ == "__main__":
    print("Base synthetic data generator. This class should be subclassed.")
    print("See rule_based_generator.py and rl_based_generator.py for implementations.") 