#!/usr/bin/env python3
"""
Model Architecture for Document Automation.

This module provides the neural network architecture and components
for the document filling model that automates O-1 visa applications.
"""

import os
import json
import logging
import torch
import torch.nn as nn
import torch.nn.functional as F
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FieldEmbeddingLayer(nn.Module):
    """Embeds field names and values into a continuous space."""
    
    def __init__(
        self,
        vocab_size: int,
        embedding_dim: int = 256,
        dropout: float = 0.1
    ):
        """Initialize the field embedding layer.
        
        Args:
            vocab_size: Size of the vocabulary for tokenization
            embedding_dim: Dimension of the embedding vectors
            dropout: Dropout probability
        """
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embedding_dim)
        self.dropout = nn.Dropout(dropout)
        
    def forward(self, x):
        """Forward pass through the embedding layer.
        
        Args:
            x: Input tensor of token indices
            
        Returns:
            Embedded representation
        """
        return self.dropout(self.embedding(x))


class FieldEncoder(nn.Module):
    """Encodes field information using a transformer architecture."""
    
    def __init__(
        self,
        input_dim: int,
        hidden_dim: int = 512,
        num_layers: int = 4,
        num_heads: int = 8,
        dropout: float = 0.1
    ):
        """Initialize the field encoder.
        
        Args:
            input_dim: Dimension of input embeddings
            hidden_dim: Dimension of hidden layers
            num_layers: Number of transformer layers
            num_heads: Number of attention heads
            dropout: Dropout probability
        """
        super().__init__()
        
        self.input_projection = nn.Linear(input_dim, hidden_dim)
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden_dim,
            nhead=num_heads,
            dim_feedforward=hidden_dim * 4,
            dropout=dropout,
            activation='gelu',
            batch_first=True
        )
        
        self.transformer_encoder = nn.TransformerEncoder(
            encoder_layer=encoder_layer,
            num_layers=num_layers
        )
        
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x, mask=None):
        """Forward pass through the field encoder.
        
        Args:
            x: Input tensor of embedded token sequences
            mask: Optional attention mask
            
        Returns:
            Encoded field representations
        """
        x = self.input_projection(x)
        x = self.dropout(x)
        return self.transformer_encoder(x, src_key_padding_mask=mask)


class FormContextEncoder(nn.Module):
    """Encodes the entire form context using cross-attention."""
    
    def __init__(
        self,
        input_dim: int,
        hidden_dim: int = 512,
        num_layers: int = 4,
        num_heads: int = 8,
        dropout: float = 0.1
    ):
        """Initialize the form context encoder.
        
        Args:
            input_dim: Dimension of input embeddings
            hidden_dim: Dimension of hidden layers
            num_layers: Number of transformer layers
            num_heads: Number of attention heads
            dropout: Dropout probability
        """
        super().__init__()
        
        self.input_projection = nn.Linear(input_dim, hidden_dim)
        
        decoder_layer = nn.TransformerDecoderLayer(
            d_model=hidden_dim,
            nhead=num_heads,
            dim_feedforward=hidden_dim * 4,
            dropout=dropout,
            activation='gelu',
            batch_first=True
        )
        
        self.transformer_decoder = nn.TransformerDecoder(
            decoder_layer=decoder_layer,
            num_layers=num_layers
        )
        
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, tgt, memory, tgt_mask=None, memory_mask=None):
        """Forward pass through the form context encoder.
        
        Args:
            tgt: Target sequence (current field being processed)
            memory: Memory from field encoder (all fields)
            tgt_mask: Optional target mask
            memory_mask: Optional memory mask
            
        Returns:
            Contextualized field representations
        """
        tgt = self.input_projection(tgt)
        tgt = self.dropout(tgt)
        return self.transformer_decoder(tgt, memory, tgt_mask=tgt_mask, memory_mask=memory_mask)


