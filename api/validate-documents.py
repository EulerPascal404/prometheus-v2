from http.server import BaseHTTPRequestHandler
import json
import os
import base64
import tempfile
import logging
import sys
import time
from urllib.parse import parse_qs
from typing import Dict, Optional, List, Tuple
import PyPDF2
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path
from openai import OpenAI
import random
import re
from tqdm import tqdm
from glob import glob
from pdfrw import PdfReader, PdfWriter, PdfDict, PdfName
import pdfrw

# Function to parse summary text into structured arrays
def parse_summary(summary_text: str) -> Tuple[List[str], List[str], List[str]]:
    """
    Parse OpenAI summary response into strengths, weaknesses, and recommendations arrays.
    Handles various formats including [SEP] separators and bullet points.
    
    Args:
        summary_text: Raw text from OpenAI response
        
    Returns:
        Tuple of (strengths, weaknesses, recommendations) as lists of strings
    """
    logger.info("Parsing summary text into structured arrays")
    
    # Initialize empty arrays
    strengths = []
    weaknesses = []
    recommendations = []
    
    # Function to clean text items
    def clean_item(item: str) -> str:
        return item.strip().replace('- ', '', 1).replace('• ', '', 1).strip()
    
    try:
        # First try to split by section headers
        sections = {}
        current_section = None
        
        # Try to identify sections using common patterns
        for line in summary_text.split('\n'):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
                
            # Check for section headers
            lower_line = line.lower()
            if 'strengths:' in lower_line or 'strengths' == lower_line:
                current_section = 'strengths'
                continue
            elif 'weaknesses:' in lower_line or 'weaknesses' == lower_line:
                current_section = 'weaknesses'
                continue
            elif 'recommendations:' in lower_line or 'recommendations' == lower_line:
                current_section = 'recommendations'
                continue
                
            # Add content to the current section
            if current_section:
                if current_section not in sections:
                    sections[current_section] = []
                sections[current_section].append(line)
        
        # If we found structured sections, process them
        if sections:
            logger.info("Found structured sections in summary")
            
            # Process sections
            for section_name, lines in sections.items():
                section_text = ' '.join(lines)
                
                # Split by [SEP] if present, otherwise try bullet points or numbers
                if '[SEP]' in section_text:
                    items = [clean_item(item) for item in section_text.split('[SEP]') if item.strip()]
                else:
                    # Try to split by bullet points or numbers
                    bullet_items = re.findall(r'(?:^|\n)[\s]*(?:-|\*|•|\d+\.)\s*(.*?)(?=(?:^|\n)[\s]*(?:-|\*|•|\d+\.)|\Z)', section_text, re.DOTALL)
                    if bullet_items:
                        items = [clean_item(item) for item in bullet_items if item.strip()]
                    else:
                        # Just use sentences as a fallback
                        items = [clean_item(item) for item in re.split(r'(?<=[.!?])\s+', section_text) if item.strip()]
                
                # Add items to the appropriate array
                if section_name == 'strengths':
                    strengths.extend(items)
                elif section_name == 'weaknesses':
                    weaknesses.extend(items)
                elif section_name == 'recommendations':
                    recommendations.extend(items)
        else:
            # Alternative parsing if sections aren't clearly defined
            logger.info("No clear sections found, trying alternative parsing")
            
            # Try to find sections based on "Strengths:", "Weaknesses:", "Recommendations:" markers
            strength_match = re.search(r'Strengths:(.+?)(?=Weaknesses:|Recommendations:|$)', summary_text, re.DOTALL | re.IGNORECASE)
            weakness_match = re.search(r'Weaknesses:(.+?)(?=Strengths:|Recommendations:|$)', summary_text, re.DOTALL | re.IGNORECASE)
            recommendation_match = re.search(r'Recommendations:(.+?)(?=Strengths:|Weaknesses:|$)', summary_text, re.DOTALL | re.IGNORECASE)
            
            # Extract and process strengths
            if strength_match:
                strength_text = strength_match.group(1).strip()
                if '[SEP]' in strength_text:
                    strengths = [clean_item(item) for item in strength_text.split('[SEP]') if item.strip()]
                else:
                    # Try to find bullet points or fallback to sentences
                    strength_items = re.findall(r'(?:^|\n)[\s]*(?:-|\*|•|\d+\.)\s*(.*?)(?=(?:^|\n)[\s]*(?:-|\*|•|\d+\.)|\Z)', strength_text, re.DOTALL)
                    if strength_items:
                        strengths = [clean_item(item) for item in strength_items if item.strip()]
                    else:
                        strengths = [clean_item(item) for item in re.split(r'(?<=[.!?])\s+', strength_text) if item.strip()]
            
            # Extract and process weaknesses
            if weakness_match:
                weakness_text = weakness_match.group(1).strip()
                if '[SEP]' in weakness_text:
                    weaknesses = [clean_item(item) for item in weakness_text.split('[SEP]') if item.strip()]
                else:
                    # Try to find bullet points or fallback to sentences
                    weakness_items = re.findall(r'(?:^|\n)[\s]*(?:-|\*|•|\d+\.)\s*(.*?)(?=(?:^|\n)[\s]*(?:-|\*|•|\d+\.)|\Z)', weakness_text, re.DOTALL)
                    if weakness_items:
                        weaknesses = [clean_item(item) for item in weakness_items if item.strip()]
                    else:
                        weaknesses = [clean_item(item) for item in re.split(r'(?<=[.!?])\s+', weakness_text) if item.strip()]
            
            # Extract and process recommendations
            if recommendation_match:
                recommendation_text = recommendation_match.group(1).strip()
                if '[SEP]' in recommendation_text:
                    recommendations = [clean_item(item) for item in recommendation_text.split('[SEP]') if item.strip()]
                else:
                    # Try to find bullet points or fallback to sentences
                    recommendation_items = re.findall(r'(?:^|\n)[\s]*(?:-|\*|•|\d+\.)\s*(.*?)(?=(?:^|\n)[\s]*(?:-|\*|•|\d+\.)|\Z)', recommendation_text, re.DOTALL)
                    if recommendation_items:
                        recommendations = [clean_item(item) for item in recommendation_items if item.strip()]
                    else:
                        recommendations = [clean_item(item) for item in re.split(r'(?<=[.!?])\s+', recommendation_text) if item.strip()]
        
        # Ensure all arrays have at least one item for consistency
        if not strengths:
            strengths = ["Document does not contain identifiable strengths for O-1 visa application"]
        if not weaknesses:
            weaknesses = ["Document requires improvements to strengthen your O-1 visa application"]
        if not recommendations:
            recommendations = ["Consider consulting with an immigration attorney to improve your application materials"]
    
    except Exception as e:
        logger.error(f"Error parsing summary: {str(e)}")
        # Provide fallback values if parsing fails
        strengths = ["Error parsing strengths - please review the document summary"]
        weaknesses = ["Error parsing weaknesses - please review the document summary"]
        recommendations = ["Error parsing recommendations - please review the document summary"]
    
    logger.info(f"Parsed {len(strengths)} strengths, {len(weaknesses)} weaknesses, {len(recommendations)} recommendations")
    return strengths, weaknesses, recommendations

