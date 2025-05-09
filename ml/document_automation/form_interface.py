#!/usr/bin/env python3
"""
Form Filling Interface for Document Automation.

This module provides a high-level interface for automatically filling
O-1 visa application forms using the trained document filling model.
"""

import os
import json
import logging
import time
import torch
import numpy as np
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
import argparse

# Import local modules
from .template_processor import DocumentTemplate, TemplateFiller
from .model_architecture import load_model, DocumentFillingModel
from .training_pipeline import Tokenizer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Root directory for data
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
MODEL_DIR = ROOT_DIR / "data" / "models"
TEMPLATE_DIR = ROOT_DIR / "data" / "templates"
OUTPUT_DIR = ROOT_DIR / "data" / "output"


class FormFillingInterface:
    """High-level interface for form filling."""
    
    def __init__(
        self,
        model_path: Optional[Union[str, Path]] = None,
        vocab_path: Optional[Union[str, Path]] = None,
        template_dir: Optional[Union[str, Path]] = None,
        output_dir: Optional[Union[str, Path]] = None,
        device: str = "cuda" if torch.cuda.is_available() else "cpu"
    ):
        """Initialize the form filling interface.
        
        Args:
            model_path: Path to trained model weights
            vocab_path: Path to vocabulary file
            template_dir: Directory containing form templates
            output_dir: Directory to save filled forms
            device: Device to use for inference (cuda or cpu)
        """
        # Set directories
        self.model_path = Path(model_path) if model_path else MODEL_DIR / "best_model.pt"
        self.vocab_path = Path(vocab_path) if vocab_path else MODEL_DIR / "vocab.json"
        self.template_dir = Path(template_dir) if template_dir else TEMPLATE_DIR
        self.output_dir = Path(output_dir) if output_dir else OUTPUT_DIR
        self.device = device
        
        # Create output directory
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Load model and tokenizer
        self._load_model_and_tokenizer()
        
        # Load available templates
        self._load_templates()
    
    def _load_model_and_tokenizer(self):
        """Load the document filling model and tokenizer."""
        # Load tokenizer
        if not self.vocab_path.exists():
            raise FileNotFoundError(f"Vocabulary file not found: {self.vocab_path}")
        
        self.tokenizer = Tokenizer(vocab_file=self.vocab_path)
        
        # Load model
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model weights not found: {self.model_path}")
        
        self.model = load_model(
            path=self.model_path,
            vocab_size=len(self.tokenizer.vocab),
            embedding_dim=256,
            hidden_dim=512,
            encoder_layers=4,
            decoder_layers=4,
            num_heads=8,
            max_seq_length=128,
            dropout=0.1
        )
        
        self.model.to(self.device)
        self.model.eval()
        
        logger.info(f"Model and tokenizer loaded successfully")
    
    def _load_templates(self):
        """Load available form templates."""
        self.templates = {}
        
        # Find PDF files in template directory
        pdf_files = list(self.template_dir.glob("*.pdf"))
        
        if not pdf_files:
            logger.warning(f"No PDF templates found in {self.template_dir}")
            return
        
        # Load each template
        for pdf_file in pdf_files:
            template_name = pdf_file.stem
            
            # Check for corresponding fields file
            fields_file = pdf_file.with_suffix(".json")
            
            try:
                if fields_file.exists():
                    template = DocumentTemplate(pdf_file, fields_file)
                else:
                    template = DocumentTemplate(pdf_file)
                
                self.templates[template_name] = template
                logger.info(f"Loaded template: {template_name} with {len(template.fields)} fields")
            
            except Exception as e:
                logger.error(f"Error loading template {template_name}: {str(e)}")
        
        logger.info(f"Loaded {len(self.templates)} templates")
    
    def list_templates(self) -> List[str]:
        """List available templates.
        
        Returns:
            List of template names
        """
        return list(self.templates.keys())
    
    def get_field_names(self, template_name: str) -> List[str]:
        """Get field names for a template.
        
        Args:
            template_name: Name of the template
            
        Returns:
            List of field names
        """
        if template_name not in self.templates:
            raise ValueError(f"Template not found: {template_name}")
        
        return [field.name for field in self.templates[template_name].fields]
    
    def predict_field_values(
        self,
        field_names: List[str],
        context: Optional[Dict[str, Any]] = None,
        max_length: int = 128
    ) -> Dict[str, str]:
        """Predict values for a list of field names.
        
        Args:
            field_names: List of field names
            context: Optional context information to aid prediction
            max_length: Maximum sequence length for generated values
            
        Returns:
            Dictionary mapping field names to predicted values
        """
        # Encode field names
        encoded_names = [self.tokenizer.encode(name, max_length=max_length) for name in field_names]
        
        # Convert to tensor
        field_name_tensor = torch.tensor(encoded_names, dtype=torch.long).to(self.device)
        
        # Generate predictions
        with torch.no_grad():
            value_logits, type_logits = self.model(field_name_tensor)
            
            # Get predicted values
            predicted_indices = torch.argmax(value_logits, dim=-1).cpu().numpy()
            
            # Decode predictions
            predicted_values = [
                self.tokenizer.decode(indices)
                for indices in predicted_indices
            ]
        
        # Create mapping from field names to predicted values
        return {name: value for name, value in zip(field_names, predicted_values)}
    
    def fill_form(
        self,
        template_name: str,
        field_values: Optional[Dict[str, str]] = None,
        output_file: Optional[Union[str, Path]] = None,
        autopredict: bool = True
    ) -> Path:
        """Fill a form template with provided and/or predicted values.
        
        Args:
            template_name: Name of the template to fill
            field_values: Dictionary mapping field names to values
            output_file: Path to save the filled form
            autopredict: Whether to predict values for fields not provided
            
        Returns:
            Path to the filled form
        """
        if template_name not in self.templates:
            raise ValueError(f"Template not found: {template_name}")
        
        template = self.templates[template_name]
        
        # Initialize field values dictionary
        if field_values is None:
            field_values = {}
        
        # Get field names
        field_names = [field.name for field in template.fields]
        
        # Predict missing values if autopredict is enabled
        if autopredict:
            missing_fields = [name for name in field_names if name not in field_values]
            
            if missing_fields:
                logger.info(f"Predicting values for {len(missing_fields)} missing fields")
                predicted_values = self.predict_field_values(missing_fields)
                
                # Add predicted values to field_values
                field_values.update(predicted_values)
        
        # Create template filler
        filler = TemplateFiller(template)
        
        # Set output file path
        if output_file is None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_file = self.output_dir / f"{template_name}_{timestamp}.pdf"
        else:
            output_file = Path(output_file)
        
        # Fill the template
        logger.info(f"Filling template {template_name} with {len(field_values)} field values")
        filled_path = filler.fill_template(field_values, output_file)
        
        logger.info(f"Form filled successfully: {filled_path}")
        
        return filled_path
    
    def fill_form_batch(
        self,
        template_name: str,
        batch_data: List[Dict[str, str]],
        output_dir: Optional[Union[str, Path]] = None,
        autopredict: bool = True
    ) -> List[Path]:
        """Fill a form template with multiple sets of values (batch mode).
        
        Args:
            template_name: Name of the template to fill
            batch_data: List of dictionaries mapping field names to values
            output_dir: Directory to save filled forms
            autopredict: Whether to predict values for fields not provided
            
        Returns:
            List of paths to filled forms
        """
        if template_name not in self.templates:
            raise ValueError(f"Template not found: {template_name}")
        
        # Set output directory
        if output_dir is None:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            output_dir = self.output_dir / f"batch_{template_name}_{timestamp}"
        else:
            output_dir = Path(output_dir)
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Fill forms
        filled_paths = []
        
        for i, field_values in enumerate(batch_data):
            output_file = output_dir / f"{template_name}_{i+1}.pdf"
            
            filled_path = self.fill_form(
                template_name=template_name,
                field_values=field_values,
                output_file=output_file,
                autopredict=autopredict
            )
            
            filled_paths.append(filled_path)
        
        logger.info(f"Filled {len(filled_paths)} forms in batch mode")
        
        return filled_paths