class FieldValuePredictor(nn.Module):
    """Predicts field values based on field name and form context."""
    
    def __init__(
        self,
        hidden_dim: int,
        vocab_size: int,
        max_seq_length: int = 128,
        dropout: float = 0.1
    ):
        """Initialize the field value predictor.
        
        Args:
            hidden_dim: Dimension of hidden layers
            vocab_size: Size of the vocabulary for output generation
            max_seq_length: Maximum sequence length for generated values
            dropout: Dropout probability
        """
        super().__init__()
        
        self.max_seq_length = max_seq_length
        
        # Predict the next token in sequence
        self.output_projection = nn.Linear(hidden_dim, vocab_size)
        
        # For classification of field types (text, number, date, checkbox, etc.)
        self.field_type_classifier = nn.Linear(hidden_dim, 8)  # 8 common field types
        
        self.dropout = nn.Dropout(dropout)
    
    def forward(self, x):
        """Forward pass through the field value predictor.
        
        Args:
            x: Input tensor of contextualized field representations
            
        Returns:
            Token prediction logits and field type classification logits
        """
        x = self.dropout(x)
        return self.output_projection(x), self.field_type_classifier(x)


class DocumentFillingModel(nn.Module):
    """Complete model for document filling automation."""
    
    def __init__(
        self,
        vocab_size: int,
        embedding_dim: int = 256,
        hidden_dim: int = 512,
        encoder_layers: int = 4,
        decoder_layers: int = 4,
        num_heads: int = 8,
        max_seq_length: int = 128,
        dropout: float = 0.1
    ):
        """Initialize the document filling model.
        
        Args:
            vocab_size: Size of the vocabulary
            embedding_dim: Dimension of the embedding vectors
            hidden_dim: Dimension of hidden layers
            encoder_layers: Number of transformer encoder layers
            decoder_layers: Number of transformer decoder layers
            num_heads: Number of attention heads
            max_seq_length: Maximum sequence length for field values
            dropout: Dropout probability
        """
        super().__init__()
        
        self.embedding_layer = FieldEmbeddingLayer(
            vocab_size=vocab_size,
            embedding_dim=embedding_dim,
            dropout=dropout
        )
        
        self.field_encoder = FieldEncoder(
            input_dim=embedding_dim,
            hidden_dim=hidden_dim,
            num_layers=encoder_layers,
            num_heads=num_heads,
            dropout=dropout
        )
        
        self.form_context_encoder = FormContextEncoder(
            input_dim=embedding_dim,
            hidden_dim=hidden_dim,
            num_layers=decoder_layers,
            num_heads=num_heads,
            dropout=dropout
        )
        
        self.field_value_predictor = FieldValuePredictor(
            hidden_dim=hidden_dim,
            vocab_size=vocab_size,
            max_seq_length=max_seq_length,
            dropout=dropout
        )
    
    def forward(
        self,
        field_names,
        field_values=None,
        field_name_mask=None,
        field_value_mask=None,
        target_field_idx=None
    ):
        """Forward pass through the document filling model.
        
        Args:
            field_names: Tensor of tokenized field names
            field_values: Optional tensor of tokenized field values
            field_name_mask: Optional mask for field names
            field_value_mask: Optional mask for field values
            target_field_idx: Index of the target field to predict
            
        Returns:
            Predicted field values and field types
        """
        # Embed field names
        embedded_field_names = self.embedding_layer(field_names)
        
        # Encode all fields
        encoded_fields = self.field_encoder(embedded_field_names, mask=field_name_mask)
        
        if field_values is not None:
            # For training mode with known field values
            embedded_field_values = self.embedding_layer(field_values)
            
            # Get target field context
            if target_field_idx is not None:
                # For single target field prediction
                target_field_context = encoded_fields[target_field_idx].unsqueeze(0)
            else:
                # For all fields prediction
                target_field_context = encoded_fields
            
            # Generate contextualized field representations
            contextualized_fields = self.form_context_encoder(
                embedded_field_values,
                target_field_context,
                memory_mask=field_value_mask
            )
        else:
            # For inference mode
            # Start with a special token embedding
            batch_size = encoded_fields.size(0)
            device = encoded_fields.device
            
            # Start token is first in vocabulary
            start_token = torch.ones((batch_size, 1), dtype=torch.long, device=device)
            embedded_start = self.embedding_layer(start_token)
            
            contextualized_fields = embedded_start
        
        # Predict field values and types
        return self.field_value_predictor(contextualized_fields)