NUM_PAGES = 2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(env_path)

# Supabase setup
supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Make Supabase credentials optional instead of required
if not supabase_url or not supabase_key:
    logger.warning("Missing Supabase environment variables. Some functionality will be limited.")
    supabase_available = False
else:
    supabase_available = True

def get_supabase() -> Optional[Client]:
    """Get Supabase client if credentials are available"""
    if not supabase_available:
        logger.warning("Supabase credentials not available")
        return None
        
    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Error creating Supabase client: {str(e)}")
        return None

# ----- INCORPORATED FROM o1_rag_generation.py -----

def log_page_progress(page_num, total_pages, user_id, supabase):
    """Log progress for each page processed in RAG generation"""
    if supabase and user_id:
        progress_status = f"generating_rag_page_{page_num}_of_{total_pages}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            logger.info(f"RAG progress: {progress_status}")
        except Exception as e:
            logger.error(f"Error updating RAG page progress: {str(e)}")

def write_to_file(filename: str, content: str):
    """Writes the given content to a file."""
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "w", encoding="utf-8") as file:
        file.write(content)

def append_to_file(file_path, text):
    print(f"Appending to {file_path}")
    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'a', encoding="utf-8") as file:
        file.write(text + '\n')

print(os.getenv('OPENAI_API_KEY'))

# Initialize OpenAI client
openai_api_key = os.environ.get("OPENAI_API_KEY")
if not openai_api_key:
    logger.warning("Missing OPENAI_API_KEY environment variable. Document analysis will be limited.")
    openai_available = False
    client = None
else:
    openai_available = True
    client = OpenAI(api_key=openai_api_key)

def read_text_file(file_path):
    """Reads a text file and returns its content as a string."""
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()
    
def log_page_progress(page_num, total_pages, user_id, supabase):
    """Log progress for each page processed in RAG generation"""
    if supabase and user_id:
        progress_status = f"generating_rag_page_{page_num}_of_{total_pages}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            print(f"RAG progress: {progress_status}")
        except Exception as e:
            print(f"Error updating RAG page progress: {str(e)}")

