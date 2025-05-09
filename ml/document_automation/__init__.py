"""
Document Automation Module for O-1 Visa Application Pipeline.

This module provides models and tools for automatically filling
O-1 visa application forms using trained models and templates.
"""

from .data_loader import SyntheticDataLoader, DocumentPairDataset
from .template_processor import DocumentTemplate, TemplateFiller
from .model_architecture import DocumentFillingModel, create_model, save_model, load_model
from .training_pipeline import Tokenizer, FormFillingTrainer, train_model
from .form_interface import FormFillingInterface, verify_model_and_templates
from .evaluation import FormFillingEvaluator, evaluate_model

__version__ = "0.1.0" 