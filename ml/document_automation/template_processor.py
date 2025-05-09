#!/usr/bin/env python3
"""
Template Processor for Document Automation.

This module provides utilities for processing document templates
and filling them with data from the synthetic data generator.
"""

import os
import json
import logging
import tempfile
from pathlib import Path
from typing import Dict, List, Any, Optional, Union, Tuple
import fitz  # PyMuPDF
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Root directory for templates
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
TEMPLATE_DIR = ROOT_DIR / "data" / "templates"

class FormField:
    """Represents a field in a form template."""
    
    def __init__(
        self,
        name: str,
        field_type: str,
        x: float,
        y: float,
        width: float,
        height: float,
        page: int = 0,
        options: Optional[List[str]] = None
    ):
        """Initialize a form field.
        
        Args:
            name: Field name
            field_type: Type of field (text, checkbox, dropdown, etc.)
            x: X-coordinate of the field (normalized 0.0-1.0)
            y: Y-coordinate of the field (normalized 0.0-1.0)
            width: Width of the field (normalized 0.0-1.0)
            height: Height of the field (normalized 0.0-1.0)
            page: Page number (0-indexed)
            options: List of options for dropdown/radio fields
        """
        self.name = name
        self.field_type = field_type
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.page = page
        self.options = options or []
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the field to a dictionary.
        
        Returns:
            Dictionary representation of the field
        """
        return {
            "name": self.name,
            "field_type": self.field_type,
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height,
            "page": self.page,
            "options": self.options
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'FormField':
        """Create a form field from a dictionary.
        
        Args:
            data: Dictionary containing field data
            
        Returns:
            FormField instance
        """
        return cls(
            name=data["name"],
            field_type=data["field_type"],
            x=data["x"],
            y=data["y"],
            width=data["width"],
            height=data["height"],
            page=data.get("page", 0),
            options=data.get("options", [])
        )


class DocumentTemplate:
    """Represents a document template with form fields."""
    
    def __init__(
        self,
        template_file: Union[str, Path],
        fields_file: Optional[Union[str, Path]] = None
    ):
        """Initialize a document template.
        
        Args:
            template_file: Path to the template PDF file
            fields_file: Optional path to a JSON file with field definitions
        """
        self.template_file = Path(template_file)
        self.fields_file = Path(fields_file) if fields_file else None
        
        if not self.template_file.exists():
            raise FileNotFoundError(f"Template file not found: {self.template_file}")
        
        # Initialize empty fields list
        self.fields: List[FormField] = []
        
        # Load fields if fields file is provided
        if self.fields_file and self.fields_file.exists():
            self._load_fields()
        else:
            # Try to extract fields from the PDF (if it has form fields)
            self._extract_fields()
    
    def _load_fields(self):
        """Load fields from the fields JSON file."""
        try:
            with open(self.fields_file, "r", encoding="utf-8") as f:
                fields_data = json.load(f)
            
            self.fields = [FormField.from_dict(field_data) for field_data in fields_data]
            logger.info(f"Loaded {len(self.fields)} fields from {self.fields_file}")
            
        except Exception as e:
            logger.error(f"Error loading fields from {self.fields_file}: {str(e)}")
            self.fields = []
    
    def _extract_fields(self):
        """Extract fields from the PDF if it has form fields."""
        try:
            doc = fitz.open(self.template_file)
            
            # Check if the PDF has form fields
            if doc.is_form_pdf:
                logger.info(f"PDF has form fields: {self.template_file}")
                
                # Extract fields
                for widget in doc.widgets():
                    field_name = widget.field_name
                    field_type = widget.field_type_string
                    
                    # Get field position
                    rect = widget.rect
                    page_width = doc[widget.page_number].rect.width
                    page_height = doc[widget.page_number].rect.height
                    
                    # Normalize coordinates to 0.0-1.0
                    x = rect.x0 / page_width
                    y = rect.y0 / page_height
                    width = (rect.x1 - rect.x0) / page_width
                    height = (rect.y1 - rect.y0) / page_height
                    
                    # Get options for choice fields
                    options = []
                    if field_type in ["Choice", "ListBox"]:
                        options = widget.choice_values
                    
                    # Create form field
                    field = FormField(
                        name=field_name,
                        field_type=field_type,
                        x=x,
                        y=y,
                        width=width,
                        height=height,
                        page=widget.page_number,
                        options=options
                    )
                    
                    self.fields.append(field)
                
                logger.info(f"Extracted {len(self.fields)} fields from {self.template_file}")
            else:
                logger.warning(f"PDF does not have form fields: {self.template_file}")
            
            doc.close()
            
        except Exception as e:
            logger.error(f"Error extracting fields from {self.template_file}: {str(e)}")
    
    def save_fields(self, output_file: Optional[Union[str, Path]] = None) -> Path:
        """Save field definitions to a JSON file.
        
        Args:
            output_file: Path to save the fields to (default: same name as template with .json extension)
            
        Returns:
            Path to the saved fields file
        """
        if not output_file:
            output_file = self.template_file.with_suffix(".json")
        
        output_file = Path(output_file)
        
        # Serialize fields to JSON
        fields_data = [field.to_dict() for field in self.fields]
        
        # Save to file
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(fields_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved {len(self.fields)} fields to {output_file}")
        
        return output_file
    
    def add_field(self, field: FormField):
        """Add a field to the template.
        
        Args:
            field: Field to add
        """
        self.fields.append(field)
    
    def get_field_by_name(self, name: str) -> Optional[FormField]:
        """Get a field by name.
        
        Args:
            name: Name of the field to find
            
        Returns:
            Field with the given name, or None if not found
        """
        for field in self.fields:
            if field.name == name:
                return field
        
        return None
    
    def get_field_mapping(self) -> Dict[str, FormField]:
        """Get a mapping of field names to field objects.
        
        Returns:
            Dictionary mapping field names to field objects
        """
        return {field.name: field for field in self.fields}
    
    def visualize_fields(self, output_file: Optional[Union[str, Path]] = None) -> Path:
        """Create a visual representation of the fields on the template.
        
        Args:
            output_file: Path to save the visualization to
            
        Returns:
            Path to the visualization file
        """
        if not output_file:
            output_file = self.template_file.with_name(f"{self.template_file.stem}_fields.pdf")
        
        output_file = Path(output_file)
        
        # Open the template PDF
        doc = fitz.open(self.template_file)
        
        # Draw fields on each page
        for field in self.fields:
            page = doc[field.page]
            
            # Get page dimensions
            page_width = page.rect.width
            page_height = page.rect.height
            
            # Calculate absolute coordinates
            x0 = field.x * page_width
            y0 = field.y * page_height
            x1 = (field.x + field.width) * page_width
            y1 = (field.y + field.height) * page_height
            
            # Draw a rectangle around the field
            rect = fitz.Rect(x0, y0, x1, y1)
            page.draw_rect(rect, color=(1, 0, 0), width=1)
            
            # Add field name as annotation
            page.insert_text(fitz.Point(x0, y0 - 5), field.name, color=(1, 0, 0), fontsize=8)
        
        # Save the visualization
        doc.save(output_file)
        doc.close()
        
        logger.info(f"Saved field visualization to {output_file}")
        
        return output_file


class TemplateFiller:
    """Utility for filling document templates with data."""
    
    def __init__(
        self,
        template: DocumentTemplate,
        field_mapping: Optional[Dict[str, str]] = None
    ):
        """Initialize a template filler.
        
        Args:
            template: Document template to fill
            field_mapping: Optional mapping from data fields to template fields
        """
        self.template = template
        self.field_mapping = field_mapping or {}
    
    def fill_template(
        self,
        data: Dict[str, Any],
        output_file: Optional[Union[str, Path]] = None
    ) -> Path:
        """Fill the template with data.
        
        Args:
            data: Data to fill the template with
            output_file: Path to save the filled template to
            
        Returns:
            Path to the filled template
        """
        if not output_file:
            output_file = self.template.template_file.with_name(
                f"{self.template.template_file.stem}_filled.pdf"
            )
        
        output_file = Path(output_file)
        
        # Open the template PDF
        doc = fitz.open(self.template.template_file)
        
        # Fill the form fields if the PDF has form fields
        if doc.is_form_pdf:
            self._fill_pdf_forms(doc, data)
        else:
            # For non-form PDFs, overlay text directly
            self._overlay_text(doc, data)
        
        # Save the filled template
        doc.save(output_file)
        doc.close()
        
        logger.info(f"Saved filled template to {output_file}")
        
        return output_file
    
    def _fill_pdf_forms(self, doc: fitz.Document, data: Dict[str, Any]):
        """Fill form fields in a PDF.
        
        Args:
            doc: PyMuPDF document
            data: Data to fill the form with
        """
        for field in self.template.fields:
            # Get the data field name (may be different from the template field name)
            data_field = self.field_mapping.get(field.name, field.name)
            
            # Get the value from the data
            value = self._get_nested_value(data, data_field)
            
            if value is not None:
                # Convert value to string for text fields
                if field.field_type in ["Text", "TextField"]:
                    value = str(value)
                
                # Handle checkbox fields
                elif field.field_type in ["CheckBox", "CheckButton"]:
                    value = bool(value)
                
                # Handle choice fields
                elif field.field_type in ["Choice", "ListBox", "ComboBox"]:
                    # Make sure the value is in the options
                    if str(value) not in field.options:
                        logger.warning(f"Value '{value}' not in options for field '{field.name}'")
                        continue
                
                # Update the field
                try:
                    # Find the widget with this field name
                    for widget in doc.widgets():
                        if widget.field_name == field.name:
                            widget.field_value = value
                            break
                except Exception as e:
                    logger.error(f"Error setting value for field '{field.name}': {str(e)}")
    
    def _overlay_text(self, doc: fitz.Document, data: Dict[str, Any]):
        """Overlay text directly on the PDF for non-form PDFs.
        
        Args:
            doc: PyMuPDF document
            data: Data to overlay
        """
        for field in self.template.fields:
            # Get the data field name (may be different from the template field name)
            data_field = self.field_mapping.get(field.name, field.name)
            
            # Get the value from the data
            value = self._get_nested_value(data, data_field)
            
            if value is not None:
                page = doc[field.page]
                
                # Get page dimensions
                page_width = page.rect.width
                page_height = page.rect.height
                
                # Calculate absolute coordinates
                x = field.x * page_width
                y = field.y * page_height
                
                # Convert value to string
                text = str(value)
                
                # Insert text at the field position
                page.insert_text(
                    fitz.Point(x, y),
                    text,
                    fontsize=10,
                    color=(0, 0, 0)
                )
    
    def _get_nested_value(self, data: Dict[str, Any], field_path: str) -> Any:
        """Get a value from nested dictionaries using a dot-separated path.
        
        Args:
            data: Data dictionary
            field_path: Path to the field (e.g., "personal_info.first_name")
            
        Returns:
            Value at the specified path, or None if not found
        """
        parts = field_path.split(".")
        value = data
        
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


class TemplateField:
    """Interactive template field annotation tool."""
    
    def __init__(
        self,
        template_file: Union[str, Path],
        output_file: Optional[Union[str, Path]] = None
    ):
        """Initialize the template field annotation tool.
        
        Args:
            template_file: Path to the template PDF file
            output_file: Optional path to save the field definitions to
        """
        self.template_file = Path(template_file)
        self.output_file = Path(output_file) if output_file else self.template_file.with_suffix(".json")
        
        if not self.template_file.exists():
            raise FileNotFoundError(f"Template file not found: {self.template_file}")
        
        # Initialize fields list
        self.fields: List[FormField] = []
        
        # Load existing fields if available
        if self.output_file.exists():
            self._load_fields()
    
    def _load_fields(self):
        """Load fields from the output JSON file."""
        try:
            with open(self.output_file, "r", encoding="utf-8") as f:
                fields_data = json.load(f)
            
            self.fields = [FormField.from_dict(field_data) for field_data in fields_data]
            logger.info(f"Loaded {len(self.fields)} fields from {self.output_file}")
            
        except Exception as e:
            logger.error(f"Error loading fields from {self.output_file}: {str(e)}")
            self.fields = []
    
    def add_field_interactively(self, page: int, name: str, field_type: str, x: float, y: float, width: float, height: float, options: Optional[List[str]] = None):
        """Add a field interactively.
        
        Args:
            page: Page number (0-indexed)
            name: Field name
            field_type: Type of field
            x: X-coordinate (normalized 0.0-1.0)
            y: Y-coordinate (normalized 0.0-1.0)
            width: Width (normalized 0.0-1.0)
            height: Height (normalized 0.0-1.0)
            options: Optional list of options for choice fields
        """
        field = FormField(
            name=name,
            field_type=field_type,
            x=x,
            y=y,
            width=width,
            height=height,
            page=page,
            options=options or []
        )
        
        self.fields.append(field)
        logger.info(f"Added field: {name} ({field_type}) at ({x:.2f}, {y:.2f})")
    
    def save_fields(self) -> Path:
        """Save field definitions to the output JSON file.
        
        Returns:
            Path to the saved fields file
        """
        # Serialize fields to JSON
        fields_data = [field.to_dict() for field in self.fields]
        
        # Save to file
        with open(self.output_file, "w", encoding="utf-8") as f:
            json.dump(fields_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved {len(self.fields)} fields to {self.output_file}")
        
        return self.output_file
    
    def create_template(self) -> DocumentTemplate:
        """Create a document template from the field definitions.
        
        Returns:
            DocumentTemplate instance
        """
        # Save fields first
        self.save_fields()
        
        # Create template
        template = DocumentTemplate(self.template_file, self.output_file)
        
        return template


# For testing
def test_template_processor():
    """Test the template processor functionality."""
    # Check if we have any PDF files in the data directory
    pdf_files = list(ROOT_DIR.glob("data/**/*.pdf"))
    
    if not pdf_files:
        logger.warning("No PDF files found in the data directory")
        return
    
    # Use the first PDF file as a test template
    template_file = pdf_files[0]
    logger.info(f"Using template file: {template_file}")
    
    # Create a document template
    template = DocumentTemplate(template_file)
    
    # Check if the template has any fields
    if not template.fields:
        logger.info("Template does not have any fields, adding some test fields")
        
        # Add some test fields
        template.add_field(FormField(
            name="personal_info.first_name",
            field_type="Text",
            x=0.1,
            y=0.1,
            width=0.2,
            height=0.05,
            page=0
        ))
        
        template.add_field(FormField(
            name="personal_info.last_name",
            field_type="Text",
            x=0.5,
            y=0.1,
            width=0.2,
            height=0.05,
            page=0
        ))
        
        template.add_field(FormField(
            name="eligibility_categories.nationally_recognized_prizes",
            field_type="CheckBox",
            x=0.1,
            y=0.3,
            width=0.05,
            height=0.05,
            page=0
        ))
    
    # Save the field definitions
    fields_file = template.save_fields()
    logger.info(f"Saved field definitions to: {fields_file}")
    
    # Create a visualization of the fields
    viz_file = template.visualize_fields()
    logger.info(f"Created field visualization: {viz_file}")
    
    # Create a template filler
    filler = TemplateFiller(template)
    
    # Create some test data
    test_data = {
        "personal_info": {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com"
        },
        "eligibility_categories": {
            "nationally_recognized_prizes": True,
            "membership_in_associations": False
        }
    }
    
    # Fill the template
    filled_file = filler.fill_template(test_data)
    logger.info(f"Filled template: {filled_file}")


if __name__ == "__main__":
    test_template_processor() 