def write_rag_responses(extra_info="", pages=None, user_id=None, supabase=None):
    # Use NUM_PAGES to limit the number of pages processed
    if pages is None:
        # Only process the first NUM_PAGES pages
        pages = list(range(1, min(38, NUM_PAGES + 1)))
    else:
        # Respect the limit if pages are provided
        pages = [p for p in pages if p <= NUM_PAGES]
    
    total_pages = len(pages)
    print(f"Will process {total_pages} pages out of {NUM_PAGES} maximum")
    
    # Get the base directory (demo folder) using the script's location
    base_dir = "data/"
    print(f"Base directory: {base_dir}")
    
    # Create all required directories
    required_dirs = [
        base_dir,
        base_dir + "extracted_text",
        base_dir + "extracted_form_data",
        base_dir + "rag_responses"
    ]
    
    for directory in required_dirs:
        try:
            os.makedirs(directory, exist_ok=True)
            print(f"Created/verified directory: {directory}")
        except Exception as e:
            print(f"Warning: Could not create directory {directory}: {str(e)}")
    
    # Use absolute paths for all file operations
    extracted_text_dir = base_dir + "extracted_text"
    
    # Try to find text files or create a dummy one for testing
    files = glob(str(extracted_text_dir + "/*.txt"))
    print(f"Found {len(files)} text files in {extracted_text_dir}")
    
    if len(files) == 0:
        # Create a dummy text file for testing if no files exist
        dummy_file = os.path.join(extracted_text_dir, "dummy_page_1.txt")
        try:
            with open(dummy_file, 'w', encoding='utf-8') as f:
                f.write("This is a dummy text file created because no extracted text was found.")
            files = [dummy_file]
            print(f"Created dummy file: {dummy_file}")
        except Exception as e:
            print(f"Warning: Could not create dummy file: {str(e)}")
    
    for file in files:
        print(f"  - {file}")
    
    # Clear history file before starting
    history_file = str(base_dir + "rag_responses/history.txt")
    try:
        os.makedirs(os.path.dirname(history_file), exist_ok=True)
        # Clear history file before we start
        with open(history_file, 'w', encoding='utf-8') as f:
            f.write("")
    except Exception as e:
        print(f"Warning: Could not create/clear history file: {str(e)}")

    output_text = ""

    response_dict = {}
    
    # Process each page with progress updates
    for idx, page_num in enumerate(pages):
        # Update progress before processing each page
        if supabase and user_id:
            log_page_progress(idx + 1, total_pages, user_id, supabase)
        
        form_data_file = str(base_dir + f"extracted_form_data/page_{page_num}.txt")
        print(f"Looking for form data file: {form_data_file}")
        
        try:
            # Read form data - handle missing files gracefully
            form_data = ""
            if os.path.exists(form_data_file):
                try:
                    form_data = read_text_file(form_data_file)
                    print(f"Successfully read form data file: {form_data_file}")
                except Exception as e:
                    print(f"Warning: Could not read form data file: {str(e)}")
            else:
                print(f"Warning: Form data file not found: {form_data_file}")
                # Try alternative path
                alt_form_data_file = str(Path.cwd() / f"extracted_form_data/page_{page_num}.txt")
                print(f"Trying alternative path: {alt_form_data_file}")
                try:
                    if os.path.exists(alt_form_data_file):
                        form_data = read_text_file(alt_form_data_file)
                        print(f"Successfully read form data from alternative path: {alt_form_data_file}")
                    else:
                        print(f"Alternative path also not found: {alt_form_data_file}")
                        # Continue with empty form data instead of skipping
                        form_data = "No form data available"
                except Exception as e:
                    print(f"Warning: Could not read form data from alternative path: {str(e)}")
                    form_data = "No form data available"
            
            # Get the extracted text for this page
            page_text = ""
            try:
                if len(files) > 0 and page_num-1 < len(files) and os.path.exists(files[page_num-1]):
                    page_text = read_text_file(files[page_num-1])
                    print(f"Successfully read page text from: {files[page_num-1]}")
                else:
                    print(f"Warning: Extracted text file not found for page {page_num}")
                    # Try alternative path
                    alt_page_file = str(Path.cwd() / f"extracted_text/page_{page_num}.txt")
                    print(f"Trying alternative path: {alt_page_file}")
                    if os.path.exists(alt_page_file):
                        page_text = read_text_file(alt_page_file)
                        print(f"Successfully read page text from alternative path: {alt_page_file}")
                    else:
                        print(f"Alternative path also not found: {alt_page_file}")
                        # Use first file if available, or provide dummy text
                        if len(files) > 0:
                            page_text = read_text_file(files[0])
                            print(f"Using first available file as fallback: {files[0]}")
                        else:
                            page_text = "No page text available for analysis"
                            print("Using dummy text as fallback")
            except Exception as e:
                print(f"Warning: Error reading page text: {str(e)}")
                page_text = "Error reading page text"
            
            # Use both texts, handling empty cases
            text_prompt = (form_data + "\n" + page_text).strip()
            if not text_prompt:
                text_prompt = "No text content available for analysis"

            try:
                response = client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You have been given a text file containing a form and a dictionary containing keys and possible options. You have also been given information about a user. Output the same dictionary but filled with the responses for an application for the user. It is very important that in the outputed dictionary, the keys are EXACTLY the same as the original keys. For select either yes or no, make sure to only check one of the boxes. Make sure written responses are clear, and detailed making a strong argument. For fields without enough information, fill N/A and specify the type: N/A_per = needs personal info, N/A_r = resume info needed, N/A_rl = recommendation letter info needed, N/A_p = publication info needed, N/A_ss = salary/success info needed, N/A_pm = professional membership info needed. Only fill out fields that can be entirely filled out with the user info provided, do not infer anything. Only output the dictionary. Don't include the word python or ```. Make sure that in python, eval(output) would return a dictionary with the same keys as the original dictionary." + extra_info},
                        {"role": "user", "content": text_prompt}
                    ]
                )

                # Check if the response output exists and has the expected structure
                print(f"Processing page {page_num}: Response received")
                if response and hasattr(response, 'choices') and len(response.choices) > 0:
                    response_text = response.choices[0].message.content
                    response_dict = merge_dicts(response_dict, eval(response_text))

            except Exception as e:
                print(f"Error getting OpenAI response: {str(e)}")
                output_text += f"Error processing page {page_num}: {str(e)}\n\n"
                continue

        except Exception as e:
            print(f"Error processing page {page_num}: {e}")
            output_text += f"Error processing page {page_num}: {str(e)}\n\n"
            continue

        # Add progress update after each page is processed
        if supabase and user_id and (idx % 3 == 0 or idx == len(pages) - 1):  # Update every 3 pages or on the last page
            log_page_progress(idx + 1, total_pages, user_id, supabase)
            
    print(f"Completed processing {total_pages} pages")
    return response_dict