def create_model(
    vocab_size: int,
    embedding_dim: int = 256,
    hidden_dim: int = 512,
    encoder_layers: int = 4,
    decoder_layers: int = 4,
    num_heads: int = 8,
    max_seq_length: int = 128,
    dropout: float = 0.1
) -> DocumentFillingModel:
    """Create a document filling model with the specified parameters.
    
    Args:
        vocab_size: Size of the vocabulary
        embedding_dim: Dimension of the embedding vectors
        hidden_dim: Dimension of hidden layers
        encoder_layers: Number of transformer encoder layers
        decoder_layers: Number of transformer decoder layers
        num_heads: Number of attention heads
        max_seq_length: Maximum sequence length for field values
        dropout: Dropout probability
        
    Returns:
        Initialized DocumentFillingModel
    """
    return DocumentFillingModel(
        vocab_size=vocab_size,
        embedding_dim=embedding_dim,
        hidden_dim=hidden_dim,
        encoder_layers=encoder_layers,
        decoder_layers=decoder_layers,
        num_heads=num_heads,
        max_seq_length=max_seq_length,
        dropout=dropout
    )


def save_model(model: DocumentFillingModel, path: Union[str, Path]):
    """Save model weights to disk.
    
    Args:
        model: The model to save
        path: Path to save the model to
    """
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    torch.save(model.state_dict(), path)
    logger.info(f"Model saved to {path}")


def load_model(
    path: Union[str, Path],
    vocab_size: int,
    embedding_dim: int = 256,
    hidden_dim: int = 512,
    encoder_layers: int = 4,
    decoder_layers: int = 4,
    num_heads: int = 8,
    max_seq_length: int = 128,
    dropout: float = 0.1
) -> DocumentFillingModel:
    """Load model weights from disk.
    
    Args:
        path: Path to load the model from
        vocab_size: Size of the vocabulary
        embedding_dim: Dimension of the embedding vectors
        hidden_dim: Dimension of hidden layers
        encoder_layers: Number of transformer encoder layers
        decoder_layers: Number of transformer decoder layers
        num_heads: Number of attention heads
        max_seq_length: Maximum sequence length for field values
        dropout: Dropout probability
        
    Returns:
        Loaded DocumentFillingModel
    """
    path = Path(path)
    
    if not path.exists():
        raise FileNotFoundError(f"Model file not found: {path}")
    
    model = create_model(
        vocab_size=vocab_size,
        embedding_dim=embedding_dim,
        hidden_dim=hidden_dim,
        encoder_layers=encoder_layers,
        decoder_layers=decoder_layers,
        num_heads=num_heads,
        max_seq_length=max_seq_length,
        dropout=dropout
    )
    
    model.load_state_dict(torch.load(path))
    logger.info(f"Model loaded from {path}")
    
    return model


def test_model():
    """Test the document filling model."""
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
    
    # Create fake input data
    batch_size = 2
    num_fields = 5
    seq_length = 10
    
    field_names = torch.randint(0, 1000, (batch_size, num_fields, seq_length))
    field_values = torch.randint(0, 1000, (batch_size, num_fields, seq_length))
    
    # Forward pass
    output_logits, field_type_logits = model(field_names, field_values)
    
    print(f"Output logits shape: {output_logits.shape}")
    print(f"Field type logits shape: {field_type_logits.shape}")
    
    return output_logits, field_type_logits


if __name__ == "__main__":
    test_model() 