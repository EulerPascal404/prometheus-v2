#!/usr/bin/env python3
import os
import logging
import shutil
import json
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Base directories
ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"
TRAINING_DIR = DATA_DIR / "training"

# Document types relevant to O-1 visa applications
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

# Subdirectories for training data
SUBDIRS = [
    "raw",           # Raw unprocessed documents
    "processed",     # Processed document data
    "synthetic",     # Synthetically generated data
    "model_output"   # Output from ML models
]

def create_directory_structure():
    """Create the directory structure for data collection and processing."""
    logger.info("Creating directory structure for data collection and processing")
    
    # Create main data directory if it doesn't exist
    DATA_DIR.mkdir(exist_ok=True)
    logger.info(f"Ensured data directory exists: {DATA_DIR}")
    
    # Create training directory
    TRAINING_DIR.mkdir(exist_ok=True)
    logger.info(f"Ensured training directory exists: {TRAINING_DIR}")
    
    # Create subdirectories
    for subdir in SUBDIRS:
        subdir_path = TRAINING_DIR / subdir
        subdir_path.mkdir(exist_ok=True)
        logger.info(f"Ensured subdirectory exists: {subdir_path}")
        
        # For raw, processed, and synthetic, create document type subdirectories
        if subdir in ["raw", "processed", "synthetic"]:
            for doc_type in DOCUMENT_TYPES:
                doc_type_path = subdir_path / doc_type
                doc_type_path.mkdir(exist_ok=True)
                logger.info(f"Ensured document type directory exists: {doc_type_path}")
    
    # Create an empty README file in each leaf directory
    for subdir in SUBDIRS:
        subdir_path = TRAINING_DIR / subdir
        
        if subdir in ["raw", "processed", "synthetic"]:
            for doc_type in DOCUMENT_TYPES:
                doc_type_path = subdir_path / doc_type
                readme_path = doc_type_path / "README.md"
                
                if not readme_path.exists():
                    with open(readme_path, 'w', encoding='utf-8') as f:
                        f.write(f"# {doc_type.capitalize()} {subdir.capitalize()} Data\n\n")
                        f.write(f"This directory contains {subdir} data for {doc_type} documents used in O-1 visa applications.\n")
                    logger.info(f"Created README file: {readme_path}")
        else:
            readme_path = subdir_path / "README.md"
            
            if not readme_path.exists():
                with open(readme_path, 'w', encoding='utf-8') as f:
                    f.write(f"# {subdir.capitalize()} Data\n\n")
                    f.write(f"This directory contains {subdir} data for O-1 visa applications.\n")
                logger.info(f"Created README file: {readme_path}")

def copy_sample_data():
    """Copy sample data files to the appropriate directories."""
    logger.info("Copying sample data files")
    
    # Check if sample O-1 form exists
    sample_o1 = ROOT_DIR / "sample-o1-application.pdf"
    if sample_o1.exists():
        target_path = TRAINING_DIR / "raw" / "o1" / "sample-o1-application.pdf"
        shutil.copy2(sample_o1, target_path)
        logger.info(f"Copied sample O-1 application to: {target_path}")
    else:
        logger.warning(f"Sample O-1 application not found at: {sample_o1}")
    
    # Check if O-1 form template exists
    o1_template = ROOT_DIR / "o1-form-template.pdf"
    if o1_template.exists():
        target_path = TRAINING_DIR / "raw" / "o1" / "o1-form-template.pdf"
        shutil.copy2(o1_template, target_path)
        logger.info(f"Copied O-1 form template to: {target_path}")
    else:
        logger.warning(f"O-1 form template not found at: {o1_template}")

def create_metadata_file():
    """Create a metadata file to track dataset information."""
    logger.info("Creating dataset metadata file")
    
    metadata = {
        "dataset_name": "O-1 Visa Application Dataset",
        "created_date": None,  # Will be filled in when actual data collection starts
        "document_types": DOCUMENT_TYPES,
        "counts": {
            "raw": {doc_type: 0 for doc_type in DOCUMENT_TYPES},
            "processed": {doc_type: 0 for doc_type in DOCUMENT_TYPES},
            "synthetic": {doc_type: 0 for doc_type in DOCUMENT_TYPES}
        },
        "version": "0.1",
        "description": "Dataset for training RL-based agentic swarms for O-1 visa applications"
    }
    
    # Write metadata file
    metadata_path = TRAINING_DIR / "metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Created dataset metadata file: {metadata_path}")

def main():
    """Main function to set up data directories and files."""
    logger.info("Starting data directory setup")
    
    # Create directory structure
    create_directory_structure()
    
    # Copy sample data
    copy_sample_data()
    
    # Create metadata file
    create_metadata_file()
    
    logger.info("Data directory setup complete")

if __name__ == "__main__":
    main() 