def verify_model_and_templates():
    """Verify that the model and templates are available."""
    # Check model directory
    model_dir = MODEL_DIR
    if not model_dir.exists():
        logger.warning(f"Model directory not found: {model_dir}")
        model_dir.mkdir(parents=True, exist_ok=True)
    
    # Check for model files
    model_path = model_dir / "best_model.pt"
    vocab_path = model_dir / "vocab.json"
    
    if not model_path.exists():
        logger.warning(f"Model weights not found: {model_path}")
    
    if not vocab_path.exists():
        logger.warning(f"Vocabulary file not found: {vocab_path}")
    
    # Check template directory
    template_dir = TEMPLATE_DIR
    if not template_dir.exists():
        logger.warning(f"Template directory not found: {template_dir}")
        template_dir.mkdir(parents=True, exist_ok=True)
    
    # Check for template files
    pdf_files = list(template_dir.glob("*.pdf"))
    if not pdf_files:
        logger.warning(f"No PDF templates found in {template_dir}")


def command_line_interface():
    """Command-line interface for form filling."""
    parser = argparse.ArgumentParser(description="O-1 Visa Form Filling Interface")
    
    # Main arguments
    parser.add_argument("--template", type=str, help="Template name to fill")
    parser.add_argument("--output", type=str, help="Output file path")
    parser.add_argument("--model", type=str, help="Path to model weights")
    parser.add_argument("--vocab", type=str, help="Path to vocabulary file")
    
    # Subcommands
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # List templates command
    list_parser = subparsers.add_parser("list", help="List available templates")
    
    # Fields command
    fields_parser = subparsers.add_parser("fields", help="List fields for a template")
    fields_parser.add_argument("template", type=str, help="Template name")
    
    # Fill command
    fill_parser = subparsers.add_parser("fill", help="Fill a form")
    fill_parser.add_argument("template", type=str, help="Template name")
    fill_parser.add_argument("--json", type=str, help="JSON file with field values")
    fill_parser.add_argument("--output", type=str, help="Output file path")
    fill_parser.add_argument("--no-autopredict", action="store_true", help="Disable value prediction")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Create interface
    interface = FormFillingInterface(
        model_path=args.model,
        vocab_path=args.vocab
    )
    
    # Execute command
    if args.command == "list":
        templates = interface.list_templates()
        print(f"Available templates ({len(templates)}):")
        for i, template in enumerate(templates, 1):
            print(f"{i}. {template}")
    
    elif args.command == "fields":
        field_names = interface.get_field_names(args.template)
        print(f"Fields in template '{args.template}' ({len(field_names)}):")
        for i, field in enumerate(field_names, 1):
            print(f"{i}. {field}")
    
    elif args.command == "fill":
        # Load field values from JSON if provided
        field_values = {}
        if args.json:
            json_path = Path(args.json)
            if not json_path.exists():
                print(f"Error: JSON file not found: {json_path}")
                return
            
            with open(json_path, "r", encoding="utf-8") as f:
                field_values = json.load(f)
        
        # Fill the form
        filled_path = interface.fill_form(
            template_name=args.template,
            field_values=field_values,
            output_file=args.output,
            autopredict=not args.no_autopredict
        )
        
        print(f"Form filled successfully: {filled_path}")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    # Verify model and templates
    verify_model_and_templates()
    
    # Run command-line interface
    command_line_interface() 