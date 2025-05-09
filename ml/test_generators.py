#!/usr/bin/env python3
"""
Simple test script for generators.

This script tests the rule-based and RL-based generators to ensure they work properly.
"""

import os
import sys
import json
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the project root to the path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

# Import generators
from ml.synthetic_data_generator import SyntheticDataGenerator
from ml.rule_based_generator import RuleBasedGenerator
from ml.rl_based_generator import RLBasedGenerator

def test_rule_based_generator():
    """Test the rule-based generator."""
    logger.info("Testing rule-based generator...")
    
    # Create output directory
    output_dir = ROOT_DIR / "data" / "training" / "synthetic" / "test_rule_based"
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize generator
    generator = RuleBasedGenerator(output_dir=str(output_dir))
    
    # Generate a test resume
    logger.info("Generating test resume...")
    resume = generator.generate_synthetic_document("resume", "medium")
    resume_path = generator.save_synthetic_document(resume, "resume")
    logger.info(f"Resume saved to: {resume_path}")
    
    # Generate a test recommendation letter
    logger.info("Generating test recommendation letter...")
    recommendation = generator.generate_synthetic_document("recommendations", "medium")
    recommendation_path = generator.save_synthetic_document(recommendation, "recommendations")
    logger.info(f"Recommendation letter saved to: {recommendation_path}")
    
    # Generate a test award
    logger.info("Generating test award certificate...")
    award = generator.generate_synthetic_document("awards", "medium")
    award_path = generator.save_synthetic_document(award, "awards")
    logger.info(f"Award certificate saved to: {award_path}")
    
    # Generate a test O-1 form
    logger.info("Generating test O-1 form...")
    o1_form = generator.generate_synthetic_document("o1", "medium")
    o1_path = generator.save_synthetic_document(o1_form, "o1")
    logger.info(f"O-1 form saved to: {o1_path}")
    
    logger.info("Rule-based generator test completed successfully!")

def test_rl_based_generator():
    """Test the RL-based generator."""
    logger.info("Testing RL-based generator...")
    
    # Create output directory
    output_dir = ROOT_DIR / "data" / "training" / "synthetic" / "test_rl_based"
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize generator
    generator = RLBasedGenerator(output_dir=str(output_dir))
    
    # Train the generator (minimal training for testing)
    logger.info("Training RL agents...")
    generator.train(episodes=5)
    
    # Generate a test O-1 form
    logger.info("Generating test O-1 form...")
    o1_form = generator.generate_synthetic_document("o1", "medium")
    o1_path = generator.save_synthetic_document(o1_form, "o1")
    logger.info(f"O-1 form saved to: {o1_path}")
    
    logger.info("RL-based generator test completed successfully!")

def main():
    """Run all tests."""
    logger.info("Starting generator tests...")
    
    test_rule_based_generator()
    test_rl_based_generator()
    
    logger.info("All tests completed successfully!")

if __name__ == "__main__":
    main() 