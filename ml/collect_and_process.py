#!/usr/bin/env python3
"""
Data collection and processing pipeline for O-1 visa applications.

This script orchestrates the entire data collection and processing pipeline:
1. Sets up directory structure
2. Collects raw data files
3. Processes raw files and extracts structured data
4. Creates standardized dataset for training

Run this script to initialize and process data for ML training.
"""

import os
import sys
import logging
import argparse
import json
from pathlib import Path
from datetime import datetime
import shutil

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(f"ml_data_processing_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log")
    ]
)
logger = logging.getLogger(__name__)

# Add project root to path to allow imports
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

# Import our custom modules
from ml.setup_data_dirs import main as setup_directories
from ml.data_extraction import DataExtractor

# Import functions from validate-documents.py
try:
    from api.validate_documents import (
        process_pdf_content,
        get_supabase,
        parse_summary,
        calculate_field_statistics
    )
    logger.info("Successfully imported functions from validate-documents.py")
except ImportError as e:
    logger.warning(f"Could not import functions from validate-documents.py: {e}")
    logger.warning("Will fall back to local implementation")

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Data collection and processing pipeline for O-1 visa applications")
    
    parser.add_argument(
        "--setup-only", 
        action="store_true",
        help="Only set up directory structure without processing data"
    )
    
    parser.add_argument(
        "--raw-dir", 
        type=str,
        default=str(ROOT_DIR / "data" / "training" / "raw"),
        help="Directory containing raw data files"
    )
    
    parser.add_argument(
        "--processed-dir",
        type=str,
        default=str(ROOT_DIR / "data" / "training" / "processed"),
        help="Directory to store processed data files"
    )
    
    parser.add_argument(
        "--document-types",
        type=str,
        nargs="+",
        default=None,
        help="Document types to process (default: all)"
    )
    
    return parser.parse_args()

def collect_raw_files(raw_dir, document_types=None):
    """
    Collect raw files from the raw data directory.
    
    Args:
        raw_dir: Directory containing raw data files
        document_types: List of document types to process (None for all)
        
    Returns:
        Dictionary mapping document types to lists of file paths
    """
    raw_dir = Path(raw_dir)
    
    if not raw_dir.exists():
        logger.error(f"Raw data directory does not exist: {raw_dir}")
        return {}
    
    # If document_types is None, use all subdirectories
    if document_types is None:
        document_types = [d.name for d in raw_dir.iterdir() if d.is_dir()]
    
    # Collect files for each document type
    files_by_type = {}
    for doc_type in document_types:
        doc_type_dir = raw_dir / doc_type
        
        if not doc_type_dir.exists():
            logger.warning(f"Document type directory does not exist: {doc_type_dir}")
            continue
        
        # Collect PDF files
        pdf_files = list(doc_type_dir.glob("*.pdf"))
        
        if not pdf_files:
            logger.warning(f"No PDF files found in: {doc_type_dir}")
            continue
        
        files_by_type[doc_type] = pdf_files
        logger.info(f"Found {len(pdf_files)} PDF files for document type: {doc_type}")
    
    return files_by_type

