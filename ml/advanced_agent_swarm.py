#!/usr/bin/env python3
"""
Advanced Agent Swarm implementation for O-1 visa applications.

This module provides a more sophisticated implementation of the agent swarm
architecture for generating synthetic O-1 visa application data.
"""

import os
import sys
import json
import random
import logging
import numpy as np
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Union, Tuple, Callable

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import necessary modules
from ml.rl_based_generator import RLEnvironment, Agent, AgentSwarm

class Memory:
    """Memory component for agents to store and retrieve experiences."""
    
    def __init__(self, capacity: int = 1000):
        """Initialize memory.
        
        Args:
            capacity: Maximum number of experiences to store
        """
        self.capacity = capacity
        self.experiences = []
        self.position = 0
    
    def add(self, experience: Dict[str, Any]):
        """Add experience to memory.
        
        Args:
            experience: Dictionary containing experience data
        """
        if len(self.experiences) < self.capacity:
            self.experiences.append(None)
        
        self.experiences[self.position] = experience
        self.position = (self.position + 1) % self.capacity
    
    def sample(self, batch_size: int) -> List[Dict[str, Any]]:
        """Sample a batch of experiences from memory.
        
        Args:
            batch_size: Number of experiences to sample
            
        Returns:
            List of sampled experiences
        """
        return random.sample(self.experiences, min(batch_size, len(self.experiences)))
    
    def __len__(self) -> int:
        """Get the current size of memory.
        
        Returns:
            Number of experiences in memory
        """
        return len(self.experiences)

