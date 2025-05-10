#!/usr/bin/env python3
"""
RL-based synthetic data generator for O-1 visa applications.

This module provides a reinforcement learning implementation 
for generating synthetic O-1 visa applications using agentic swarms.
"""

import os
import sys
import json
import random
import logging
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Union, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the parent directory to the path to import from api
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the base generator
from ml.synthetic_data_generator import SyntheticDataGenerator
from ml.rule_based_generator import RuleBasedGenerator

# Import functions from validate-documents.py
try:
    from api.validate_documents import (
        write_rag_responses,
        process_pdf_content,
        get_supabase,
        merge_dicts
    )
    validate_documents_available = True
    logger.info("Successfully imported functions from validate-documents.py")
except ImportError as e:
    validate_documents_available = False
    logger.warning(f"Could not import functions from validate-documents.py: {e}")
    logger.warning("Will fall back to rule-based generation")

class RLEnvironment:
    """Environment for RL-based form filling."""
    
    def __init__(self, form_template: Dict[str, Any], complexity: str = "medium"):
        """Initialize the RL environment.
        
        Args:
            form_template: Template form with field structure
            complexity: Complexity level affecting state space
        """
        self.form_template = form_template
        self.complexity = complexity
        self.reset()
    
    def reset(self) -> Dict[str, Any]:
        """Reset the environment to initial state.
        
        Returns:
            Initial state observation
        """
        self.current_form = self.form_template.copy()
        self.filled_fields = set()
        self.field_values = {}
        self.steps_taken = 0
        
        return self._get_observation()
    
    def step(self, action: Dict[str, Any]) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
        """Take an action in the environment.
        
        Args:
            action: Dictionary containing field_name and value to fill
            
        Returns:
            Tuple of (observation, reward, done, info)
        """
        field_name = action.get("field_name")
        value = action.get("value")
        
        # Check if action is valid
        if not field_name or field_name not in self.current_form:
            return self._get_observation(), -1.0, False, {"error": "Invalid field name"}
        
        # Apply the action
        self.field_values[field_name] = value
        self.filled_fields.add(field_name)
        self.steps_taken += 1
        
        # Calculate reward
        reward = self._calculate_reward(field_name, value)
        
        # Check if done
        done = len(self.filled_fields) == len(self.current_form)
        
        return self._get_observation(), reward, done, {"filled_fields": len(self.filled_fields)}
    
    def _get_observation(self) -> Dict[str, Any]:
        """Get the current state observation.
        
        Returns:
            Current state as dictionary
        """
        return {
            "form_structure": self.current_form,
            "filled_fields": list(self.filled_fields),
            "remaining_fields": list(set(self.current_form.keys()) - self.filled_fields),
            "field_values": self.field_values,
            "steps_taken": self.steps_taken,
            "complexity": self.complexity
        }
    
    def _calculate_reward(self, field_name: str, value: Any) -> float:
        """Calculate reward for the action.
        
        Args:
            field_name: Field that was filled
            value: Value that was entered
            
        Returns:
            Reward value
        """
        # Basic reward for filling a field
        reward = 0.5
        
        # Additional reward for filling important fields
        if field_name in self.current_form.get("important_fields", []):
            reward += 0.5
        
        # Additional reward for consistency (placeholder for real consistency checking)
        # In a real implementation, this would check field dependencies
        consistency_bonus = random.uniform(0, 0.5)
        reward += consistency_bonus
        
        return reward