def fill_and_check_pdf(input_pdf, output_pdf, response_dict, doc_type=None, user_id=None, supabase=None):
    
    template = PdfReader(input_pdf)
    total_pages = len(template.pages)
    
    print(f"Started filling PDF with {total_pages} pages")
    
    # Create field stats dictionary to track filled fields
    field_stats = {
        "user_info_filled": 0,
        "N/A_per": 0,  # personal info needed
        "N/A_r": 0,    # resume info needed
        "N/A_rl": 0,   # recommendation letters needed
        "N/A_ar": 0,   # awards/recognition info needed
        "N/A_p": 0,    # publications info needed
        "N/A_ss": 0,   # salary/success info needed
        "N/A_pm": 0,   # professional membership info needed
        "total_fields": 0
    }
    
    # Initial progress update
    if supabase and user_id:
        update_fill_progress(0, total_pages, doc_type, user_id, supabase)
    
    for page_num, page in enumerate(template.pages):

        if (page_num + 1 >= NUM_PAGES):
            break

        # Update progress for each page
        if supabase and user_id:
            update_fill_progress(page_num + 1, total_pages, doc_type, user_id, supabase)
            
        annotations = page.get('/Annots')
        if annotations:
            for annotation in annotations:
                if annotation.get('/Subtype') == '/Widget':
                    field_type = annotation.get('/FT')
                    original_name = annotation.get('/T').replace("\\", "/")
                    
                    # Count total fillable fields
                    field_stats["total_fields"] += 1

                    print(original_name)

                    # Check if we have a response for this field
                    if original_name and original_name in response_dict:
                        field_value = response_dict[original_name]
                        
                        # Check for NA field types in the value
                        value_str = str(field_value).lower() if field_value else ""
                        
                        # Classify the field value
                        if "n/a_per" in value_str:
                            field_stats["N/A_per"] += 1
                        elif "n/a_r" in value_str:
                            field_stats["N/A_r"] += 1
                        elif "n/a_rl" in value_str:
                            field_stats["N/A_rl"] += 1
                        elif "n/a_ar" in value_str:
                            field_stats["N/A_ar"] += 1
                        elif "n/a_p" in value_str:
                            field_stats["N/A_p"] += 1
                        elif "n/a_ss" in value_str:
                            field_stats["N/A_ss"] += 1
                        elif "n/a_pm" in value_str:
                            field_stats["N/A_pm"] += 1
                        elif value_str and value_str != "n/a" and value_str != "":
                            # Count as user info filled if it's not empty and not an N/A type
                            field_stats["user_info_filled"] += 1
                        
                        # Handle checkboxes
                        if field_type == '/Btn':
                            # Determine if this is a checkbox or radio button
                            is_checkbox = annotation.get('/Ff') and int(annotation['/Ff']) & 0x10000
                            
                            if is_checkbox:
                                # For checkboxes, check if the value is truthy
                                if field_value in [True, 'True', 'Y', 'y', 1, '1']:
                                    # Find the 'on' state for this checkbox
                                    on_state = PdfName('Yes')
                                    if annotation.get('/AP'):
                                        ap_dict = annotation['/AP']
                                        if isinstance(ap_dict, PdfDict) and ap_dict.get('/N'):
                                            states = ap_dict['/N']
                                            for state in states.keys():
                                                if state != '/Off':
                                                    on_state = PdfName(state)
                                                    break
                                    
                                    # Set the checkbox to its 'on' state
                                    annotation.update(PdfDict(V=on_state, AS=on_state))
                                else:
                                    # Ensure checkbox is off
                                    annotation.update(PdfDict(V=PdfName('Off'), AS=PdfName('Off')))
                            else:
                                # For radio buttons, set the selected option     
                                annotation.V = pdfrw.objects.pdfname.BasePdfName(field_value)
                        
                        # Handle text fields
                        elif field_type == '/Tx':
                            annotation.update(PdfDict(V=str(field_value), AS=str(field_value)))
                        
                        # Handle drop-down fields
                        elif field_type == '/Ch':
                            annotation.update(PdfDict(V=str(field_value), AS=str(field_value)))
                    
                    # Original logic for fields not in response_dict
                    else:
                        # Existing logic for unspecified fields
                        if field_type == '/Btn':
                            if annotation.get('/Ff') and int(annotation['/Ff']) & 0x10000:
                                if annotation.get('/AS') is None:
                                    opts = annotation.get('/Opt')
                                    if opts:
                                        annotation.update(PdfDict(V=opts[0], AS=opts[0]))
                            else:
                                
                                on_state = None
                                if annotation.get('/AP'):
                                    ap_dict = annotation['/AP']
                                    if isinstance(ap_dict, PdfDict) and ap_dict.get('/N'):
                                        states = ap_dict['/N']
                                        for state in states.keys():
                                            if state != '/Off':
                                                on_state = state
                                                break
                                on_state = on_state or PdfName('Yes')
                                annotation.update(PdfDict(V=on_state, AS=on_state))
                        
                        # Handle text fields
                        elif field_type == '/Tx':
                            annotation.update(PdfDict(V="", AS=""))
                        
                        # Handle drop-down fields
                        elif field_type == '/Ch':
                            opts = annotation.get('/Opt')
                            if opts:
                                val = random.choice(opts)[0].replace('(', '').replace(')', '')
                                annotation.update(PdfDict(V=val, AS=val))
    
    # Final progress update - completed
    if supabase and user_id:
        update_fill_progress(total_pages, total_pages, doc_type, user_id, supabase)
    
    # Write field stats to a report file
    base_dir = Path(output_pdf).parent
    stats_file = os.path.join(base_dir, "field_stats.json")
    
    # Calculate percentages
    percent_filled = 0
    if field_stats["total_fields"] > 0:
        percent_filled = (field_stats["user_info_filled"] / field_stats["total_fields"]) * 100
    
    field_stats["percent_filled"] = round(percent_filled, 2)
    
    # Save the field stats report
    try:
        with open(stats_file, 'w', encoding='utf-8') as f:
            json.dump(field_stats, f, indent=2)
        print(f"Field statistics saved to {stats_file}")
        
        # Print summary to console
        print("\n=== O1 FORM FILLING STATISTICS ===")
        print(f"Total fields processed: {field_stats['total_fields']}")
        print(f"Fields filled with user info: {field_stats['user_info_filled']} ({field_stats['percent_filled']}%)")
        print(f"Fields requiring personal info: {field_stats['N/A_per']}")
        print(f"Fields requiring resume info: {field_stats['N/A_r']}")
        print(f"Fields requiring recommendation letters: {field_stats['N/A_rl']}")
        print(f"Fields requiring awards/recognition: {field_stats['N/A_ar']}")
        print(f"Fields requiring publications: {field_stats['N/A_p']}")
        print(f"Fields requiring salary/success info: {field_stats['N/A_ss']}")
        print(f"Fields requiring professional membership: {field_stats['N/A_pm']}")
        print("==================================\n")
        
        # If supabase is provided, store stats there
        if supabase and user_id:
            try:
                supabase.table("user_documents").update({
                    "field_stats": json.dumps(field_stats)
                }).eq("user_id", user_id).execute()
                print("Field statistics stored in database")
            except Exception as e:
                print(f"Error storing field statistics: {str(e)}")
    except Exception as e:
        print(f"Error saving field statistics: {str(e)}")
    
  #  PdfWriter().write(output_pdf, template)
    print(f"Completed filling PDF with {total_pages} pages")
    return total_pages, field_stats

