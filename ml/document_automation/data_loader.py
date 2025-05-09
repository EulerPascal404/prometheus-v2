#!/usr/bin/env python3
"""
Data Loader for Document Automation Module.

This module provides utilities for loading and processing synthetic data
for training document automation models.
"""

import os
import json
import logging
import random
from pathlib import Path
from typing import Dict, List, Any, Tuple, Optional, Union, Iterator
import numpy as np
import pandas as pd
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Root directory for data
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT_DIR / "data" / "training" / "synthetic"

class SyntheticDataLoader:
    """Loader for synthetic training data."""
    
    def __init__(
        self, 
        data_dir: Optional[Union[str, Path]] = None,
        include_generators: Optional[List[str]] = None,
        doc_types: Optional[List[str]] = None,
        validation_split: float = 0.2,
        test_split: float = 0.1,
        seed: int = 42
    ):
        """Initialize the synthetic data loader.
        
        Args:
            data_dir: Directory containing synthetic data (default: data/training/synthetic)
            include_generators: List of generator types to include (rule_based, rl_based, advanced_rl)
            doc_types: List of document types to include (resume, o1, i129, etc.)
            validation_split: Fraction of data to use for validation
            test_split: Fraction of data to use for testing
            seed: Random seed for reproducibility
        """
        self.data_dir = Path(data_dir) if data_dir else DATA_DIR
        self.include_generators = include_generators or ["rule_based", "rl_based", "advanced_rl"]
        self.doc_types = doc_types or ["resume", "recommendations", "o1", "i129"]
        self.validation_split = validation_split
        self.test_split = test_split
        self.seed = seed
        
        # Set random seed for reproducibility
        random.seed(seed)
        np.random.seed(seed)
        
        # Initialize data storage
        self.data = {}
        self.train_data = {}
        self.val_data = {}
        self.test_data = {}
        
        # Track statistics
        self.stats = {
            "total_examples": 0,
            "by_generator": {},
            "by_doc_type": {},
            "by_split": {
                "train": 0,
                "val": 0,
                "test": 0
            }
        }
    
    def load_data(self) -> Dict[str, Any]:
        """Load and process all synthetic data.
        
        Returns:
            Dictionary containing statistics about the loaded data
        """
        logger.info(f"Loading synthetic data from {self.data_dir}")
        
        # Reset data
        self.data = {doc_type: [] for doc_type in self.doc_types}
        
        # Track stats by generator
        for generator in self.include_generators:
            self.stats["by_generator"][generator] = 0
        
        # Track stats by document type
        for doc_type in self.doc_types:
            self.stats["by_doc_type"][doc_type] = 0
        
        # Load data for each generator and document type
        for generator in self.include_generators:
            generator_dir = self.data_dir / generator
            
            if not generator_dir.exists():
                logger.warning(f"Generator directory not found: {generator_dir}")
                continue
            
            for doc_type in self.doc_types:
                doc_type_dir = generator_dir / doc_type
                
                if not doc_type_dir.exists():
                    logger.warning(f"Document type directory not found: {doc_type_dir}")
                    continue
                
                # Load all JSON files in the document type directory
                json_files = list(doc_type_dir.glob("*.json"))
                
                if not json_files:
                    logger.warning(f"No JSON files found in {doc_type_dir}")
                    continue
                
                logger.info(f"Loading {len(json_files)} {doc_type} files from {generator}")
                
                for json_file in tqdm(json_files, desc=f"Loading {generator}/{doc_type}"):
                    try:
                        with open(json_file, "r", encoding="utf-8") as f:
                            doc_data = json.load(f)
                            
                            # Add generator and source file information
                            doc_data["generator_type"] = generator
                            doc_data["source_file"] = str(json_file)
                            
                            self.data[doc_type].append(doc_data)
                            
                            # Update statistics
                            self.stats["total_examples"] += 1
                            self.stats["by_generator"][generator] += 1
                            self.stats["by_doc_type"][doc_type] += 1
                    
                    except Exception as e:
                        logger.error(f"Error loading {json_file}: {str(e)}")
        
        # Split the data into train, validation, and test sets
        self._split_data()
        
        logger.info(f"Loaded {self.stats['total_examples']} examples in total")
        logger.info(f"Train: {self.stats['by_split']['train']}, "
                   f"Validation: {self.stats['by_split']['val']}, "
                   f"Test: {self.stats['by_split']['test']}")
        
        return self.stats
    
    def _split_data(self):
        """Split the loaded data into train, validation, and test sets."""
        # Reset split data
        self.train_data = {doc_type: [] for doc_type in self.doc_types}
        self.val_data = {doc_type: [] for doc_type in self.doc_types}
        self.test_data = {doc_type: [] for doc_type in self.doc_types}
        
        # For each document type, split the data
        for doc_type in self.doc_types:
            # Shuffle the data
            doc_data = self.data[doc_type].copy()
            random.shuffle(doc_data)
            
            # Calculate split indices
            n_samples = len(doc_data)
            n_test = max(1, int(n_samples * self.test_split))
            n_val = max(1, int(n_samples * self.validation_split))
            n_train = n_samples - n_test - n_val
            
            # Split the data
            self.train_data[doc_type] = doc_data[:n_train]
            self.val_data[doc_type] = doc_data[n_train:n_train+n_val]
            self.test_data[doc_type] = doc_data[n_train+n_val:]
            
            # Update statistics
            self.stats["by_split"]["train"] += n_train
            self.stats["by_split"]["val"] += n_val
            self.stats["by_split"]["test"] += n_test
    
    def get_batch(self, batch_size: int, doc_type: str, split: str = "train") -> List[Dict[str, Any]]:
        """Get a batch of examples for a specific document type and split.
        
        Args:
            batch_size: Number of examples to include in the batch
            doc_type: Type of document to get examples for
            split: Which split to use (train, val, test)
            
        Returns:
            List of document examples
        """
        if doc_type not in self.doc_types:
            raise ValueError(f"Unknown document type: {doc_type}")
        
        if split == "train":
            data = self.train_data[doc_type]
        elif split == "val":
            data = self.val_data[doc_type]
        elif split == "test":
            data = self.test_data[doc_type]
        else:
            raise ValueError(f"Unknown split: {split}")
        
        if not data:
            raise ValueError(f"No data available for {doc_type} in {split} split")
        
        # Sample a batch of examples
        batch = random.sample(data, min(batch_size, len(data)))
        
        return batch
    
    def batch_generator(
        self, 
        batch_size: int, 
        doc_type: str, 
        split: str = "train", 
        shuffle: bool = True,
        epochs: Optional[int] = None
    ) -> Iterator[List[Dict[str, Any]]]:
        """Generate batches for training or evaluation.
        
        Args:
            batch_size: Number of examples per batch
            doc_type: Type of document to generate batches for
            split: Which split to use (train, val, test)
            shuffle: Whether to shuffle the data between epochs
            epochs: Number of epochs to generate (None for infinite)
            
        Yields:
            Batches of document examples
        """
        if doc_type not in self.doc_types:
            raise ValueError(f"Unknown document type: {doc_type}")
        
        if split == "train":
            data = self.train_data[doc_type]
        elif split == "val":
            data = self.val_data[doc_type]
        elif split == "test":
            data = self.test_data[doc_type]
        else:
            raise ValueError(f"Unknown split: {split}")
        
        if not data:
            raise ValueError(f"No data available for {doc_type} in {split} split")
        
        epoch = 0
        while epochs is None or epoch < epochs:
            # Shuffle the data if requested
            if shuffle:
                indices = np.random.permutation(len(data))
            else:
                indices = np.arange(len(data))
            
            # Generate batches
            for start_idx in range(0, len(indices), batch_size):
                end_idx = min(start_idx + batch_size, len(indices))
                batch_indices = indices[start_idx:end_idx]
                batch = [data[idx] for idx in batch_indices]
                
                yield batch
            
            epoch += 1
    
    def get_form_field_mapping(self, doc_type: str) -> Dict[str, List[str]]:
        """Get a mapping of all form fields for a document type.
        
        Args:
            doc_type: Type of document to get fields for
            
        Returns:
            Dictionary mapping field names to possible values
        """
        if doc_type not in self.doc_types:
            raise ValueError(f"Unknown document type: {doc_type}")
        
        field_mapping = {}
        
        # Combine all data for this document type
        all_data = (
            self.train_data.get(doc_type, []) + 
            self.val_data.get(doc_type, []) + 
            self.test_data.get(doc_type, [])
        )
        
        if not all_data:
            logger.warning(f"No data available for {doc_type}")
            return field_mapping
        
        # Extract all fields and their values
        for doc in all_data:
            self._extract_fields_recursive(doc, "", field_mapping)
        
        return field_mapping
    
    def _extract_fields_recursive(
        self, 
        obj: Any, 
        prefix: str, 
        field_mapping: Dict[str, List[Any]]
    ):
        """Recursively extract fields from a nested object.
        
        Args:
            obj: Object to extract fields from
            prefix: Prefix for field names
            field_mapping: Dictionary to update with field mappings
        """
        if isinstance(obj, dict):
            for key, value in obj.items():
                # Skip special keys
                if key in ["generator_type", "source_file", "doc_id", "generated_date"]:
                    continue
                
                field_name = f"{prefix}.{key}" if prefix else key
                
                if isinstance(value, (dict, list)):
                    self._extract_fields_recursive(value, field_name, field_mapping)
                else:
                    if field_name not in field_mapping:
                        field_mapping[field_name] = []
                    
                    if value is not None and value not in field_mapping[field_name]:
                        field_mapping[field_name].append(value)
        
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                list_prefix = f"{prefix}[{i}]"
                self._extract_fields_recursive(item, list_prefix, field_mapping)