def process_raw_files(files_by_type, processed_dir):
    """
    Process raw files and extract structured data.
    
    Args:
        files_by_type: Dictionary mapping document types to lists of file paths
        processed_dir: Directory to store processed data files
        
    Returns:
        Dictionary mapping document types to lists of processed file paths
    """
    processed_dir = Path(processed_dir)
    
    # Initialize DataExtractor (now leverages validate-documents.py functionality)
    extractor = DataExtractor(output_dir=str(processed_dir))
    
    # Get Supabase client (optional, for enhanced processing)
    supabase = None
    try:
        from api.validate_documents import get_supabase
        supabase = get_supabase()
        if supabase:
            logger.info("Successfully connected to Supabase")
        else:
            logger.info("Supabase client not available - some features will be limited")
    except ImportError:
        logger.info("Supabase functionality not available - will use local processing only")
    
    # Initialize statistics
    stats = {
        "total_files": 0,
        "processed_files": 0,
        "failed_files": 0,
        "by_type": {}
    }
    
    # Process each document type
    processed_files_by_type = {}
    for doc_type, file_paths in files_by_type.items():
        logger.info(f"Processing {len(file_paths)} files for document type: {doc_type}")
        
        # Initialize stats for this document type
        stats["by_type"][doc_type] = {
            "total": len(file_paths),
            "processed": 0,
            "failed": 0
        }
        stats["total_files"] += len(file_paths)
        
        processed_files = []
        
        for file_path in file_paths:
            try:
                # Read file
                with open(file_path, 'rb') as f:
                    file_content = f.read()
                
                # Process file with metadata
                metadata = {
                    "original_filename": file_path.name,
                    "original_path": str(file_path),
                    "processing_date": datetime.now().isoformat()
                }
                
                # Use our enhanced process_document method that leverages validate-documents.py
                result = extractor.process_document(file_content, doc_type, metadata)
                
                if "error" in result:
                    logger.warning(f"Failed to process file: {file_path}")
                    logger.warning(f"Error: {result['error']}")
                    stats["by_type"][doc_type]["failed"] += 1
                    stats["failed_files"] += 1
                else:
                    logger.info(f"Successfully processed file: {file_path}")
                    processed_files.append(result["doc_id"])
                    stats["by_type"][doc_type]["processed"] += 1
                    stats["processed_files"] += 1
                    
                    # Calculate field statistics if applicable (for form documents)
                    if doc_type in ["o1", "i129"] and "form_fields" in result:
                        try:
                            # Use calculate_field_statistics from validate-documents.py
                            field_stats = calculate_field_statistics(result.get("form_fields", {}))
                            
                            # Add field stats to the result file
                            result_file = os.path.join(processed_dir, doc_type, f"{result['doc_id']}.json")
                            if os.path.exists(result_file):
                                with open(result_file, 'r', encoding='utf-8') as f:
                                    result_data = json.load(f)
                                
                                result_data["field_stats"] = field_stats
                                
                                with open(result_file, 'w', encoding='utf-8') as f:
                                    json.dump(result_data, f, indent=2, ensure_ascii=False)
                                
                                logger.info(f"Added field statistics to: {result_file}")
                        except Exception as stats_error:
                            logger.error(f"Error calculating field statistics: {stats_error}")
            
            except Exception as e:
                logger.error(f"Error processing file: {file_path}")
                logger.error(f"Exception: {str(e)}")
                stats["by_type"][doc_type]["failed"] += 1
                stats["failed_files"] += 1
        
        processed_files_by_type[doc_type] = processed_files
    
    # Write statistics
    stats_file = processed_dir.parent / "processing_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Processing complete. Total: {stats['total_files']}, Processed: {stats['processed_files']}, Failed: {stats['failed_files']}")
    
    return processed_files_by_type

def update_metadata(processed_files_by_type):
    """
    Update dataset metadata with processing results.
    
    Args:
        processed_files_by_type: Dictionary mapping document types to lists of processed file paths
    """
    metadata_path = ROOT_DIR / "data" / "training" / "metadata.json"
    
    if not metadata_path.exists():
        logger.warning(f"Metadata file does not exist: {metadata_path}")
        return
    
    try:
        # Read existing metadata
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        # Update counts
        for doc_type, file_ids in processed_files_by_type.items():
            if doc_type in metadata["counts"]["processed"]:
                metadata["counts"]["processed"][doc_type] += len(file_ids)
        
        # Update creation date if not set
        if metadata["created_date"] is None:
            metadata["created_date"] = datetime.now().isoformat()
        
        # Write updated metadata
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Updated dataset metadata: {metadata_path}")
    
    except Exception as e:
        logger.error(f"Error updating metadata: {str(e)}")

def main():
    """Main function to run the data collection and processing pipeline."""
    args = parse_args()
    
    logger.info("Starting data collection and processing pipeline")
    
    # Set up directory structure
    logger.info("Setting up directory structure")
    setup_directories()
    
    # If setup only, exit
    if args.setup_only:
        logger.info("Setup complete. Exiting as requested.")
        return
    
    # Collect raw files
    logger.info(f"Collecting raw files from: {args.raw_dir}")
    files_by_type = collect_raw_files(args.raw_dir, args.document_types)
    
    if not files_by_type:
        logger.warning("No files found to process. Exiting.")
        return
    
    # Process raw files
    logger.info(f"Processing files and saving to: {args.processed_dir}")
    processed_files_by_type = process_raw_files(files_by_type, args.processed_dir)
    
    # Update metadata
    logger.info("Updating dataset metadata")
    update_metadata(processed_files_by_type)
    
    logger.info("Data collection and processing pipeline complete")

if __name__ == "__main__":
    main() 