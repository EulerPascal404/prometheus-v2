#!/usr/bin/env python3
"""
Rule-based synthetic data generator for O-1 visa applications.

This module provides a rule-based implementation of the synthetic data generator
for creating training data for RL-based agents.
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

# Import the base generator
from ml.synthetic_data_generator import SyntheticDataGenerator

# Data for generation
FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Quinn", "Avery", "Skyler"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"]
DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "protonmail.com"]
CITIES = ["New York", "San Francisco", "Los Angeles", "Chicago", "Seattle", "Boston", "Austin", "Denver", "Miami", "Portland"]
STATES = ["NY", "CA", "CA", "IL", "WA", "MA", "TX", "CO", "FL", "OR"]
COUNTRIES = ["United States", "Canada", "United Kingdom", "Germany", "France", "Japan", "Australia", "India", "Brazil", "China"]
UNIVERSITIES = ["Stanford University", "MIT", "Harvard University", "UC Berkeley", "Princeton", "Oxford University", "Cambridge University", "ETH Zurich", "Tokyo University", "National University of Singapore"]
DEGREES = ["BS", "MS", "PhD", "MBA", "JD", "MD", "BA", "BEng", "MEng", "MFA"]
FIELDS = ["Computer Science", "Artificial Intelligence", "Machine Learning", "Data Science", "Software Engineering", "Robotics", "Bioinformatics", "Quantum Computing", "Natural Language Processing", "Human-Computer Interaction"]
COMPANIES = ["Google", "Apple", "Microsoft", "Amazon", "Meta", "Tesla", "SpaceX", "Netflix", "Uber", "Airbnb"]
JOB_TITLES = ["Software Engineer", "Data Scientist", "Machine Learning Engineer", "AI Researcher", "Product Manager", "Engineering Manager", "Research Scientist", "ML Operations Engineer", "Principal Engineer", "Technical Lead"]

class RuleBasedGenerator(SyntheticDataGenerator):
    """Rule-based synthetic data generator for O-1 visa applications."""
    
    def _generate_resume(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic resume.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic resume data
        """
        # Generate basic personal information
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        email = f"{first_name.lower()}.{last_name.lower()}@{random.choice(DOMAINS)}"
        phone = f"({random.randint(100, 999)})-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
        
        # Generate location
        city_idx = random.randint(0, len(CITIES)-1)
        city = CITIES[city_idx]
        state = STATES[city_idx]
        country = random.choice(COUNTRIES)
        
        # Generate education based on complexity
        num_education = 1 if complexity == "simple" else (2 if complexity == "medium" else 3)
        education = []
        for i in range(num_education):
            edu = {
                "university": random.choice(UNIVERSITIES),
                "degree": random.choice(DEGREES),
                "field": random.choice(FIELDS),
                "start_date": (datetime.now() - timedelta(days=random.randint(1500, 3650))).strftime("%Y-%m"),
                "end_date": (datetime.now() - timedelta(days=random.randint(0, 1000))).strftime("%Y-%m"),
                "gpa": round(random.uniform(3.0, 4.0), 2)
            }
            education.append(edu)
        
        # Generate work experience
        num_experience = 1 if complexity == "simple" else (2 if complexity == "medium" else 4)
        experience = []
        for i in range(num_experience):
            exp = {
                "company": random.choice(COMPANIES),
                "title": random.choice(JOB_TITLES),
                "start_date": (datetime.now() - timedelta(days=random.randint(500, 2000))).strftime("%Y-%m"),
                "end_date": "Present" if i == 0 else (datetime.now() - timedelta(days=random.randint(0, 500))).strftime("%Y-%m"),
                "description": self._generate_job_description()
            }
            experience.append(exp)
        
        # Generate skills
        num_skills = 5 if complexity == "simple" else (10 if complexity == "medium" else 15)
        skills = self._generate_skills(num_skills)
        
        # Assemble the resume
        resume = {
            "doc_type": "resume",
            "personal_info": {
                "first_name": first_name,
                "last_name": last_name,
                "email": email,
                "phone": phone,
                "city": city,
                "state": state,
                "country": country
            },
            "education": education,
            "experience": experience,
            "skills": skills,
            "complexity": complexity
        }
        
        return resume
    
    def _generate_skills(self, num_skills: int) -> List[str]:
        """Generate a list of professional skills."""
        technical_skills = [
            "Python", "TensorFlow", "PyTorch", "Scikit-learn", "Java", "C++", "SQL", 
            "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Git", "CI/CD", 
            "Deep Learning", "Natural Language Processing", "Computer Vision", 
            "Reinforcement Learning", "Data Analysis", "Data Visualization", 
            "JavaScript", "React", "Node.js", "TypeScript", "REST APIs"
        ]
        
        soft_skills = [
            "Project Management", "Team Leadership", "Communication", "Problem Solving",
            "Critical Thinking", "Time Management", "Adaptability", "Collaboration",
            "Creativity", "Attention to Detail", "Research"
        ]
        
        # Combine and randomly select skills
        all_skills = technical_skills + soft_skills
        selected_skills = random.sample(all_skills, min(num_skills, len(all_skills)))
        
        return selected_skills
    
    def _generate_job_description(self) -> str:
        """Generate a synthetic job description."""
        descriptions = [
            "Led a team of engineers to develop machine learning models for production.",
            "Designed and implemented scalable data processing pipelines for big data analytics.",
            "Contributed to open-source projects and published research papers on ML algorithms.",
            "Optimized system performance achieving 40% improvement in processing time.",
            "Developed APIs for ML model deployment and integration with front-end applications.",
            "Created data visualization dashboards for business intelligence reporting.",
            "Conducted research on cutting-edge AI techniques and translated to practical applications.",
            "Mentored junior engineers and conducted technical interviews for new hires.",
            "Built end-to-end ML pipelines from data ingestion to model deployment.",
            "Improved accuracy of recommendation systems using reinforcement learning techniques."
        ]
        
        # Select 1-3 descriptions and combine them
        selected = random.sample(descriptions, random.randint(1, 3))
        return " ".join(selected)
    
    def _generate_recommendation_letter(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic recommendation letter.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic recommendation letter data
        """
        # Generate recommender information
        recommender_first_name = random.choice(FIRST_NAMES)
        recommender_last_name = random.choice(LAST_NAMES)
        recommender_title = random.choice(JOB_TITLES)
        recommender_company = random.choice(COMPANIES)
        
        # Generate basic letter structure
        recommendation_date = (datetime.now() - timedelta(days=random.randint(0, 180))).strftime("%B %d, %Y")
        
        # Generate key points based on complexity
        num_points = 2 if complexity == "simple" else (4 if complexity == "medium" else 6)
        key_points = self._generate_recommendation_points(num_points)
        
        # Generate relationship context
        relationship_contexts = [
            f"worked with the candidate as their manager for {random.randint(1, 5)} years",
            f"supervised the candidate's doctoral research for {random.randint(2, 6)} years",
            f"collaborated with the candidate on {random.randint(2, 10)} research projects",
            f"mentored the candidate during their time at {recommender_company}",
            f"served as the candidate's advisor for their {random.choice(['PhD', 'Masters', 'research'])} program"
        ]
        relationship = random.choice(relationship_contexts)
        
        # Assemble the recommendation letter
        letter = {
            "doc_type": "recommendations",
            "recommender_info": {
                "first_name": recommender_first_name,
                "last_name": recommender_last_name,
                "title": recommender_title,
                "company": recommender_company,
                "email": f"{recommender_first_name.lower()}.{recommender_last_name.lower()}@{recommender_company.lower().replace(' ', '')}.com"
            },
            "recommendation_date": recommendation_date,
            "relationship": relationship,
            "key_points": key_points,
            "complexity": complexity
        }
        
        return letter
    
    def _generate_recommendation_points(self, num_points: int) -> List[str]:
        """Generate key points for a recommendation letter."""
        points = [
            "Exceptional technical skills and problem-solving abilities that far exceed expectations for their level.",
            "Demonstrated extraordinary ability in developing novel machine learning algorithms that have been adopted industry-wide.",
            "Published groundbreaking research in top-tier academic journals and conferences.",
            "Led a team that delivered revolutionary product features that significantly impacted business metrics.",
            "Recipient of multiple prestigious awards for contributions to the field.",
            "Invited as keynote speaker at major industry conferences due to recognized expertise.",
            "Holds patents for innovative technical solutions that address critical industry challenges.",
            "Consistently delivers results of the highest quality, even under challenging circumstances.",
            "Demonstrates remarkable leadership and mentoring abilities that elevate the entire team.",
            "Possesses a unique combination of technical depth and breadth that is rare in the industry."
        ]
        
        selected_points = random.sample(points, min(num_points, len(points)))
        return selected_points
    
    def _generate_award_certificate(self, complexity: str) -> Dict[str, Any]:
        """Generate a synthetic award certificate.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic award certificate data
        """
        # Generate basic award information
        award_types = [
            "Excellence in Research", "Outstanding Contribution", "Innovation Award",
            "Technical Leadership", "Distinguished Engineer", "Best Paper Award",
            "Breakthrough of the Year", "Rising Star Award", "Industry Impact Award"
        ]
        
        award_organizations = [
            "IEEE", "ACM", "National Science Foundation", "World Economic Forum",
            "MIT Technology Review", "Google Research", "Microsoft Research", 
            "International Conference on Machine Learning", "NeurIPS", "AAAI"
        ]
        
        # Select award details
        award_name = random.choice(award_types)
        organization = random.choice(award_organizations)
        award_date = (datetime.now() - timedelta(days=random.randint(30, 1095))).strftime("%B %d, %Y")
        
        # Generate citation based on complexity
        citation_length = "short" if complexity == "simple" else ("medium" if complexity == "medium" else "long")
        citation = self._generate_award_citation(citation_length)
        
        # Assemble the award certificate
        award = {
            "doc_type": "awards",
            "award_name": award_name,
            "organization": organization,
            "award_date": award_date,
            "citation": citation,
            "significance": self._generate_award_significance(),
            "complexity": complexity
        }
        
        return award
    
    def _generate_award_citation(self, length: str) -> str:
        """Generate an award citation of the specified length."""
        short_citations = [
            "For outstanding contributions to machine learning algorithms.",
            "In recognition of pioneering work in artificial intelligence.",
            "For development of innovative solutions in computer vision."
        ]
        
        medium_citations = [
            "For outstanding contributions to the field of machine learning, particularly in the development of novel algorithms that have advanced the state of the art.",
            "In recognition of pioneering work in artificial intelligence that has demonstrated exceptional impact on both academic research and industry applications.",
            "For groundbreaking advancements in computer vision technologies that have significantly improved accuracy and efficiency in image recognition systems."
        ]
        
        long_citations = [
            "For outstanding contributions to the field of machine learning, particularly in the development of novel algorithms that have advanced the state of the art. Their work has been widely adopted in industry and has influenced countless research directions, demonstrating both theoretical excellence and practical impact.",
            "In recognition of pioneering work in artificial intelligence that has demonstrated exceptional impact on both academic research and industry applications. Their innovations have not only pushed theoretical boundaries but have also led to real-world systems that solve previously intractable problems.",
            "For groundbreaking advancements in computer vision technologies that have significantly improved accuracy and efficiency in image recognition systems. Their research has been instrumental in enabling new applications across multiple industries and has set new standards for excellence in the field."
        ]
        
        if length == "short":
            return random.choice(short_citations)
        elif length == "medium":
            return random.choice(medium_citations)
        else:
            return random.choice(long_citations)
    
    def _generate_award_significance(self) -> str:
        """Generate a description of an award's significance."""
        significances = [
            "This award is given to only the top 1% of researchers in the field annually.",
            "This recognition is considered equivalent to a lifetime achievement award in the industry.",
            "This award has been received by several Nobel laureates in previous years.",
            "This honor is bestowed on individuals whose work has fundamentally changed the direction of the field.",
            "This prestigious award is given to recognize work that bridges theoretical research and practical applications."
        ]
        
        return random.choice(significances)
    
    def _generate_o1_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic O-1 form data with placeholder fields.
        
        In a real implementation, this would generate actual form fields
        but for now we'll use a simplified representation.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic O-1 form data
        """
        # Generate a basic representation for now
        return {
            "doc_type": "o1",
            "form_type": "O-1 Visa",
            "complexity": complexity,
            "personal_info": self._generate_personal_info(),
            "employment_info": self._generate_employment_info(),
            "eligibility_categories": self._generate_eligibility_categories(),
            "form_completeness": random.randint(70, 95) if complexity != "simple" else random.randint(40, 70)
        }
    
    def _generate_i129_form(self, complexity: str) -> Dict[str, Any]:
        """Generate synthetic I-129 form data.
        
        Args:
            complexity: Complexity level
            
        Returns:
            Synthetic I-129 form data
        """
        # Generate a basic representation for now
        return {
            "doc_type": "i129",
            "form_type": "I-129 Petition",
            "complexity": complexity,
            "personal_info": self._generate_personal_info(),
            "employment_info": self._generate_employment_info(),
            "petition_details": self._generate_petition_details(),
            "form_completeness": random.randint(70, 95) if complexity != "simple" else random.randint(40, 70)
        }
    
    def _generate_personal_info(self) -> Dict[str, Any]:
        """Generate synthetic personal information."""
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        
        return {
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}@{random.choice(DOMAINS)}",
            "phone": f"({random.randint(100, 999)})-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
            "birth_date": (datetime.now() - timedelta(days=random.randint(10000, 15000))).strftime("%Y-%m-%d"),
            "country_of_birth": random.choice(COUNTRIES),
            "country_of_citizenship": random.choice(COUNTRIES),
            "gender": random.choice(["Male", "Female", "Other"]),
            "current_residential_address": f"{random.randint(1, 9999)} {random.choice(['Main', 'Oak', 'Pine', 'Maple', 'Cedar'])} St, {random.choice(CITIES)}, {random.choice(STATES)} {random.randint(10000, 99999)}"
        }
    
    def _generate_employment_info(self) -> Dict[str, Any]:
        """Generate synthetic employment information."""
        company = random.choice(COMPANIES)
        return {
            "employer_name": company,
            "employer_id": f"EIN-{random.randint(10, 99)}-{random.randint(1000000, 9999999)}",
            "job_title": random.choice(JOB_TITLES),
            "work_address": f"{random.randint(1, 999)} {random.choice(['Corporate', 'Technology', 'Innovation', 'Research'])} Park, {random.choice(CITIES)}, {random.choice(STATES)} {random.randint(10000, 99999)}",
            "annual_salary": f"${random.randint(100, 300)},000",
            "start_date": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d")
        }
    
    def _generate_eligibility_categories(self) -> Dict[str, bool]:
        """Generate synthetic O-1 eligibility categories."""
        return {
            "nationally_recognized_prizes": random.choice([True, False]),
            "membership_in_associations": random.choice([True, False]),
            "published_material": random.choice([True, False]),
            "judge_of_others": random.choice([True, False]),
            "scientific_contributions": random.choice([True, False]),
            "authored_scholarly_articles": random.choice([True, False]),
            "high_salary": random.choice([True, False]),
            "commercial_success": random.choice([True, False])
        }
    
    def _generate_petition_details(self) -> Dict[str, Any]:
        """Generate synthetic petition details for I-129."""
        return {
            "receipt_number": f"EAC-{random.randint(10, 99)}-{random.randint(100, 999)}-{random.randint(10000, 99999)}",
            "petition_type": "O-1A: Individuals with Extraordinary Ability in Sciences, Education, Business or Athletics",
            "requested_action": random.choice(["New Employment", "Continuation of stay", "Change of Employer"]),
            "basis_for_classification": "Extraordinary Ability in Sciences",
            "period_of_employment": {
                "from_date": (datetime.now() + timedelta(days=random.randint(30, 180))).strftime("%Y-%m-%d"),
                "to_date": (datetime.now() + timedelta(days=random.randint(730, 1095))).strftime("%Y-%m-%d")
            }
        }

# For testing
if __name__ == "__main__":
    generator = RuleBasedGenerator()
    
    # Generate and save a sample resume
    resume = generator.generate_synthetic_document("resume", "medium")
    generator.save_synthetic_document(resume, "resume")
    
    # Generate and save a sample recommendation letter
    letter = generator.generate_synthetic_document("recommendations", "medium")
    generator.save_synthetic_document(letter, "recommendations")
    
    print("Generated sample synthetic documents using rule-based generator!") 