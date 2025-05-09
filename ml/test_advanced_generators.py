#!/usr/bin/env python3
"""
Test script for advanced generators.

This script tests the advanced agent swarm and RL-based generators.
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

# Import modules
from ml.advanced_agent_swarm import (
    FormStructure, 
    EnhancedAgentSwarm, 
    EnhancedRLEnvironment, 
    Evaluator
)
from ml.advanced_rl_generator import AdvancedRLGenerator

def test_form_structure():
    """Test the FormStructure class."""
    logger.info("Testing FormStructure...")
    
    # Create a test form template
    form_template = {
        "personal_info": {
            "first_name": None,
            "last_name": None,
            "email": None
        },
        "employment_info": {
            "employer_name": None,
            "job_title": None
        },
        "important_fields": ["personal_info.first_name", "employment_info.employer_name"],
        "dependencies": {
            "personal_info.email": ["personal_info.first_name", "personal_info.last_name"]
        }
    }
    
    # Create form structure
    form_structure = FormStructure(form_template)
    
    # Print fields
    logger.info(f"Form fields: {form_structure.fields}")
    
    # Print dependencies
    logger.info(f"Form dependencies: {form_structure.dependencies}")
    
    # Test getting field dependencies
    email_deps = form_structure.get_field_dependencies("personal_info.email")
    logger.info(f"Dependencies for personal_info.email: {email_deps}")
    
    # Test getting dependent fields
    first_name_deps = form_structure.get_dependent_fields("personal_info.first_name")
    logger.info(f"Fields dependent on personal_info.first_name: {first_name_deps}")
    
    logger.info("FormStructure test completed successfully!")

def test_enhanced_agent_swarm():
    """Test the EnhancedAgentSwarm class."""
    logger.info("Testing EnhancedAgentSwarm...")
    
    # Create a simple form template
    form_template = {
        "personal_info": {
            "first_name": None,
            "last_name": None,
            "email": None
        },
        "employment_info": {
            "employer_name": None,
            "job_title": None
        },
        "eligibility_criteria": {
            "extraordinary_ability": None,
            "sustained_acclaim": None
        },
        "important_fields": ["personal_info.first_name", "eligibility_criteria.extraordinary_ability"],
        "dependencies": {
            "personal_info.email": ["personal_info.first_name", "personal_info.last_name"]
        }
    }
    
    # Create form structure and enhanced environment
    form_structure = FormStructure(form_template)
    env = EnhancedRLEnvironment(form_template)
    
    # Create enhanced agent swarm
    agent_swarm = EnhancedAgentSwarm(form_structure)
    
    # Run a test episode
    state = env.reset()
    
    logger.info("Starting test episode...")
    
    for step in range(10):
        # Select action
        action = agent_swarm.select_action(state)
        
        if not action["field_name"]:
            logger.info("No more fields to fill")
            break
        
        # Take action in environment
        next_state, reward, done, info = env.step(action)
        
        # Log action and reward
        logger.info(f"Step {step+1}: Field={action['field_name']}, Value={action['value']}, Reward={reward:.2f}")
        
        # Update state
        state = next_state
        
        if done:
            logger.info("Form completed!")
            break
    
    # Evaluate the final form
    final_form = env.field_values
    final_evaluation = agent_swarm.evaluate_filled_form(final_form)
    
    logger.info(f"Final form values: {final_form}")
    logger.info(f"Final evaluation: {final_evaluation}")
    
    logger.info("EnhancedAgentSwarm test completed successfully!")

def test_advanced_rl_generator():
    """Test the AdvancedRLGenerator class."""
    logger.info("Testing AdvancedRLGenerator...")
    
    # Create output directory
    output_dir = ROOT_DIR / "data" / "training" / "synthetic" / "test_advanced_rl"
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize generator
    generator = AdvancedRLGenerator(output_dir=str(output_dir))
    
    # Train the generator (minimal training for testing)
    logger.info("Training advanced RL agents for O-1 form...")
    generator.train(episodes=5, form_type="o1")
    
    # Generate a test O-1 form
    logger.info("Generating test O-1 form...")
    o1_form = generator.generate_synthetic_document("o1", "medium")
    o1_path = generator.save_synthetic_document(o1_form, "o1")
    logger.info(f"O-1 form saved to: {o1_path}")
    
    # Check if evaluation is present
    if "evaluation" in o1_form:
        logger.info(f"Form evaluation: {o1_form['evaluation']}")
    
    logger.info("AdvancedRLGenerator test completed successfully!")

def main():
    """Run all tests."""
    logger.info("Starting advanced generator tests...")
    
    test_form_structure()
    test_enhanced_agent_swarm()
    test_advanced_rl_generator()
    
    logger.info("All advanced generator tests completed successfully!")

if __name__ == "__main__":
    main() 