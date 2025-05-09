#!/usr/bin/env python3
"""
Script to generate synthetic data for O-1 visa applications.

This script generates synthetic data using rule-based, RL-based, and advanced RL-based
generators to create a dataset for training ML models.
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add the root directory to the path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(ROOT_DIR))

# Import generators
from ml.rule_based_generator import RuleBasedGenerator
from ml.rl_based_generator import RLBasedGenerator
from ml.advanced_rl_generator import AdvancedRLGenerator

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Generate synthetic data for O-1 visa applications")
    
    parser.add_argument(
        "--output-dir",
        type=str,
        default=str(ROOT_DIR / "data" / "training" / "synthetic"),
        help="Directory to store synthetic data"
    )
    
    parser.add_argument(
        "--num-samples",
        type=int,
        default=10,
        help="Number of samples to generate for each document type"
    )
    
    parser.add_argument(
        "--generator",
        type=str,
        choices=["rule", "rl", "advanced_rl", "all"],
        default="all",
        help="Type of generator to use"
    )
    
    parser.add_argument(
        "--document-types",
        type=str,
        nargs="+",
        default=["resume", "recommendations", "o1", "i129"],
        help="Document types to generate"
    )
    
    parser.add_argument(
        "--complexity",
        type=str,
        choices=["simple", "medium", "complex"],
        default="medium",
        help="Complexity level of the generated documents"
    )
    
    parser.add_argument(
        "--train-episodes",
        type=int,
        default=100,
        help="Number of episodes to train the RL agents (if using RL)"
    )
    
    parser.add_argument(
        "--form-types-to-train",
        type=str,
        nargs="+",
        default=["o1", "i129"],
        help="Form types to train the RL agents on (if using RL)"
    )
    
    return parser.parse_args()

def generate_rule_based_data(output_dir: Path, document_types: List[str], num_samples: int, complexity: str) -> Dict[str, List[str]]:
    """Generate data using rule-based generator.
    
    Args:
        output_dir: Directory to save the generated data
        document_types: List of document types to generate
        num_samples: Number of samples to generate for each type
        complexity: Complexity level of the generated documents
        
    Returns:
        Dictionary mapping document types to lists of generated file paths
    """
    logger.info(f"Generating rule-based data: {num_samples} samples per document type")
    
    # Initialize generator
    generator = RuleBasedGenerator(output_dir=str(output_dir / "rule_based"))
    
    # Generate data for each document type
    results = {}
    for doc_type in document_types:
        logger.info(f"Generating {num_samples} {doc_type} documents using rule-based generator")
        paths = generator.generate_batch(doc_type, num_samples, complexity)
        results[doc_type] = paths
        logger.info(f"Generated {len(paths)} {doc_type} documents")
    
    return results

def generate_rl_based_data(output_dir: Path, document_types: List[str], num_samples: int, complexity: str, train_episodes: int, form_types_to_train: List[str]) -> Dict[str, List[str]]:
    """Generate data using RL-based generator.
    
    Args:
        output_dir: Directory to save the generated data
        document_types: List of document types to generate
        num_samples: Number of samples to generate for each type
        complexity: Complexity level of the generated documents
        train_episodes: Number of episodes to train the RL agents
        form_types_to_train: Form types to train the RL agents on
        
    Returns:
        Dictionary mapping document types to lists of generated file paths
    """
    logger.info(f"Generating RL-based data: {num_samples} samples per document type")
    
    # Initialize generator
    generator = RLBasedGenerator(output_dir=str(output_dir / "rl_based"))
    
    # Train the RL agents
    logger.info(f"Training RL agents for {train_episodes} episodes")
    generator.train(episodes=train_episodes)
    
    # Generate data for each document type
    results = {}
    for doc_type in document_types:
        logger.info(f"Generating {num_samples} {doc_type} documents using RL-based generator")
        paths = generator.generate_batch(doc_type, num_samples, complexity)
        results[doc_type] = paths
        logger.info(f"Generated {len(paths)} {doc_type} documents")
    
    return results

def generate_advanced_rl_data(output_dir: Path, document_types: List[str], num_samples: int, complexity: str, train_episodes: int, form_types_to_train: List[str]) -> Dict[str, List[str]]:
    """Generate data using advanced RL-based generator.
    
    Args:
        output_dir: Directory to save the generated data
        document_types: List of document types to generate
        num_samples: Number of samples to generate for each type
        complexity: Complexity level of the generated documents
        train_episodes: Number of episodes to train the RL agents
        form_types_to_train: Form types to train the RL agents on
        
    Returns:
        Dictionary mapping document types to lists of generated file paths
    """
    logger.info(f"Generating advanced RL-based data: {num_samples} samples per document type")
    
    # Initialize generator
    generator = AdvancedRLGenerator(output_dir=str(output_dir / "advanced_rl"))
    
    # Train the RL agents for each form type
    for form_type in form_types_to_train:
        if form_type in ["o1", "i129"]:
            logger.info(f"Training advanced RL agents for {train_episodes} episodes on {form_type} forms")
            generator.train(episodes=train_episodes, form_type=form_type)
    
    # Generate data for each document type
    results = {}
    for doc_type in document_types:
        logger.info(f"Generating {num_samples} {doc_type} documents using advanced RL-based generator")
        paths = generator.generate_batch(doc_type, num_samples, complexity)
        results[doc_type] = paths
        logger.info(f"Generated {len(paths)} {doc_type} documents")
    
    return results

def update_dataset_metadata(stats: Dict[str, Any]):
    """Update the dataset metadata with generation statistics.
    
    Args:
        stats: Generation statistics
    """
    metadata_path = ROOT_DIR / "data" / "training" / "metadata.json"
    
    if not metadata_path.exists():
        logger.warning(f"Metadata file not found: {metadata_path}")
        return
    
    try:
        # Read existing metadata
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        
        # Update synthetic counts
        for doc_type, count in stats.get("counts", {}).items():
            if doc_type in metadata["counts"]["synthetic"]:
                metadata["counts"]["synthetic"][doc_type] += count
        
        # Add generation timestamp
        if "generation_history" not in metadata:
            metadata["generation_history"] = []
        
        metadata["generation_history"].append({
            "timestamp": datetime.now().isoformat(),
            "generator_types": stats.get("generator_types", []),
            "counts": stats.get("counts", {}),
            "complexity": stats.get("complexity", "medium")
        })
        
        # Save updated metadata
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Updated dataset metadata: {metadata_path}")
    
    except Exception as e:
        logger.error(f"Error updating metadata: {str(e)}")

def main():
    """Main function to generate synthetic data."""
    args = parse_args()
    
    logger.info(f"Starting synthetic data generation")
    logger.info(f"Output directory: {args.output_dir}")
    logger.info(f"Document types: {args.document_types}")
    logger.info(f"Number of samples: {args.num_samples}")
    logger.info(f"Generator type: {args.generator}")
    logger.info(f"Complexity: {args.complexity}")
    logger.info(f"Training episodes: {args.train_episodes}")
    logger.info(f"Form types to train: {args.form_types_to_train}")
    
    # Create output directory
    output_dir = Path(args.output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize statistics
    stats = {
        "generator_types": [],
        "counts": {doc_type: 0 for doc_type in args.document_types},
        "complexity": args.complexity,
        "timestamp": datetime.now().isoformat()
    }
    
    # Generate rule-based data if requested
    if args.generator in ["rule", "all"]:
        rule_results = generate_rule_based_data(
            output_dir, 
            args.document_types, 
            args.num_samples, 
            args.complexity
        )
        
        stats["generator_types"].append("rule_based")
        for doc_type, paths in rule_results.items():
            stats["counts"][doc_type] += len(paths)
    
    # Generate RL-based data if requested
    if args.generator in ["rl", "all"]:
        rl_results = generate_rl_based_data(
            output_dir, 
            args.document_types, 
            args.num_samples, 
            args.complexity,
            args.train_episodes,
            args.form_types_to_train
        )
        
        stats["generator_types"].append("rl_based")
        for doc_type, paths in rl_results.items():
            stats["counts"][doc_type] += len(paths)
    
    # Generate advanced RL-based data if requested
    if args.generator in ["advanced_rl", "all"]:
        advanced_rl_results = generate_advanced_rl_data(
            output_dir, 
            args.document_types, 
            args.num_samples, 
            args.complexity,
            args.train_episodes,
            args.form_types_to_train
        )
        
        stats["generator_types"].append("advanced_rl_based")
        for doc_type, paths in advanced_rl_results.items():
            stats["counts"][doc_type] += len(paths)
    
    # Update dataset metadata
    update_dataset_metadata(stats)
    
    # Write generation statistics
    stats_path = output_dir / f"generation_stats_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(stats_path, 'w', encoding='utf-8') as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Generation statistics saved to: {stats_path}")
    logger.info(f"Synthetic data generation completed")

if __name__ == "__main__":
    main() 