class FormStructure:
    """Detailed representation of form structure with field dependencies."""
    
    def __init__(self, form_template: Dict[str, Any]):
        """Initialize form structure.
        
        Args:
            form_template: Template form with field structure
        """
        self.template = form_template
        self.fields = self._extract_fields(form_template)
        self.dependencies = self._build_dependencies()
    
    def _extract_fields(self, template: Dict[str, Any]) -> List[str]:
        """Extract flat list of fields from nested template.
        
        Args:
            template: Form template
            
        Returns:
            List of field names
        """
        fields = []
        
        def _extract_fields_recursive(obj, prefix=""):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    if key != "important_fields" and key != "dependencies":
                        if isinstance(value, (dict, list)):
                            _extract_fields_recursive(value, f"{prefix}{key}.")
                        else:
                            fields.append(f"{prefix}{key}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    _extract_fields_recursive(item, f"{prefix}[{i}].")
        
        _extract_fields_recursive(template)
        return fields
    
    def _build_dependencies(self) -> Dict[str, List[str]]:
        """Build field dependencies from template.
        
        Returns:
            Dictionary mapping fields to their dependencies
        """
        # Get explicit dependencies from template if available
        explicit_dependencies = self.template.get("dependencies", {})
        
        # Infer additional dependencies based on field names
        inferred_dependencies = {}
        for field in self.fields:
            parts = field.split(".")
            if len(parts) > 1:
                parent = ".".join(parts[:-1])
                if parent in self.fields:
                    if field not in inferred_dependencies:
                        inferred_dependencies[field] = []
                    inferred_dependencies[field].append(parent)
        
        # Combine explicit and inferred dependencies
        all_dependencies = {}
        for field in self.fields:
            all_dependencies[field] = (
                explicit_dependencies.get(field, []) + 
                inferred_dependencies.get(field, [])
            )
        
        return all_dependencies
    
    def get_field_dependencies(self, field: str) -> List[str]:
        """Get dependencies for a specific field.
        
        Args:
            field: Field name
            
        Returns:
            List of fields this field depends on
        """
        return self.dependencies.get(field, [])
    
    def get_dependent_fields(self, field: str) -> List[str]:
        """Get fields that depend on a specific field.
        
        Args:
            field: Field name
            
        Returns:
            List of fields that depend on this field
        """
        dependent_fields = []
        for f, deps in self.dependencies.items():
            if field in deps:
                dependent_fields.append(f)
        return dependent_fields

class SpecializedAgent(Agent):
    """Enhanced agent with specialized capabilities for form filling."""
    
    def __init__(
        self, 
        name: str,
        specialization: str,
        field_set: List[str],
        strategy_fn: Optional[Callable] = None
    ):
        """Initialize specialized agent.
        
        Args:
            name: Agent name
            specialization: Area of specialization
            field_set: List of fields this agent can handle
            strategy_fn: Optional strategy function for action selection
        """
        super().__init__(name)
        self.specialization = specialization
        self.field_set = set(field_set)
        self.strategy_fn = strategy_fn
        self.memory = Memory()
        self.success_rate = 0.0
        self.actions_taken = 0
    
    def select_action(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Select an action based on current state.
        
        Args:
            state: Current environment state
            
        Returns:
            Action to take
        """
        # Get remaining fields that this agent can handle
        remaining_fields = [f for f in state["remaining_fields"] if f in self.field_set]
        
        if not remaining_fields:
            return {"field_name": None, "value": None}
        
        # Use custom strategy if provided
        if self.strategy_fn:
            return self.strategy_fn(state, remaining_fields)
        
        # Default strategy: select random field and generate value
        field_name = random.choice(remaining_fields)
        value = self._generate_value(field_name, state)
        
        return {"field_name": field_name, "value": value}
    
    def _generate_value(self, field_name: str, state: Dict[str, Any]) -> Any:
        """Generate a value for a specific field.
        
        Args:
            field_name: Field to generate value for
            state: Current environment state
            
        Returns:
            Generated value
        """
        # This would be more sophisticated in a real implementation
        # For now, just generate a placeholder value based on the field name
        
        # Check if the field has dependencies
        field_values = state["field_values"]
        
        if "form_structure" in state and "personal_info" in field_name:
            return f"Personal {field_name.split('.')[-1]} value"
        elif "employment" in field_name:
            return f"Employment {field_name.split('.')[-1]} value"
        elif "eligibility" in field_name:
            return random.choice([True, False])
        else:
            return f"Value for {field_name}"
    
    def learn_from_experience(self, experience: Dict[str, Any]):
        """Learn from an experience.
        
        Args:
            experience: Dictionary containing experience data
        """
        self.memory.add(experience)
        
        # Update success rate
        if experience.get("success", False):
            self.success_rate = (self.success_rate * self.actions_taken + 1) / (self.actions_taken + 1)
        else:
            self.success_rate = (self.success_rate * self.actions_taken) / (self.actions_taken + 1)
        
        self.actions_taken += 1

class Evaluator:
    """Agent that evaluates the quality of filled forms."""
    
    def __init__(self, form_structure: FormStructure):
        """Initialize the evaluator.
        
        Args:
            form_structure: Form structure with field dependencies
        """
        self.form_structure = form_structure
    
    def evaluate_form(self, filled_form: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a filled form.
        
        Args:
            filled_form: Form with filled values
            
        Returns:
            Evaluation results with quality metrics
        """
        # Check completeness
        completeness = self._evaluate_completeness(filled_form)
        
        # Check consistency
        consistency = self._evaluate_consistency(filled_form)
        
        # Check validity
        validity = self._evaluate_validity(filled_form)
        
        # Calculate overall quality score
        quality_score = (completeness + consistency + validity) / 3
        
        return {
            "completeness": completeness,
            "consistency": consistency,
            "validity": validity,
            "quality_score": quality_score
        }
    
    def _evaluate_completeness(self, filled_form: Dict[str, Any]) -> float:
        """Evaluate form completeness.
        
        Args:
            filled_form: Form with filled values
            
        Returns:
            Completeness score (0.0 to 1.0)
        """
        total_fields = len(self.form_structure.fields)
        filled_fields = sum(1 for field in self.form_structure.fields if field in filled_form)
        
        return filled_fields / total_fields if total_fields > 0 else 0.0
    
    def _evaluate_consistency(self, filled_form: Dict[str, Any]) -> float:
        """Evaluate form internal consistency.
        
        Args:
            filled_form: Form with filled values
            
        Returns:
            Consistency score (0.0 to 1.0)
        """
        # This would be more sophisticated in a real implementation
        # For now, just return a random score
        return random.uniform(0.7, 1.0)
    
    def _evaluate_validity(self, filled_form: Dict[str, Any]) -> float:
        """Evaluate form validity.
        
        Args:
            filled_form: Form with filled values
            
        Returns:
            Validity score (0.0 to 1.0)
        """
        # This would involve validating field values against expected formats
        # For now, just return a random score
        return random.uniform(0.7, 1.0)

class EnhancedAgentSwarm(AgentSwarm):
    """Enhanced agent swarm with improved collaboration and specialization."""
    
    def __init__(self, form_structure: FormStructure):
        """Initialize the enhanced agent swarm.
        
        Args:
            form_structure: Detailed form structure
        """
        super().__init__()
        self.form_structure = form_structure
        self.evaluator = Evaluator(form_structure)
        
        # Replace the generic agents with specialized agents
        self.agents = self._create_specialized_agents()
        
        # Track collaboration metrics
        self.agent_performance = {agent.name: [] for agent in self.agents}
        self.form_quality_history = []
    
    def _create_specialized_agents(self) -> List[SpecializedAgent]:
        """Create specialized agents for different form sections.
        
        Returns:
            List of specialized agents
        """
        agents = []
        
        # Define field sets for each specialization
        personal_fields = [f for f in self.form_structure.fields if "personal" in f.lower()]
        employment_fields = [f for f in self.form_structure.fields if "employ" in f.lower()]
        eligibility_fields = [f for f in self.form_structure.fields if "eligib" in f.lower()]
        
        # Create personal information agent
        personal_agent = SpecializedAgent(
            name="personal_agent",
            specialization="personal_info",
            field_set=personal_fields,
            strategy_fn=self._personal_info_strategy
        )
        agents.append(personal_agent)
        
        # Create employment information agent
        employment_agent = SpecializedAgent(
            name="employment_agent",
            specialization="employment_info",
            field_set=employment_fields,
            strategy_fn=self._employment_info_strategy
        )
        agents.append(employment_agent)
        
        # Create eligibility criteria agent
        eligibility_agent = SpecializedAgent(
            name="eligibility_agent",
            specialization="eligibility",
            field_set=eligibility_fields,
            strategy_fn=self._eligibility_criteria_strategy
        )
        agents.append(eligibility_agent)
        
        return agents
    
    def select_action(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Select an action using the most appropriate agent.
        
        Args:
            state: Current environment state
            
        Returns:
            Action to take
        """
        # No action if no remaining fields
        remaining_fields = state["remaining_fields"]
        if not remaining_fields:
            return {"field_name": None, "value": None}
        
        # Determine which agent should handle this state
        # More sophisticated routing based on field dependencies
        agent_scores = self._score_agents_for_state(state)
        
        # Select the agent with the highest score
        selected_agent = self.agents[max(range(len(self.agents)), key=lambda i: agent_scores[i])]
        
        # Let the specialized agent select an action
        action = selected_agent.select_action(state)
        
        # If action is valid, record it
        if action["field_name"]:
            experience = {
                "state": state,
                "action": action,
                "agent": selected_agent.name,
                "success": True  # Will be updated after observing the next state
            }
            selected_agent.learn_from_experience(experience)
        
        return action
    
    def _score_agents_for_state(self, state: Dict[str, Any]) -> List[float]:
        """Score agents based on their suitability for the current state.
        
        Args:
            state: Current environment state
            
        Returns:
            List of scores for each agent
        """
        scores = []
        
        for agent in self.agents:
            # Calculate how many remaining fields this agent can handle
            agent_fields = [f for f in state["remaining_fields"] if f in agent.field_set]
            field_coverage = len(agent_fields) / len(state["remaining_fields"]) if state["remaining_fields"] else 0
            
            # Consider agent's success rate
            success_factor = agent.success_rate * 0.5 + 0.5  # Ensure even unsuccessful agents get some chance
            
            # Final score is a combination of field coverage and success rate
            score = field_coverage * 0.7 + success_factor * 0.3
            scores.append(score)
        
        return scores
    
    def evaluate_filled_form(self, form: Dict[str, Any]) -> Dict[str, Any]:
        """Evaluate a filled form using the evaluator.
        
        Args:
            form: Filled form
            
        Returns:
            Evaluation results
        """
        evaluation = self.evaluator.evaluate_form(form)
        self.form_quality_history.append(evaluation["quality_score"])
        return evaluation
    
    def _personal_info_strategy(self, state: Dict[str, Any], available_fields: List[str]) -> Dict[str, Any]:
        """Strategy for personal information fields.
        
        Args:
            state: Current environment state
            available_fields: Fields this agent can handle
            
        Returns:
            Action to take
        """
        # Prioritize basic identification fields first
        priority_fields = [f for f in available_fields if "name" in f or "id" in f or "birth" in f]
        
        if priority_fields:
            field_name = random.choice(priority_fields)
        else:
            field_name = random.choice(available_fields)
        
        value = self._generate_personal_info_value(field_name, state)
        
        return {"field_name": field_name, "value": value}
    
    def _employment_info_strategy(self, state: Dict[str, Any], available_fields: List[str]) -> Dict[str, Any]:
        """Strategy for employment information fields.
        
        Args:
            state: Current environment state
            available_fields: Fields this agent can handle
            
        Returns:
            Action to take
        """
        # Just a simple implementation for now
        field_name = random.choice(available_fields)
        value = self._generate_employment_info_value(field_name, state)
        
        return {"field_name": field_name, "value": value}
    
    def _eligibility_criteria_strategy(self, state: Dict[str, Any], available_fields: List[str]) -> Dict[str, Any]:
        """Strategy for eligibility criteria fields.
        
        Args:
            state: Current environment state
            available_fields: Fields this agent can handle
            
        Returns:
            Action to take
        """
        # Just a simple implementation for now
        field_name = random.choice(available_fields)
        
        # Eligibility criteria are often boolean values
        if "criteria" in field_name or "eligible" in field_name:
            value = random.choice([True, False])
        else:
            value = f"Eligibility info for {field_name}"
        
        return {"field_name": field_name, "value": value}
    
    def _generate_personal_info_value(self, field_name: str, state: Dict[str, Any]) -> Any:
        """Generate value for personal information field.
        
        Args:
            field_name: Field name
            state: Current environment state
            
        Returns:
            Generated value
        """
        field_type = field_name.split(".")[-1].lower()
        
        if "first_name" in field_type:
            return random.choice(["Alex", "Jordan", "Taylor", "Morgan", "Casey"])
        elif "last_name" in field_type:
            return random.choice(["Smith", "Johnson", "Williams", "Brown", "Jones"])
        elif "email" in field_type:
            # Try to use consistent name if available
            field_values = state["field_values"]
            first_name = None
            last_name = None
            
            for field, value in field_values.items():
                if "first_name" in field.lower():
                    first_name = value
                elif "last_name" in field.lower():
                    last_name = value
            
            if first_name and last_name:
                return f"{first_name.lower()}.{last_name.lower()}@example.com"
            else:
                return "user@example.com"
        elif "phone" in field_type:
            return f"({random.randint(100, 999)})-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
        elif "birth" in field_type or "date" in field_type:
            year = random.randint(1970, 2000)
            month = random.randint(1, 12)
            day = random.randint(1, 28)
            return f"{year}-{month:02d}-{day:02d}"
        else:
            return f"Personal info: {field_type}"
    
    def _generate_employment_info_value(self, field_name: str, state: Dict[str, Any]) -> Any:
        """Generate value for employment information field.
        
        Args:
            field_name: Field name
            state: Current environment state
            
        Returns:
            Generated value
        """
        field_type = field_name.split(".")[-1].lower()
        
        if "employer" in field_type or "company" in field_type:
            return random.choice(["Google", "Apple", "Microsoft", "Amazon", "Meta"])
        elif "title" in field_type or "position" in field_type:
            return random.choice(["Software Engineer", "Data Scientist", "Product Manager", "ML Engineer"])
        elif "salary" in field_type:
            return random.randint(100000, 300000)
        elif "start_date" in field_type:
            year = random.randint(2015, 2023)
            month = random.randint(1, 12)
            day = random.randint(1, 28)
            return f"{year}-{month:02d}-{day:02d}"
        else:
            return f"Employment info: {field_type}"

# Enhanced RL environment
class EnhancedRLEnvironment(RLEnvironment):
    """Enhanced RL environment with more sophisticated form structure and rewards."""
    
    def __init__(self, form_template: Dict[str, Any], complexity: str = "medium"):
        """Initialize the enhanced RL environment.
        
        Args:
            form_template: Template form with field structure
            complexity: Complexity level affecting state space
        """
        super().__init__(form_template, complexity)
        self.form_structure = FormStructure(form_template)
        self.evaluator = Evaluator(self.form_structure)
    
    def step(self, action: Dict[str, Any]) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
        """Take an action in the environment with enhanced reward calculation.
        
        Args:
            action: Dictionary containing field_name and value to fill
            
        Returns:
            Tuple of (observation, reward, done, info)
        """
        # Store the previous state for reward calculation
        prev_evaluation = self._evaluate_current_form()
        
        # Call the parent class step method
        observation, base_reward, done, info = super().step(action)
        
        # Calculate enhanced reward
        if action["field_name"]:
            # Evaluate the form after the action
            current_evaluation = self._evaluate_current_form()
            
            # Reward is based on the improvement in form quality
            quality_improvement = current_evaluation["quality_score"] - prev_evaluation["quality_score"]
            enhanced_reward = base_reward + quality_improvement * 2.0
            
            # Add evaluation info
            info["evaluation"] = current_evaluation
        else:
            enhanced_reward = base_reward
        
        return observation, enhanced_reward, done, info
    
    def _evaluate_current_form(self) -> Dict[str, Any]:
        """Evaluate the current state of the form.
        
        Returns:
            Evaluation results
        """
        return self.evaluator.evaluate_form(self.field_values)

# Test function
def test_enhanced_agent_swarm():
    """Test the enhanced agent swarm."""
    # Create a simple form template
    form_template = {
        "personal_info": {
            "first_name": None,
            "last_name": None,
            "email": None,
            "phone": None,
            "birth_date": None
        },
        "employment_info": {
            "employer_name": None,
            "job_title": None,
            "annual_salary": None,
            "start_date": None
        },
        "eligibility_criteria": {
            "extraordinary_ability": None,
            "sustained_acclaim": None,
            "leading_position": None
        },
        "important_fields": [
            "personal_info.first_name",
            "personal_info.last_name",
            "employment_info.employer_name",
            "eligibility_criteria.extraordinary_ability"
        ],
        "dependencies": {
            "personal_info.email": ["personal_info.first_name", "personal_info.last_name"]
        }
    }
    
    # Create form structure
    form_structure = FormStructure(form_template)
    
    # Create enhanced environment
    env = EnhancedRLEnvironment(form_template, complexity="medium")
    
    # Create enhanced agent swarm
    agent_swarm = EnhancedAgentSwarm(form_structure)
    
    # Run a test episode
    state = env.reset()
    total_reward = 0
    
    print("Starting test episode...")
    
    for step in range(20):  # Limit to 20 steps maximum
        # Select action
        action = agent_swarm.select_action(state)
        
        if not action["field_name"]:
            print("No more fields to fill")
            break
        
        # Take action in environment
        next_state, reward, done, info = env.step(action)
        
        # Print action and reward
        print(f"Step {step+1}: Field={action['field_name']}, Value={action['value']}, Reward={reward:.2f}")
        
        if "evaluation" in info:
            eval_info = info["evaluation"]
            print(f"  Form quality: {eval_info['quality_score']:.2f} (Completeness={eval_info['completeness']:.2f}, Consistency={eval_info['consistency']:.2f})")
        
        # Update total reward
        total_reward += reward
        
        # Update state
        state = next_state
        
        if done:
            print("Form completed!")
            break
    
    # Final evaluation
    final_form = env.field_values
    final_evaluation = agent_swarm.evaluate_filled_form(final_form)
    
    print("\nFinal form:")
    for field, value in final_form.items():
        print(f"  {field}: {value}")
    
    print("\nFinal evaluation:")
    for metric, value in final_evaluation.items():
        print(f"  {metric}: {value:.2f}")
    
    print(f"\nTotal reward: {total_reward:.2f}")

# Run test if module is executed directly
if __name__ == "__main__":
    test_enhanced_agent_swarm() 