def update_fill_progress(current, total, doc_type, user_id, supabase):
    """Updates the progress status in the database"""
    if supabase:
        progress_status = f"filling_pdf_page_{current}_of_{total}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated progress: {progress_status}")
        except Exception as e:
            logger.error(f"Error updating progress: {str(e)}")

def merge_dicts(dict1, dict2):
    """
    Recursively merge two dictionaries.
    
    Args:
        dict1 (dict): First dictionary
        dict2 (dict): Second dictionary to merge into first
    
    Returns:
        dict: Merged dictionary
    """
    result = dict1.copy()
    for key, value in dict2.items():
        if key in result:
            if isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = merge_dicts(result[key], value)
            else:
                result[key] = value
        else:
            result[key] = value
    return result

def run(extracted_text, doc_type=None, user_id=None, supabase=None):
    """
    Process extracted text and fill PDF forms
    
    Args:
        extracted_text (str): The text extracted from the PDF
        doc_type (str): Type of document being processed
        user_id (str): User ID for tracking
        supabase: Supabase client for database operations
        
    Returns:
        tuple: (total_pages, field_stats) or total_pages for backward compatibility
    """
    logger.info(f"Starting PDF form filling for {doc_type} document (User ID: {user_id})")
    
    # Get the base directory using the script's location
    base_dir = "data/"
    
    # Initial progress update for RAG generation
    if supabase and user_id:
        try:
            supabase.table("user_documents").update({
                "processing_status": "generating_rag_responses"
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated status: generating_rag_responses")
        except Exception as e:
            logger.error(f"Error updating RAG progress: {str(e)}")
    
    # Make sure the RAG responses directory exists
    rag_responses_dir = base_dir + "rag_responses"
    os.makedirs(rag_responses_dir, exist_ok=True)
    
    # Generate RAG responses using the user info
    full_response_dict = write_rag_responses(
        extra_info=f"Extracted Text: {extracted_text}...", 
        pages=list(range(1, NUM_PAGES)),  # Limit to 10 pages for serverless environment
        user_id=user_id,
        supabase=supabase
    )
    print(full_response_dict)
    
    # Update progress for PDF filling preparation
    if supabase and user_id:
        try:
            supabase.table("user_documents").update({
                "processing_status": "preparing_pdf_fill"
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated status: preparing_pdf_fill")
        except Exception as e:
            logger.error(f"Error updating PDF prep progress: {str(e)}")
    
    # In serverless environment, we don't have a physical PDF to fill
    # So we'll create mock field statistics
    total_pages = NUM_PAGES  # Default page count
    
    # Create mock field statistics
    field_stats = {
        "user_info_filled": 25,
        "N/A_per": 5,
        "N/A_r": 3,
        "N/A_rl": 2,
        "N/A_ar": 1,
        "N/A_p": 4,
        "N/A_ss": 2,
        "N/A_pm": 3,
        "total_fields": 45,
        "percent_filled": 55.56,
        # Add the na_ fields needed for the O-1 criteria
        "na_extraordinary": 5,
        "na_recognition": 4,
        "na_publications": 5,
        "na_leadership": 3,
        "na_contributions": 4,
        "na_salary": 4,
        "na_success": 3
    }
    
    total_pages, field_stats = fill_and_check_pdf("data/o1-form-template-cleaned-filled.pdf", "data/o1-form-template-cleaned-filled.pdf", full_response_dict, doc_type, user_id, supabase)
    print(field_stats)
    # Final completion update
    if supabase and user_id:
        try:
            status = f"completed_pdf_fill_{total_pages}_pages"
            supabase.table("user_documents").update({
                "processing_status": status,
                "field_stats": json.dumps(field_stats)
            }).eq("user_id", user_id).execute()
            logger.info(f"Updated status: {status}")
        except Exception as e:
            logger.error(f"Error updating completion status: {str(e)}")
    
    logger.info(f"PDF form filling completed: {total_pages} pages processed")
    return total_pages, field_stats

# ----- END OF INCORPORATED CODE -----

def process_pdf_content(file_content: bytes, doc_type: str, user_id: str = None, supabase: Client = None) -> dict:
    try:
        # Save the PDF content to a temporary file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            tmp_file.write(file_content)
            tmp_path = tmp_file.name

        # Extract text using PyPDF2
        text_content = []
        with open(tmp_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            total_pages = len(pdf_reader.pages)
            
            # Update status to show page processing progress if Supabase is available
            for page_num, page in enumerate(pdf_reader.pages):
                # Update processing status with page progress (only if Supabase is available)
                if supabase and user_id:
                    try:
                        progress_status = f"processing_{doc_type}_page_{page_num+1}_of_{total_pages}"
                        supabase.table("user_documents").update({
                            "processing_status": progress_status
                        }).eq("user_id", user_id).execute()
                    except Exception as e:
                        print(f"Warning: Could not update Supabase status: {str(e)}")
                        # Continue processing even if Supabase update fails
                
                try:
                    text = page.extract_text()
                    # Ensure text is a string and not empty
                    if isinstance(text, str) and text.strip():
                        text_content.append(text)
                    elif isinstance(text, list):
                        # If text is a list, join it with spaces
                        text = ' '.join(str(item) for item in text if item)
                        if text.strip():
                            text_content.append(text)
                except Exception as e:
                    print(f"Error extracting text from page {page_num + 1}: {str(e)}")
                    continue

        # Clean up temporary file
        os.unlink(tmp_path)

        print("RUNNING RAG GENERATION")

        # Join all text content and ensure it's a string
        full_text = "\n".join(text_content) if text_content else ""
        print("Extracted text:", full_text[:10] if full_text else "No text extracted")

        # Update status to show we're running RAG generation (only if Supabase is available)
        if supabase and user_id:
            try:
                supabase.table("user_documents").update({
                    "processing_status": f"processing_{doc_type}_analysis"
                }).eq("user_id", user_id).execute()
            except Exception as e:
                print(f"Warning: Could not update Supabase analysis status: {str(e)}")
        
        # Check if OpenAI is available
        if not openai_available or not client:
            logger.warning("OpenAI not available. Returning basic document analysis.")
            # Return a default summary with structured arrays
            return {
                "summary": f"Document analysis is not available (OpenAI API key missing). Your {doc_type} document has {total_pages} pages and approximately {len(full_text)} characters of content.",
                "pages": total_pages,
                "processed": True,
                "text_preview": full_text[:1000] if full_text else "No text extracted",
                "openai_available": False,
                "strengths": ["OpenAI analysis not available - API key missing"],
                "weaknesses": ["Cannot analyze document without OpenAI access"],
                "recommendations": ["Please ensure OpenAI API key is properly configured"]
            }
        
        try:
            # Generate summary using OpenAI
            response = client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a professional o1 document reviewer. Review the following documents and specifically list the strengths and weaknesses of the applicants resources in creating a successful o1 application. Additionally, provide a list of recommendations for the applicant to improve their application. Format the output as follows: Strengths: [list of strengths], Weaknesses: [list of weaknesses], Recommendations: [list of recommendations]. Make sure to separate each point with a [SEP] separator. Refer to the applicant as 'you'."},
                    {"role": "user", "content": full_text}
                ]
            )

            summary_text = response.choices[0].message.content
            
            # Parse the summary into structured arrays
            strengths, weaknesses, recommendations = parse_summary(summary_text)

            num_pages, field_stats = run(full_text, doc_type, user_id, supabase)

            print(f"Field stats: {field_stats}")
            
            # Return the structured results
            return {
                "summary": summary_text,
                "pages": total_pages,
                "processed": True,
                "text_preview": full_text[:1000] if full_text else "No text extracted",
                "openai_available": True,
                "strengths": strengths,
                "weaknesses": weaknesses,
                "recommendations": recommendations,
                "field_stats" : field_stats,
            }
        except Exception as e:
            logger.error(f"Error generating OpenAI summary: {str(e)}")
            # Provide a basic fallback summary with structured arrays
            return {
                "summary": f"Error generating AI summary: {str(e)}. Your {doc_type} document has {total_pages} pages.",
                "pages": total_pages,
                "processed": True,
                "text_preview": full_text[:1000] if full_text else "No text extracted",
                "error": str(e),
                "openai_available": True,  # It was available but had an error
                "strengths": ["Error generating AI analysis"],
                "weaknesses": [f"Document analysis failed: {str(e)}"],
                "recommendations": ["Try uploading the document again or contact support"]
            }
    except Exception as e:
        logger.error(f"Error processing PDF: {str(e)}")
        return {
            "summary": f"Error processing document: {str(e)}",
            "error": str(e),
            "processed": False,
            "openai_available": openai_available,
            "strengths": ["Error processing document"],
            "weaknesses": [f"Document analysis failed: {str(e)}"],
            "recommendations": ["Try uploading the document again or contact support"]
        }

class handler(BaseHTTPRequestHandler):
    def handle_cors(self):
        """Set CORS headers for all responses"""
        origins = [
            "http://localhost:3000",
            "https://localhost:3000",
            "https://getprometheus.ai",
            "https://*.getprometheus.ai",
            os.getenv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000")
        ]
        
        # Check if the origin is allowed
        origin = self.headers.get('Origin')
        allowed_origin = "*"  # Default to all origins if no match
        
        if origin:
            for allowed in origins:
                if allowed == origin or (allowed.startswith("https://") and "*" in allowed and origin.endswith(allowed.split("*")[1])):
                    allowed_origin = origin
                    break
        
        self.send_header('Access-Control-Allow-Origin', allowed_origin)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Credentials', 'true')
    
    def send_json_response(self, response_data, status_code=200):
        """Helper to send JSON responses"""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.handle_cors()
        self.end_headers()
        self.wfile.write(json.dumps(response_data).encode())
    
    def parse_query_params(self):
        """Parse query parameters from path"""
        if '?' not in self.path:
            return {}
        
        query_string = self.path.split('?', 1)[1]
        return {k: v[0] for k, v in parse_qs(query_string).items()}
        
    def do_OPTIONS(self):
        """Handle OPTIONS requests for CORS preflight"""
        self.send_response(200)
        self.handle_cors()
        self.end_headers()
        
    def do_GET(self):
        """Handle GET requests to validate-documents"""
        logger.info(f"Received GET request to {self.path}")
        
        # Extract path and parameters
        if self.path.startswith('/api/test'):
            self.send_json_response({
                "status": "success",
                "message": "HTTP API is working correctly!",
                "version": "1.0.0"
            })
            return
        
        if not self.path.startswith('/api/validate-documents'):
            self.send_json_response({
                "status": "error",
                "message": "Invalid endpoint"
            }, 404)
            return
        
        # Parse query parameters
        params = self.parse_query_params()
        user_id = params.get('user_id')
        
        if not user_id:
            logger.warning("GET request missing user_id parameter")
            self.send_json_response({
                "status": "error",
                "message": "user_id is required as a query parameter",
                "example": "/api/validate-documents?user_id=your-user-id-here"
            }, 400)
            return
        
        try:
            # Try to get Supabase client
            supabase = get_supabase()
            
            if not supabase:
                logger.warning("Could not connect to Supabase, returning default document state")
                # Return a default document state that allows processing to continue
                self.send_json_response({
                    "status": "success_no_db",
                    "completion_score": 0,
                    "can_proceed": True,  # Allow proceeding without database
                    "documents": {
                        "user_id": user_id,
                        "processing_status": "pending",
                        "completion_score": 0,
                        "resume": False,
                        "recommendations": False,
                        "awards": False,
                        "publications": False,
                        "salary": False,
                        "memberships": False
                    }
                })
                return

            # Try to get existing document
            logger.info(f"Fetching documents for user: {user_id}")
            response = supabase.table("user_documents").select("*").eq("user_id", user_id).execute()
            
            # If no document exists, create one
            if not response.data:
                logger.info(f"Creating new document record for user: {user_id}")
                try:
                    insert_response = supabase.table("user_documents").insert({
                        "user_id": user_id,
                        "processing_status": "pending",
                        "completion_score": 0,
                        "resume": False,
                        "recommendations": False,
                        "awards": False,
                        "publications": False,
                        "salary": False,
                        "memberships": False
                    }).execute()
                    
                    self.send_json_response({
                        "status": "initialized",
                        "completion_score": 0,
                        "can_proceed": True,  # Allow proceeding even with a new record
                        "message": "Document record created"
                    })
                except Exception as insert_error:
                    logger.error(f"Error creating document record: {str(insert_error)}")
                    # Return a default state that allows processing to continue
                    self.send_json_response({
                        "status": "error_creating_record",
                        "completion_score": 0,
                        "can_proceed": True,  # Allow proceeding despite error
                        "message": f"Error creating document record: {str(insert_error)}"
                    })
                return
                
            user_docs = response.data[0]
            logger.info(f"Successfully retrieved documents for user: {user_id}")
            self.send_json_response({
                "status": "success",
                "completion_score": user_docs.get("completion_score", 0),
                "can_proceed": True,  # Always allow proceeding
                "documents": user_docs
            })
            
        except Exception as e:
            logger.error(f"Error processing GET request: {str(e)}")
            # Return a default document state that allows processing to continue
            self.send_json_response({
                "status": "error_fallback",
                "message": f"Error checking validation status: {str(e)}",
                "completion_score": 0,
                "can_proceed": True,  # Allow proceeding despite error
                "documents": {
                    "user_id": user_id,
                    "processing_status": "error",
                    "completion_score": 0
                }
            })
        
    def do_POST(self):
        """Handle POST requests to validate-documents"""
        logger.info(f"Received POST request to {self.path}")
        
        if not self.path.startswith('/api/validate-documents'):
            self.send_json_response({
                "status": "error",
                "message": "Invalid endpoint"
            }, 404)
            return
        
        # Read request data
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            self.send_json_response({
                "status": "error",
                "message": "No data provided"
            }, 400)
            return
            
        post_data = self.rfile.read(content_length)
        try:
            request_data = json.loads(post_data)
        except json.JSONDecodeError:
            self.send_json_response({
                "status": "error",
                "message": "Invalid JSON data"
            }, 400)
            return
        
        logger.info("Processing POST request with data")
        
        try:
            user_id = request_data.get("user_id")
            uploaded_documents = request_data.get("uploaded_documents", {})
            # Allow direct document data in the request
            document_data = request_data.get("document_data", {})
            
            if not user_id or (not uploaded_documents and not document_data):
                logger.warning("POST request missing required fields")
                self.send_json_response({
                    "status": "error",
                    "message": "Missing required fields: user_id and either uploaded_documents or document_data"
                }, 400)
                return

            logger.info(f"Processing documents for user: {user_id}")
            
            # Try to get Supabase client, but continue even if it fails
            supabase = None
            try:
                supabase = get_supabase()
                if supabase:
                    logger.info("Supabase connection established")
                    # Check for existing documents
                    response = supabase.table("user_documents").select("processing_status, last_validated").eq("user_id", user_id).single().execute()
                    
                    # Update status to pending
                    supabase.table("user_documents").update({
                        "processing_status": "pending",
                        "last_validated": "now()"
                    }).eq("user_id", user_id).execute()
                else:
                    logger.warning("Supabase connection not available, continuing without database updates")
                    response = None
            except Exception as e:
                logger.warning(f"Supabase connection failed: {str(e)}, continuing without database updates")
                response = None
                
            document_summaries = {}
            
            # Process uploaded documents
            if uploaded_documents:
                logger.info(f"Uploaded documents: {list(uploaded_documents.keys())}")
                
                for doc_type in uploaded_documents:
                    if uploaded_documents[doc_type]:
                        try:
                            # Update processing status if Supabase is available
                            if supabase:
                                try:
                                    supabase.table("user_documents").update({
                                        "processing_status": f"processing_{doc_type}"
                                    }).eq("user_id", user_id).execute()
                                except Exception as e:
                                    logger.error(f"Error updating status for {doc_type}: {str(e)}")
                            
                            # Try to get the file from Supabase storage
                            file_response = None
                            if supabase:
                                try:
                                    file_response = supabase.storage.from_('documents').download(
                                        f"{user_id}/{doc_type}.pdf"
                                    )
                                    logger.info(f"Downloaded file for {doc_type} from Supabase storage")
                                except Exception as e:
                                    logger.error(f"Error downloading file from Supabase: {str(e)}")
                            
                            # If we have the file content, process it
                            if file_response:
                                summary = process_pdf_content(file_response, doc_type, user_id, supabase)
                                document_summaries[doc_type] = summary
                            else:
                                logger.error(f"No file content available for {doc_type}")
                                document_summaries[doc_type] = {
                                    "error": "File content not available",
                                    "processed": False
                                }
                                
                        except Exception as e:
                            logger.error(f"Error processing {doc_type}: {str(e)}")
                            document_summaries[doc_type] = {
                                "error": str(e),
                                "processed": False
                            }
                            # Update status to error if Supabase is available
                            if supabase:
                                try:
                                    supabase.table("user_documents").update({
                                        "processing_status": f"error_{doc_type}"
                                    }).eq("user_id", user_id).execute()
                                except Exception as update_error:
                                    logger.error(f"Error updating error status for {doc_type}: {str(update_error)}")
            
            # Process document data directly provided in the request
            if document_data:
                logger.info(f"Direct document data: {list(document_data.keys())}")
                
                for doc_type, data in document_data.items():
                    try:
                        if not data or not data.get("content"):
                            logger.error(f"Missing content for {doc_type}")
                            document_summaries[doc_type] = {
                                "error": "Missing document content",
                                "processed": False
                            }
                            continue
                            
                        # Decode base64 content if provided
                        content = data.get("content")
                        if data.get("encoding") == "base64":
                            try:
                                content = base64.b64decode(content)
                            except Exception as e:
                                logger.error(f"Error decoding base64 content for {doc_type}: {str(e)}")
                                document_summaries[doc_type] = {
                                    "error": f"Invalid base64 content: {str(e)}",
                                    "processed": False
                                }
                                continue
                        
                        # Process the document content
                        summary = process_pdf_content(content, doc_type, user_id, supabase)
                        document_summaries[doc_type] = summary
                    
                    except Exception as e:
                        logger.error(f"Error processing {doc_type} from direct data: {str(e)}")
                        document_summaries[doc_type] = {
                            "error": str(e),
                            "processed": False
                        }

            # Update Supabase if available
            if supabase:
                try:
                    # Create update data
                    update_data = {
                        "processing_status": "completed",
                        "document_summaries": document_summaries
                    }
                    
                    if not response or not response.data:
                        # Create new record
                        insert_data = {
                            "user_id": user_id,
                            "processing_status": "completed",
                            "completion_score": 0,
                            **(uploaded_documents or {}),
                            "document_summaries": document_summaries
                        }
                        
                        insert_response = supabase.table("user_documents").insert(insert_data).execute()
                        user_docs = insert_response.data[0] if insert_response.data else {}
                    else:
                        user_docs = response.data
                        # Update existing record
                        supabase.table("user_documents").update(update_data).eq("user_id", user_id).execute()

                    # Calculate completion score
                    optional_docs = ["recommendations", "awards", "publications", "salary", "memberships"]
                    uploaded_optional = sum(1 for doc in optional_docs if user_docs.get(doc))
                    completion_score = (uploaded_optional / len(optional_docs)) * 100
                    
                    # Final update with completion score
                    supabase.table("user_documents").update({
                        "completion_score": completion_score,
                        "last_validated": "now()"
                    }).eq("user_id", user_id).execute()
                    
                    self.send_json_response({
                        "status": "success",
                        "completion_score": completion_score,
                        "message": f"Documents validated successfully. Your profile is {completion_score}% complete.",
                        "can_proceed": True,
                        "document_summaries": document_summaries,
                        "field_stats": document_summaries.get("resume", {}).get("field_stats", {})
                    })
                except Exception as e:
                    logger.error(f"Error updating database: {str(e)}")
                    # Return the processed summaries even if database update fails
                    self.send_json_response({
                        "status": "partial",
                        "message": f"Documents processed but database update failed: {str(e)}",
                        "can_proceed": True,
                        "document_summaries": document_summaries
                    })
            else:
                # Supabase not available, just return the summaries
                self.send_json_response({
                    "status": "success_no_db",
                    "message": "Documents processed successfully (database not updated)",
                    "can_proceed": True,
                    "document_summaries": document_summaries
                })
            
        except Exception as e:
            logger.error(f"Error processing documents: {str(e)}")
            # Update status to error if we have a user_id and Supabase
            if 'user_id' in locals():
                try:
                    supabase = get_supabase()
                    if supabase:
                        supabase.table("user_documents").update({
                            "processing_status": "error"
                        }).eq("user_id", user_id).execute()
                except Exception as update_error:
                    logger.error(f"Error updating status to error: {str(update_error)}")
            
            self.send_json_response({
                "status": "error",
                "message": f"Error processing documents: {str(e)}"
            }, 500)