class DocumentPair:
    """Represents a pair of document data and its filled template."""
    
    def __init__(
        self, 
        document_data: Dict[str, Any],
        template_file: Optional[Union[str, Path]] = None
    ):
        """Initialize a document pair.
        
        Args:
            document_data: Document data in dictionary format
            template_file: Path to template file (if available)
        """
        self.document_data = document_data
        self.template_file = Path(template_file) if template_file else None
        self.doc_type = document_data.get("doc_type", "unknown")
        
        # Check if filled template is available
        self.has_template = self.template_file is not None and self.template_file.exists()
    
    def get_field_value(self, field_path: str) -> Any:
        """Get the value of a specific field.
        
        Args:
            field_path: Path to the field (e.g., "personal_info.first_name")
            
        Returns:
            Value of the field
        """
        parts = field_path.split(".")
        value = self.document_data
        
        for part in parts:
            # Handle array indices in the path (e.g., education[0].university)
            if "[" in part and "]" in part:
                array_name, index_str = part.split("[", 1)
                index = int(index_str.split("]")[0])
                
                if array_name in value:
                    array_value = value[array_name]
                    if isinstance(array_value, list) and 0 <= index < len(array_value):
                        value = array_value[index]
                    else:
                        return None
                else:
                    return None
            else:
                if part in value:
                    value = value[part]
                else:
                    return None
        
        return value
    
    def to_feature_vector(self, field_mapping: Dict[str, List[Any]]) -> Dict[str, Any]:
        """Convert document data to a feature vector for model input.
        
        Args:
            field_mapping: Mapping of fields to possible values
            
        Returns:
            Feature vector representation of the document
        """
        features = {}
        
        for field in field_mapping:
            value = self.get_field_value(field)
            
            # Handle different types of values
            if isinstance(value, bool):
                features[field] = int(value)
            elif isinstance(value, (int, float)):
                features[field] = value
            elif isinstance(value, str):
                features[field] = value
            else:
                # For complex types or None, use a placeholder
                features[field] = None
        
        return features


