#!/usr/bin/env python3
"""
Test script for Document Automation Module.

This script demonstrates how to use the various components
of the document automation module.
"""

import os
import sys
import logging
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Import module components
from ml.document_automation import (
    SyntheticDataLoader,
    DocumentTemplate,
    TemplateFiller,
    DocumentFillingModel,
    create_model,
    save_model,
    load_model,
    Tokenizer,
    FormFillingTrainer,
    train_model,
    FormFillingInterface,
    verify_model_and_templates,
    FormFillingEvaluator,
    evaluate_model
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def test_data_loader():
    """Test the synthetic data loader."""
    logger.info("Testing synthetic data loader...")
    
    # Initialize data loader
    data_loader = SyntheticDataLoader(
        include_generators=["rule_based", "rl_based", "advanced_rl"],
        doc_types=["o1", "i129"],
        validation_split=0.2,
        test_split=0.1
    )
    
    # Load data
    stats = data_loader.load_data()
    
    logger.info(f"Loaded {stats['total_examples']} examples")
    logger.info(f"Train: {stats['by_split']['train']}, "
               f"Validation: {stats['by_split']['val']}, "
               f"Test: {stats['by_split']['test']}")


def test_model_architecture():
    """Test the document filling model architecture."""
    logger.info("Testing model architecture...")
    
    # Create a small test model
    model = create_model(
        vocab_size=1000,
        embedding_dim=64,
        hidden_dim=128,
        encoder_layers=2,
        decoder_layers=2,
        num_heads=4,
        max_seq_length=64,
        dropout=0.1
    )
    
    # Print model summary (parameters count)
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    logger.info(f"Model created with {total_params} total parameters")
    logger.info(f"Trainable parameters: {trainable_params}")


def test_tokenizer():
    """Test the tokenizer functionality."""
    logger.info("Testing tokenizer...")
    
    # Create tokenizer
    tokenizer = Tokenizer(max_vocab_size=10000)
    
    # Build a small vocabulary
    texts = [
        "family name",
        "given name",
        "date of birth",
        "address",
        "city",
        "state",
        "zip code",
        "country of birth",
        "employment authorization",
        "o1 visa applicant"
    ]
    
    tokenizer.build_vocab(texts)
    
    # Test encoding and decoding
    for text in texts:
        encoded = tokenizer.encode(text, max_length=10)
        decoded = tokenizer.decode(encoded)
        
        logger.info(f"Original: '{text}'")
        logger.info(f"Encoded: {encoded}")
        logger.info(f"Decoded: '{decoded}'")


def test_integration():
    """Test an integration of components."""
    logger.info("Testing integration of components...")
    
    # Check if we have the required directories and files
    ROOT_DIR = Path(__file__).resolve().parent.parent.parent
    MODEL_DIR = ROOT_DIR / "data" / "models"
    TEMPLATE_DIR = ROOT_DIR / "data" / "templates"
    
    # Make sure directories exist
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    
    # Create a tiny model for testing
    model = create_model(
        vocab_size=100,
        embedding_dim=32,
        hidden_dim=64,
        encoder_layers=1,
        decoder_layers=1,
        num_heads=2,
        max_seq_length=32,
        dropout=0.1
    )
    
    # Save model
    model_path = MODEL_DIR / "test_model.pt"
    save_model(model, model_path)
    logger.info(f"Saved test model to {model_path}")
    
    # Create tokenizer
    tokenizer = Tokenizer(max_vocab_size=100)
    tokenizer.build_vocab(["test", "field", "name", "value"])
    
    # Save vocabulary
    vocab_path = MODEL_DIR / "test_vocab.json"
    tokenizer.save_vocab(vocab_path)
    logger.info(f"Saved test vocabulary to {vocab_path}")
    
    # Verify we have O-1 template
    template_path = ROOT_DIR / "o1-form-template.pdf"
    o1_template_exists = template_path.exists()
    
    if o1_template_exists:
        logger.info(f"Found O-1 template at {template_path}")
        
        # Create symlink to templates directory
        template_link = TEMPLATE_DIR / "o1-form-template.pdf"
        if not template_link.exists():
            os.symlink(template_path, template_link)
            logger.info(f"Created symlink to O-1 template at {template_link}")
    else:
        logger.warning(f"O-1 template not found at {template_path}")
    
    # Initialize form filling interface with our test model
    logger.info("Initializing form filling interface...")
    
    try:
        interface = FormFillingInterface(
            model_path=model_path,
            vocab_path=vocab_path
        )
        
        templates = interface.list_templates()
        logger.info(f"Available templates: {templates}")
        
        if templates:
            # Get fields for first template
            template_name = templates[0]
            fields = interface.get_field_names(template_name)
            logger.info(f"Fields in {template_name}: {fields[:5]}...")
    except Exception as e:
        logger.error(f"Error initializing interface: {str(e)}")


def run_all_tests():
    """Run all tests."""
    tests = [
        test_data_loader,
        test_model_architecture,
        test_tokenizer,
        test_integration
    ]
    
    for test in tests:
        try:
            test()
            logger.info(f"Test '{test.__name__}' completed successfully\n")
        except Exception as e:
            logger.error(f"Test '{test.__name__}' failed: {str(e)}\n")


if __name__ == "__main__":
    # Run individual test
    if len(sys.argv) > 1:
        test_name = sys.argv[1]
        
        if test_name == "data_loader":
            test_data_loader()
        elif test_name == "model":
            test_model_architecture()
        elif test_name == "tokenizer":
            test_tokenizer()
        elif test_name == "integration":
            test_integration()
        else:
            logger.error(f"Unknown test: {test_name}")
    else:
        # Run all tests
        run_all_tests() 