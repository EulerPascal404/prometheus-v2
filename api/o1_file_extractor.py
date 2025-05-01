import os
import random
import re
import ast
from pdfrw import PdfReader, PdfWriter, PdfDict, PdfName
from glob import glob
from pathlib import Path


def clean_field_name(field_name):
    """Cleans noisy characters from field names."""
    if field_name:
        return re.sub(r'\\\d+', '', field_name).strip('()')
    return field_name

def extract_filled_pdf_values(filled_pdf, output_txt_path):
    template = PdfReader(filled_pdf)
    extracted_data = []

    for page_num, page in enumerate(template.pages, start=1):
        annotations = page.get('/Annots')
        if annotations:
            for annotation in annotations:
                if annotation.get('/Subtype') == '/Widget':
                    original_name = annotation.get('/T')
                    field_value = annotation.get('/V')
                    field_type = annotation.get('/FT')

                    cleaned_name = clean_field_name(original_name) if original_name else None

                    # Determine available options
                    if field_type == '/Tx':
                        available_options = "Text input"
                    elif field_type == '/Btn':
                        available_options = list(annotation.AP.D)
                    elif field_type == '/Ch':
                        opts = annotation.get('/Opt')
                        available_options = [opt[0].replace('(', '').replace(')', '') for opt in opts] if opts else []
                    else:
                        available_options = None

                    original_key = original_name.replace('\\', '/')

                    if cleaned_name:
                        extracted_data.append(f"Page: {page_num}")
                        extracted_data.append(f"Original Key: {original_key}")
                        extracted_data.append(f"Available Options: {available_options}")
                        extracted_data.append("-" * 50)  # Separator for readability
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(output_txt_path), exist_ok=True)

    # Save to text file
    with open(output_txt_path, 'w', encoding='utf-8') as txt_file:
        txt_file.write("\n".join(extracted_data))

base_dir = Path(__file__).parent.parent
trimmed_pdf_path = str(base_dir / "o1-form-template-cleaned-o1only.pdf")
file_pths = [trimmed_pdf_path]  # Only process the trimmed O-1 PDF

for i, pth in enumerate(file_pths):
    output_path = str(base_dir / f"extracted_form_data/page_{i+1}.txt")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    extract_filled_pdf_values(pth, output_path)
