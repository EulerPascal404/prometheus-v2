#!/usr/bin/env python3
"""
Advanced RL-based synthetic data generator for O-1 visa applications.

This module extends the RL-based generator with more sophisticated
agent swarm capabilities for improved form filling.
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

# Import base modules
from ml.synthetic_data_generator import SyntheticDataGenerator
from ml.rule_based_generator import RuleBasedGenerator
from ml.rl_based_generator import RLBasedGenerator, RLEnvironment
from ml.advanced_agent_swarm import EnhancedAgentSwarm, EnhancedRLEnvironment, FormStructure

class AdvancedRLGenerator(RLBasedGenerator):
    """Advanced RL-based synthetic data generator with improved agent swarm."""
    
    def __init__(self, output_dir: Optional[str] = None):
        """Initialize the advanced RL generator.
        
        Args:
            output_dir: Directory to save synthetic data
        """
        super().__init__(output_dir)
        
        # Form templates for different document types
        self.form_templates = {
            "o1": self._create_o1_form_template(),
            "i129": self._create_i129_form_template()
        }
        
        # Create enhanced agent swarms for each form type
        self.agent_swarms = {}
        for form_type, template in self.form_templates.items():
            form_structure = FormStructure(template)
            self.agent_swarms[form_type] = EnhancedAgentSwarm(form_structure)
        
        # Track metrics for each agent swarm
        self.swarm_metrics = {form_type: {"episodes": 0, "avg_reward": 0.0} for form_type in self.form_templates}
    
    def _create_o1_form_template(self) -> Dict[str, Any]:
        """Create a detailed O-1 form template with field structure.
        
        Returns:
            O-1 form template
        """
        return {
            "personal_info": {
                "first_name": None,
                "last_name": None,
                "email": None,
                "phone": None,
                "birth_date": None,
                "country_of_birth": None,
                "country_of_citizenship": None,
                "gender": None,
                "current_residential_address": None
            },
            "employment_info": {
                "employer_name": None,
                "employer_id": None,
                "job_title": None,
                "work_address": None,
                "annual_salary": None,
                "start_date": None
            },
            "eligibility_categories": {
                "nationally_recognized_prizes": None,
                "membership_in_associations": None,
                "published_material": None,
                "judge_of_others": None,
                "scientific_contributions": None,
                "authored_scholarly_articles": None,
                "high_salary": None,
                "commercial_success": None
            },
            "supporting_evidence": {
                "resume": {
                    "attached": None,
                    "page_count": None
                },
                "recommendation_letters": {
                    "count": None,
                    "sources": None
                },
                "awards": {
                    "count": None,
                    "significance": None
                }
            },
            "important_fields": [
                "personal_info.first_name",
                "personal_info.last_name",
                "employment_info.employer_name",
                "employment_info.job_title",
                "eligibility_categories.nationally_recognized_prizes",
                "eligibility_categories.scientific_contributions"
            ],
            "dependencies": {
                "personal_info.email": ["personal_info.first_name", "personal_info.last_name"],
                "supporting_evidence.resume.page_count": ["supporting_evidence.resume.attached"],
                "supporting_evidence.recommendation_letters.sources": ["supporting_evidence.recommendation_letters.count"]
            }
        }
    
    def _create_i129_form_template(self) -> Dict[str, Any]:
        """Create a detailed I-129 form template with field structure.
        
        Returns:
            I-129 form template
        """
        return {
            "personal_info": {
                "first_name": None,
                "last_name": None,
                "email": None,
                "phone": None,
                "birth_date": None,
                "country_of_birth": None,
                "country_of_citizenship": None,
                "gender": None,
                "current_residential_address": None
            },
            "employment_info": {
                "employer_name": None,
                "employer_id": None,
                "job_title": None,
                "work_address": None,
                "annual_salary": None,
                "start_date": None
            },
            "petition_details": {
                "receipt_number": None,
                "petition_type": None,
                "requested_action": None,
                "basis_for_classification": None,
                "period_of_employment": {
                    "from_date": None,
                    "to_date": None
                }
            },
            "important_fields": [
                "personal_info.first_name",
                "personal_info.last_name",
                "employment_info.employer_name",
                "petition_details.petition_type",
                "petition_details.requested_action"
            ],
            "dependencies": {
                "personal_info.email": ["personal_info.first_name", "personal_info.last_name"],
                "petition_details.period_of_employment.to_date": ["petition_details.period_of_employment.from_date"]
            }
        }
    
    def train(self, episodes: int = 100, form_type: str = "o1") -> List[float]:
        """Train the enhanced RL agents on form filling.
        
        Args:
            episodes: Number of training episodes
            form_type: Type of form to train on
            
        Returns:
            List of episode rewards
        """
        logger.info(f"Starting enhanced training for {episodes} episodes on {form_type} forms")
        
        if form_type not in self.form_templates:
            raise ValueError(f"Unknown form type: {form_type}")
        
        template = self.form_templates[form_type]
        agent_swarm = self.agent_swarms[form_type]
        
        rewards = []
        
        for episode in range(episodes):
            # Create enhanced environment
            env = EnhancedRLEnvironment(template)
            state = env.reset()
            
            done = False
            episode_reward = 0
            
            while not done:
                # Select action using the enhanced agent swarm
                action = agent_swarm.select_action(state)
                
                # Take action in environment
                next_state, reward, done, info = env.step(action)
                
                # Track reward
                episode_reward += reward
                
                # Move to next state
                state = next_state
            
            rewards.append(episode_reward)
            
            if (episode + 1) % 10 == 0:
                logger.info(f"Episode {episode + 1}/{episodes}, Reward: {episode_reward:.2f}")
        
        # Update metrics
        self.swarm_metrics[form_type]["episodes"] += episodes
        self.swarm_metrics[form_type]["avg_reward"] = sum(rewards) / len(rewards)
        
        logger.info(f"Enhanced training completed. Average reward: {self.swarm_metrics[form_type]['avg_reward']:.2f}")
        
        return rewards
    
    def _generate_o1_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic O-1 form data using advanced RL.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic O-1 form data
        """
        # Use the base form from the rule-based generator as a starting point
        base_form = self.rule_based._generate_o1_form(complexity)
        
        # If we have a trained agent swarm, use it to enhance the form
        if self.swarm_metrics["o1"]["episodes"] > 0:
            logger.info("Using enhanced agent swarm to generate O-1 form")
            
            # Set up the environment with the template
            template = self.form_templates["o1"]
            env = EnhancedRLEnvironment(template, complexity)
            state = env.reset()
            
            # Fill the form using the agent swarm
            agent_swarm = self.agent_swarms["o1"]
            
            done = False
            while not done:
                action = agent_swarm.select_action(state)
                if not action["field_name"]:
                    break
                
                next_state, _, done, _ = env.step(action)
                state = next_state
            
            # Evaluate the final form
            filled_form = env.field_values
            evaluation = agent_swarm.evaluate_filled_form(filled_form)
            
            # Incorporate the filled values into the base form
            self._update_nested_dict(base_form, filled_form)
            
            # Add evaluation and metadata
            base_form["evaluation"] = evaluation
            base_form["generation_method"] = "advanced_rl"
            base_form["agent_swarm_version"] = "0.2"
            base_form["training_episodes"] = self.swarm_metrics["o1"]["episodes"]
        else:
            # Fall back to simple enhancement if no training
            logger.info("No training data available for O-1 form, using simple enhancement")
            base_form["generation_method"] = "rule_with_rl_enhancement"
            base_form["agent_swarm_version"] = "0.2"
            
            # Add some randomness to make it slightly different from pure rule-based
            if "eligibility_categories" in base_form:
                for key in base_form["eligibility_categories"]:
                    base_form["eligibility_categories"][key] = random.choice([True, False])
        
        return base_form
    
    def _generate_i129_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic I-129 form data using advanced RL.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic I-129 form data
        """
        # Use the base form from the rule-based generator as a starting point
        base_form = self.rule_based._generate_i129_form(complexity)
        
        # Similar approach as _generate_o1_form but for I-129
        if self.swarm_metrics["i129"]["episodes"] > 0:
            logger.info("Using enhanced agent swarm to generate I-129 form")
            
            # Set up the environment with the template
            template = self.form_templates["i129"]
            env = EnhancedRLEnvironment(template, complexity)
            state = env.reset()
            
            # Fill the form using the agent swarm
            agent_swarm = self.agent_swarms["i129"]
            
            done = False
            while not done:
                action = agent_swarm.select_action(state)
                if not action["field_name"]:
                    break
                
                next_state, _, done, _ = env.step(action)
                state = next_state
            
            # Evaluate the final form
            filled_form = env.field_values
            evaluation = agent_swarm.evaluate_filled_form(filled_form)
            
            # Incorporate the filled values into the base form
            self._update_nested_dict(base_form, filled_form)
            
            # Add evaluation and metadata
            base_form["evaluation"] = evaluation
            base_form["generation_method"] = "advanced_rl"
            base_form["agent_swarm_version"] = "0.2"
            base_form["training_episodes"] = self.swarm_metrics["i129"]["episodes"]
        else:
            # Fall back to simple enhancement if no training
            base_form["generation_method"] = "rule_with_rl_enhancement" 
            base_form["agent_swarm_version"] = "0.2"
        
        return base_form
    
    def _update_nested_dict(self, base_dict: Dict[str, Any], update_dict: Dict[str, Any]):
        """Update nested dictionary with values from another dictionary.
        
        Args:
            base_dict: Dictionary to update
            update_dict: Dictionary with new values
        """
        for key, value in update_dict.items():
            if isinstance(value, dict) and key in base_dict and isinstance(base_dict[key], dict):
                self._update_nested_dict(base_dict[key], value)
            else:
                base_dict[key] = value

# For testing
if __name__ == "__main__":
    generator = AdvancedRLGenerator()
    
    # Train the enhanced RL agents for a few episodes
    print("Training enhanced RL agents...")
    generator.train(episodes=5, form_type="o1")
    
    # Generate and save a sample O-1 form
    print("Generating O-1 form with enhanced RL...")
    o1_form = generator.generate_synthetic_document("o1", "medium")
    o1_path = generator.save_synthetic_document(o1_form, "o1")
    
    print(f"Generated synthetic O-1 form saved to: {o1_path}")
    print("Sample form evaluation:")
    if "evaluation" in o1_form:
        for metric, value in o1_form["evaluation"].items():
            print(f"  {metric}: {value:.2f}")
    
    print("\nAdvanced RL generator test completed successfully!") 