#!/usr/bin/env python3
"""
Evaluation Metrics and Testing for Document Automation.

This module provides utilities for evaluating the performance of
the document filling model and conducting comprehensive testing.
"""

import os
import json
import logging
import time
import torch
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
from tqdm import tqdm
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
import difflib
import Levenshtein
import nltk
from nltk.translate.bleu_score import sentence_bleu
from nltk.translate.meteor_score import meteor_score

# Import local modules
from .data_loader import SyntheticDataLoader, DocumentPairDataset
from .model_architecture import load_model
from .training_pipeline import Tokenizer
from .form_interface import FormFillingInterface

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Root directory for data
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_DIR = ROOT_DIR / "data" / "models"
RESULTS_DIR = ROOT_DIR / "data" / "evaluation"

# Download NLTK resources if needed
try:
    nltk.data.find('wordnet')
except LookupError:
    nltk.download('wordnet')


class PredictionMetrics:
    """Calculate metrics for field value predictions."""
    
    def __init__(self):
        """Initialize prediction metrics."""
        self.exact_match_count = 0
        self.total_count = 0
        self.character_errors = []
        self.bleu_scores = []
        self.meteor_scores = []
        self.field_specific_metrics = {}
    
    def add_prediction(
        self,
        field_name: str,
        predicted_value: str,
        true_value: str
    ):
        """Add a prediction result for evaluation.
        
        Args:
            field_name: Name of the field
            predicted_value: Predicted value
            true_value: True value
        """
        # Handle None values
        predicted_value = str(predicted_value) if predicted_value is not None else ""
        true_value = str(true_value) if true_value is not None else ""
        
        # Normalize whitespace
        predicted_value = " ".join(predicted_value.split())
        true_value = " ".join(true_value.split())
        
        # Track exact matches
        is_exact_match = (predicted_value == true_value)
        
        if is_exact_match:
            self.exact_match_count += 1
        
        self.total_count += 1
        
        # Calculate character error rate
        if true_value:
            char_error = Levenshtein.distance(predicted_value, true_value) / len(true_value)
        else:
            char_error = 1.0 if predicted_value else 0.0
        
        self.character_errors.append(char_error)
        
        # Calculate BLEU score
        reference = [true_value.split()]
        candidate = predicted_value.split()
        
        if candidate and true_value:
            try:
                bleu = sentence_bleu(reference, candidate, weights=(0.25, 0.25, 0.25, 0.25))
            except:
                bleu = 0.0
        else:
            bleu = 1.0 if (not true_value and not predicted_value) else 0.0
        
        self.bleu_scores.append(bleu)
        
        # Calculate METEOR score
        if candidate and true_value:
            try:
                meteor = meteor_score(reference, candidate)
            except:
                meteor = 0.0
        else:
            meteor = 1.0 if (not true_value and not predicted_value) else 0.0
        
        self.meteor_scores.append(meteor)
        
        # Track field-specific metrics
        if field_name not in self.field_specific_metrics:
            self.field_specific_metrics[field_name] = {
                "exact_match_count": 0,
                "total_count": 0,
                "character_errors": [],
                "bleu_scores": [],
                "meteor_scores": []
            }
        
        field_metrics = self.field_specific_metrics[field_name]
        
        if is_exact_match:
            field_metrics["exact_match_count"] += 1
        
        field_metrics["total_count"] += 1
        field_metrics["character_errors"].append(char_error)
        field_metrics["bleu_scores"].append(bleu)
        field_metrics["meteor_scores"].append(meteor)
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get evaluation metrics.
        
        Returns:
            Dictionary of evaluation metrics
        """
        if self.total_count == 0:
            return {
                "exact_match_accuracy": 0.0,
                "character_error_rate": 1.0,
                "bleu_score": 0.0,
                "meteor_score": 0.0,
                "field_specific_metrics": {}
            }
        
        # Calculate overall metrics
        exact_match_accuracy = self.exact_match_count / self.total_count
        character_error_rate = np.mean(self.character_errors)
        bleu_score = np.mean(self.bleu_scores)
        meteor_score = np.mean(self.meteor_scores)
        
        # Calculate field-specific metrics
        field_metrics = {}
        
        for field_name, metrics in self.field_specific_metrics.items():
            if metrics["total_count"] == 0:
                continue
            
            field_metrics[field_name] = {
                "exact_match_accuracy": metrics["exact_match_count"] / metrics["total_count"],
                "character_error_rate": np.mean(metrics["character_errors"]),
                "bleu_score": np.mean(metrics["bleu_scores"]),
                "meteor_score": np.mean(metrics["meteor_scores"]),
                "sample_count": metrics["total_count"]
            }
        
        return {
            "exact_match_accuracy": exact_match_accuracy,
            "character_error_rate": character_error_rate,
            "bleu_score": bleu_score,
            "meteor_score": meteor_score,
            "total_samples": self.total_count,
            "field_specific_metrics": field_metrics
        }


class FormFillingEvaluator:
    """Evaluate the form filling model."""
    
    def __init__(
        self,
        model_path: Optional[Union[str, Path]] = None,
        vocab_path: Optional[Union[str, Path]] = None,
        test_data_dir: Optional[Union[str, Path]] = None,
        results_dir: Optional[Union[str, Path]] = None,
        device: str = "cuda" if torch.cuda.is_available() else "cpu"
    ):
        """Initialize the evaluator.
        
        Args:
            model_path: Path to trained model weights
            vocab_path: Path to vocabulary file
            test_data_dir: Directory containing test data
            results_dir: Directory to save evaluation results
            device: Device to use for inference (cuda or cpu)
        """
        # Set paths
        self.model_path = Path(model_path) if model_path else MODEL_DIR / "best_model.pt"
        self.vocab_path = Path(vocab_path) if vocab_path else MODEL_DIR / "vocab.json"
        self.test_data_dir = Path(test_data_dir) if test_data_dir else ROOT_DIR / "data" / "training" / "synthetic"
        self.results_dir = Path(results_dir) if results_dir else RESULTS_DIR
        self.device = device
        
        # Create results directory
        self.results_dir.mkdir(parents=True, exist_ok=True)
        
        # Create form filling interface
        self.interface = FormFillingInterface(
            model_path=self.model_path,
            vocab_path=self.vocab_path,
            device=self.device
        )
        
        # Load model and tokenizer directly for more detailed evaluation
        self.model = self.interface.model
        self.tokenizer = self.interface.tokenizer
    
    def evaluate_test_set(
        self,
        doc_type: str = "o1",
        batch_size: int = 32,
        max_samples: Optional[int] = None
    ) -> Dict[str, Any]:
        """Evaluate the model on a test set.
        
        Args:
            doc_type: Type of document to evaluate
            batch_size: Batch size for evaluation
            max_samples: Maximum number of samples to evaluate
            
        Returns:
            Dictionary of evaluation metrics
        """
        # Load test data
        data_loader = SyntheticDataLoader(
            data_dir=self.test_data_dir,
            doc_types=[doc_type]
        )
        
        data_loader.load_data()
        
        # Create test dataset
        test_dataset = DocumentPairDataset(
            data_loader=data_loader,
            doc_type=doc_type,
            split="test"
        )
        
        # Limit the number of samples if specified
        if max_samples and max_samples < len(test_dataset):
            indices = np.random.choice(len(test_dataset), max_samples, replace=False)
            test_samples = [test_dataset[i] for i in indices]
        else:
            test_samples = [test_dataset[i] for i in range(len(test_dataset))]
        
        # Initialize metrics
        metrics = PredictionMetrics()
        
        # Process samples in batches
        for i in tqdm(range(0, len(test_samples), batch_size), desc="Evaluating"):
            batch = test_samples[i:i+batch_size]
            
            # Extract field names and true values
            batch_field_names = []
            batch_true_values = []
            
            for sample in batch:
                field_name = sample.document_data.get("field_name", "")
                field_value = sample.document_data.get("field_value", "")
                
                batch_field_names.append(field_name)
                batch_true_values.append(field_value)
            
            # Predict field values
            predictions = self.interface.predict_field_values(batch_field_names)
            
            # Calculate metrics
            for j, field_name in enumerate(batch_field_names):
                predicted_value = predictions.get(field_name, "")
                true_value = batch_true_values[j]
                
                metrics.add_prediction(field_name, predicted_value, true_value)
        
        # Get evaluation metrics
        results = metrics.get_metrics()
        
        # Save results
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        results_file = self.results_dir / f"evaluation_{doc_type}_{timestamp}.json"
        
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Evaluation results saved to {results_file}")
        
        return results
    
    def evaluate_field_types(
        self,
        doc_type: str = "o1",
        batch_size: int = 32,
        max_samples: Optional[int] = None
    ) -> Dict[str, float]:
        """Evaluate the model's field type prediction accuracy.
        
        Args:
            doc_type: Type of document to evaluate
            batch_size: Batch size for evaluation
            max_samples: Maximum number of samples to evaluate
            
        Returns:
            Dictionary of evaluation metrics for field type prediction
        """
        # Load test data
        data_loader = SyntheticDataLoader(
            data_dir=self.test_data_dir,
            doc_types=[doc_type]
        )
        
        data_loader.load_data()
        
        # Create test dataset
        test_dataset = DocumentPairDataset(
            data_loader=data_loader,
            doc_type=doc_type,
            split="test"
        )
        
        # Limit the number of samples if specified
        if max_samples and max_samples < len(test_dataset):
            indices = np.random.choice(len(test_dataset), max_samples, replace=False)
            test_samples = [test_dataset[i] for i in indices]
        else:
            test_samples = [test_dataset[i] for i in range(len(test_dataset))]
        
        # Initialize metrics
        all_true_types = []
        all_predicted_types = []
        
        # Set model to evaluation mode
        self.model.eval()
        
        # Process samples in batches
        for i in tqdm(range(0, len(test_samples), batch_size), desc="Evaluating field types"):
            batch = test_samples[i:i+batch_size]
            
            # Prepare input data
            batch_field_names = []
            batch_true_types = []
            
            for sample in batch:
                field_name = sample.document_data.get("field_name", "")
                field_type = sample.document_data.get("field_type", 0)
                
                batch_field_names.append(field_name)
                batch_true_types.append(field_type)
            
            # Encode field names
            encoded_names = [
                self.tokenizer.encode(name, max_length=128)
                for name in batch_field_names
            ]
            
            # Convert to tensor
            field_name_tensor = torch.tensor(encoded_names, dtype=torch.long).to(self.device)
            
            # Generate predictions
            with torch.no_grad():
                _, type_logits = self.model(field_name_tensor)
                
                # Get predicted types
                predicted_types = torch.argmax(type_logits, dim=-1).cpu().numpy()
            
            # Track true and predicted types
            all_true_types.extend(batch_true_types)
            all_predicted_types.extend(predicted_types)
        
        # Calculate metrics
        accuracy = accuracy_score(all_true_types, all_predicted_types)
        precision, recall, f1, _ = precision_recall_fscore_support(
            all_true_types,
            all_predicted_types,
            average="weighted"
        )
        
        results = {
            "accuracy": accuracy,
            "precision": precision,
            "recall": recall,
            "f1_score": f1
        }
        
        # Save results
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        results_file = self.results_dir / f"field_type_evaluation_{doc_type}_{timestamp}.json"
        
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Field type evaluation results saved to {results_file}")
        
        return results
    
    def evaluate_form_filling(
        self,
        template_name: str,
        test_data_file: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
        max_samples: Optional[int] = None
    ) -> Dict[str, Any]:
        """Evaluate the end-to-end form filling process.
        
        Args:
            template_name: Name of the template to fill
            test_data_file: Path to a JSON file with test data
            output_dir: Directory to save filled forms
            max_samples: Maximum number of samples to evaluate
            
        Returns:
            Dictionary of evaluation metrics
        """
        # Set output directory
        if output_dir is None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_dir = self.results_dir / f"form_filling_{template_name}_{timestamp}"
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load test data
        test_data_file = Path(test_data_file)
        
        if not test_data_file.exists():
            raise FileNotFoundError(f"Test data file not found: {test_data_file}")
        
        with open(test_data_file, "r", encoding="utf-8") as f:
            test_data = json.load(f)
        
        # Limit the number of samples if specified
        if max_samples and max_samples < len(test_data):
            test_data = test_data[:max_samples]
        
        # Initialize metrics
        metrics = PredictionMetrics()
        
        # Process each sample
        for i, sample in enumerate(tqdm(test_data, desc="Filling forms")):
            # Extract true field values
            true_values = sample.get("field_values", {})
            
            # Get field names
            field_names = list(true_values.keys())
            
            # Predict field values
            predicted_values = self.interface.predict_field_values(field_names)
            
            # Fill the form
            output_file = output_dir / f"{template_name}_{i+1}.pdf"
            
            self.interface.fill_form(
                template_name=template_name,
                field_values=predicted_values,
                output_file=output_file,
                autopredict=False  # Use our predictions, not the interface's
            )
            
            # Calculate metrics
            for field_name, true_value in true_values.items():
                predicted_value = predicted_values.get(field_name, "")
                
                metrics.add_prediction(field_name, predicted_value, true_value)
        
        # Get evaluation metrics
        results = metrics.get_metrics()
        
        # Save results
        results_file = output_dir / f"evaluation_results.json"
        
        with open(results_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Form filling evaluation results saved to {results_file}")
        
        return results


def evaluate_model(
    model_path: Optional[Union[str, Path]] = None,
    vocab_path: Optional[Union[str, Path]] = None,
    test_data_dir: Optional[Union[str, Path]] = None,
    results_dir: Optional[Union[str, Path]] = None,
    doc_type: str = "o1",
    batch_size: int = 32,
    max_samples: Optional[int] = None
):
    """Evaluate the document filling model.
    
    Args:
        model_path: Path to trained model weights
        vocab_path: Path to vocabulary file
        test_data_dir: Directory containing test data
        results_dir: Directory to save evaluation results
        doc_type: Type of document to evaluate
        batch_size: Batch size for evaluation
        max_samples: Maximum number of samples to evaluate
    """
    # Create evaluator
    evaluator = FormFillingEvaluator(
        model_path=model_path,
        vocab_path=vocab_path,
        test_data_dir=test_data_dir,
        results_dir=results_dir
    )
    
    # Evaluate test set
    logger.info("Evaluating test set...")
    test_results = evaluator.evaluate_test_set(
        doc_type=doc_type,
        batch_size=batch_size,
        max_samples=max_samples
    )
    
    logger.info(f"Test set evaluation results:")
    logger.info(f"  Exact match accuracy: {test_results['exact_match_accuracy']:.4f}")
    logger.info(f"  Character error rate: {test_results['character_error_rate']:.4f}")
    logger.info(f"  BLEU score: {test_results['bleu_score']:.4f}")
    logger.info(f"  METEOR score: {test_results['meteor_score']:.4f}")
    
    # Evaluate field type prediction
    logger.info("Evaluating field type prediction...")
    type_results = evaluator.evaluate_field_types(
        doc_type=doc_type,
        batch_size=batch_size,
        max_samples=max_samples
    )
    
    logger.info(f"Field type prediction results:")
    logger.info(f"  Accuracy: {type_results['accuracy']:.4f}")
    logger.info(f"  Precision: {type_results['precision']:.4f}")
    logger.info(f"  Recall: {type_results['recall']:.4f}")
    logger.info(f"  F1 score: {type_results['f1_score']:.4f}")
    
    return {
        "test_results": test_results,
        "type_results": type_results
    }


if __name__ == "__main__":
    # Evaluate model with default parameters
    evaluate_model() 