class DocumentPairDataset:
    """Dataset of document pairs for training models."""
    
    def __init__(
        self,
        data_loader: SyntheticDataLoader,
        doc_type: str,
        split: str = "train",
        template_dir: Optional[Union[str, Path]] = None
    ):
        """Initialize a document pair dataset.
        
        Args:
            data_loader: Synthetic data loader
            doc_type: Type of document to create pairs for
            split: Which split to use (train, val, test)
            template_dir: Directory containing document templates
        """
        self.data_loader = data_loader
        self.doc_type = doc_type
        self.split = split
        self.template_dir = Path(template_dir) if template_dir else None
        
        # Get data for this document type and split
        if split == "train":
            self.data = data_loader.train_data.get(doc_type, [])
        elif split == "val":
            self.data = data_loader.val_data.get(doc_type, [])
        elif split == "test":
            self.data = data_loader.test_data.get(doc_type, [])
        else:
            raise ValueError(f"Unknown split: {split}")
        
        # Get field mapping
        self.field_mapping = data_loader.get_form_field_mapping(doc_type)
    
    def __len__(self) -> int:
        """Get the number of document pairs in the dataset."""
        return len(self.data)
    
    def __getitem__(self, idx: int) -> DocumentPair:
        """Get a document pair by index."""
        document_data = self.data[idx]
        
        # Find template file if template directory is provided
        template_file = None
        if self.template_dir:
            template_filename = f"{self.doc_type}_template.pdf"
            template_file = self.template_dir / template_filename
        
        return DocumentPair(document_data, template_file)
    
    def get_batch(self, batch_size: int, shuffle: bool = True) -> List[DocumentPair]:
        """Get a batch of document pairs.
        
        Args:
            batch_size: Number of pairs to include in the batch
            shuffle: Whether to shuffle the data
            
        Returns:
            List of document pairs
        """
        if shuffle:
            indices = np.random.randint(0, len(self.data), min(batch_size, len(self.data)))
        else:
            start_idx = 0
            end_idx = min(batch_size, len(self.data))
            indices = np.arange(start_idx, end_idx)
        
        return [self[idx] for idx in indices]
    
    def to_dataframe(self) -> pd.DataFrame:
        """Convert the dataset to a pandas DataFrame.
        
        Returns:
            DataFrame containing document data
        """
        # Flatten the document data
        flattened_data = []
        
        for document_data in self.data:
            flat_doc = {}
            
            # Extract fields using the field mapping
            for field in self.field_mapping:
                doc_pair = DocumentPair(document_data)
                flat_doc[field] = doc_pair.get_field_value(field)
            
            flattened_data.append(flat_doc)
        
        return pd.DataFrame(flattened_data)