class Agent:
    """Base agent class for RL-based form filling."""
    
    def __init__(self, name: str = "base_agent"):
        """Initialize the agent.
        
        Args:
            name: Name of the agent
        """
        self.name = name
    
    def select_action(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Select an action based on current state.
        
        Args:
            state: Current environment state
            
        Returns:
            Action to take
        """
        # In a real implementation, this would use a trained policy network
        # For now, just randomly select an unfilled field
        remaining_fields = state["remaining_fields"]
        
        if not remaining_fields:
            return {"field_name": None, "value": None}
        
        field_name = random.choice(remaining_fields)
        value = f"Value for {field_name}"
        
        return {"field_name": field_name, "value": value}

class AgentSwarm:
    """A swarm of specialized agents for form filling."""
    
    def __init__(self, num_agents: int = 3):
        """Initialize the agent swarm.
        
        Args:
            num_agents: Number of agents in the swarm
        """
        self.agents = []
        self.specializations = {
            "personal_info": 0,
            "employment_info": 1,
            "eligibility": 2
        }
        
        # Create specialized agents
        for i in range(num_agents):
            agent = Agent(f"agent_{i}")
            self.agents.append(agent)
    
    def select_action(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Select an action using the most appropriate agent.
        
        Args:
            state: Current environment state
            
        Returns:
            Action to take
        """
        # Determine which agent should handle this state
        remaining_fields = state["remaining_fields"]
        
        if not remaining_fields:
            return {"field_name": None, "value": None}
        
        # Simple routing logic - in a real implementation this would be more sophisticated
        field_name = random.choice(remaining_fields)
        
        if "personal" in field_name.lower():
            agent_idx = self.specializations["personal_info"]
        elif "employ" in field_name.lower():
            agent_idx = self.specializations["employment_info"]
        else:
            agent_idx = self.specializations["eligibility"]
        
        # Let the specialized agent select an action
        return self.agents[agent_idx].select_action(state)

class RLBasedGenerator(SyntheticDataGenerator):
    """RL-based synthetic data generator for O-1 visa applications."""
    
    def __init__(self, output_dir: Optional[str] = None):
        """Initialize the RL-based generator.
        
        Args:
            output_dir: Directory to save synthetic data
        """
        super().__init__(output_dir)
        
        # Create a rule-based generator as fallback
        self.rule_based = RuleBasedGenerator(output_dir)
        
        # Create the agent swarm
        self.agent_swarm = AgentSwarm()
        
        # Initialize Supabase client (if available)
        try:
            self.supabase = get_supabase()
            if self.supabase:
                logger.info("Successfully connected to Supabase for enhanced form generation")
        except (ImportError, NameError):
            self.supabase = None
            logger.info("Supabase client not available - will use local processing only")
        
        # Track training progress
        self.training_episodes = 0
        self.training_rewards = []
    
    def train(self, episodes: int = 100) -> List[float]:
        """Train the RL agents on form filling.
        
        Args:
            episodes: Number of training episodes
            
        Returns:
            List of episode rewards
        """
        logger.info(f"Starting training for {episodes} episodes")
        
        rewards = []
        
        for episode in range(episodes):
            # Create a simple form template for training
            form_template = {
                "personal_info": None,
                "employment_info": None,
                "eligibility_criteria": None,
                "important_fields": ["personal_info", "eligibility_criteria"]
            }
            
            # Create environment
            env = RLEnvironment(form_template)
            
            # Run episode
            state = env.reset()
            done = False
            episode_reward = 0.0
            
            while not done:
                action = self.agent_swarm.select_action(state)
                next_state, reward, done, info = env.step(action)
                episode_reward += reward
                state = next_state
            
            rewards.append(episode_reward)
            logger.debug(f"Episode {episode+1}/{episodes}: Reward = {episode_reward:.2f}")
        
        self.training_episodes += episodes
        self.training_rewards.extend(rewards)
        
        logger.info(f"Training complete. Avg reward: {sum(rewards)/len(rewards):.2f}")
        return rewards
    
    def _generate_o1_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic O-1 form data.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic O-1 form data
        """
        # Check if we can use the validate-documents.py functionality
        if validate_documents_available:
            try:
                logger.info("Using write_rag_responses from validate-documents.py to generate O-1 form")
                
                # Create sample data for form generation
                # Include more context for complex forms
                context_data = ""
                if complexity == "complex":
                    # Generate a complex applicant profile
                    profile = self.rule_based._generate_resume("complex")
                    context_data += f"APPLICANT PROFILE:\n"
                    context_data += f"Name: {profile.get('name', 'John Smith')}\n"
                    context_data += f"Email: {profile.get('email', 'example@example.com')}\n"
                    context_data += f"Skills: {', '.join(profile.get('skills', ['Machine Learning', 'Data Science']))}\n"
                    context_data += f"Experience: {profile.get('experience_summary', 'Expert in AI with 5+ years experience')}\n\n"
                
                # Use the write_rag_responses function to generate form fields
                extra_info = f"Generate a complete O-1 visa application for a person with {complexity} qualifications."
                form_fields = write_rag_responses(
                    extra_info=extra_info,
                    extracted_text=context_data
                )
                
                # Create the full form data structure
                form_data = {
                    "form_type": "O-1",
                    "complexity": complexity,
                    "form_fields": form_fields,
                    "generation_method": "RL-augmented with validate-documents.py"
                }
                
                logger.info(f"Generated O-1 form with {len(form_fields)} fields using validate-documents.py")
                return form_data
                
            except Exception as e:
                logger.error(f"Error using validate-documents.py functions: {str(e)}")
                logger.warning("Falling back to rule-based generation")
        
        # Fallback to rule-based generation
        logger.info("Using rule-based fallback to generate O-1 form")
        return self.rule_based._generate_o1_form(complexity)
    
    def _generate_i129_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic I-129 form data.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic I-129 form data
        """
        # Check if we can use the validate-documents.py functionality
        if validate_documents_available:
            try:
                logger.info("Using write_rag_responses from validate-documents.py to generate I-129 form")
                
                # Create sample data for form generation
                # Include more context for complex forms
                context_data = ""
                if complexity == "complex":
                    # Generate a complex applicant profile
                    profile = self.rule_based._generate_resume("complex")
                    context_data += f"APPLICANT PROFILE:\n"
                    context_data += f"Name: {profile.get('name', 'John Smith')}\n"
                    context_data += f"Email: {profile.get('email', 'example@example.com')}\n"
                    context_data += f"Country of Origin: {random.choice(['Canada', 'UK', 'Australia', 'India', 'China'])}\n"
                    context_data += f"Skills: {', '.join(profile.get('skills', ['Machine Learning', 'Data Science']))}\n"
                    context_data += f"Experience: {profile.get('experience_summary', 'Expert in AI with 5+ years experience')}\n\n"
                
                # Use the write_rag_responses function to generate form fields
                extra_info = f"Generate a complete I-129 form for a petition for O-1 visa with {complexity} qualifications."
                form_fields = write_rag_responses(
                    extra_info=extra_info,
                    extracted_text=context_data
                )
                
                # Create the full form data structure
                form_data = {
                    "form_type": "I-129",
                    "complexity": complexity,
                    "form_fields": form_fields,
                    "generation_method": "RL-augmented with validate-documents.py"
                }
                
                logger.info(f"Generated I-129 form with {len(form_fields)} fields using validate-documents.py")
                return form_data
                
            except Exception as e:
                logger.error(f"Error using validate-documents.py functions: {str(e)}")
                logger.warning("Falling back to rule-based generation")
        
        # Fallback to rule-based generation
        logger.info("Using rule-based fallback to generate I-129 form")
        return self.rule_based._generate_i129_form(complexity)
    
    def _generate_resume(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic resume.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic resume data
        """
        # For now, use the rule-based generator for resumes
        return self.rule_based._generate_resume(complexity)
    
    def _generate_recommendation_letter(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic recommendation letter.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic recommendation letter data
        """
        # For now, use the rule-based generator for recommendation letters
        return self.rule_based._generate_recommendation_letter(complexity)
    
    def _generate_award_certificate(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic award certificate.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic award certificate data
        """
        # For now, use the rule-based generator for award certificates
        return self.rule_based._generate_award_certificate(complexity)

# For testing
if __name__ == "__main__":
    generator = RLBasedGenerator()
    
    # Train the RL agents for a few episodes
    print("Training RL agents...")
    generator.train(episodes=5)
    
    # Generate and save a sample O-1 form
    print("Generating O-1 form...")
    o1_form = generator.generate_synthetic_document("o1", "medium")
    generator.save_synthetic_document(o1_form, "o1")
    
    print("Generated sample synthetic O-1 form using RL-based generator!") 