# For testing
def test_data_loader():
    """Test the synthetic data loader."""
    loader = SyntheticDataLoader()
    stats = loader.load_data()
    
    print("Data loading statistics:")
    print(f"Total examples: {stats['total_examples']}")
    print("\nBy generator:")
    for generator, count in stats['by_generator'].items():
        print(f"  {generator}: {count}")
    
    print("\nBy document type:")
    for doc_type, count in stats['by_doc_type'].items():
        print(f"  {doc_type}: {count}")
    
    print("\nBy split:")
    for split, count in stats['by_split'].items():
        print(f"  {split}: {count}")
    
    # Test getting batches
    for doc_type in loader.doc_types:
        if loader.train_data.get(doc_type):
            print(f"\nSample batch for {doc_type}:")
            batch = loader.get_batch(2, doc_type, "train")
            for i, example in enumerate(batch):
                print(f"Example {i+1}:")
                if "personal_info" in example:
                    print(f"  Name: {example['personal_info'].get('first_name', '')} {example['personal_info'].get('last_name', '')}")
                if "doc_type" in example:
                    print(f"  Document Type: {example['doc_type']}")
                if "generator_type" in example:
                    print(f"  Generator: {example['generator_type']}")
    
    # Test document pair dataset
    for doc_type in loader.doc_types:
        if loader.train_data.get(doc_type):
            dataset = DocumentPairDataset(loader, doc_type, "train")
            print(f"\nDocument pair dataset for {doc_type}:")
            print(f"  Dataset size: {len(dataset)}")
            
            if len(dataset) > 0:
                doc_pair = dataset[0]
                print(f"  Sample field value - doc_type: {doc_pair.get_field_value('doc_type')}")
                
                if doc_type == "o1" and "personal_info" in doc_pair.document_data:
                    print(f"  Sample field value - first_name: {doc_pair.get_field_value('personal_info.first_name')}")


if __name__ == "__main__":
    test_data_loader() 