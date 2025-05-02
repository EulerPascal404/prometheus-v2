import os
import random
import re
import ast
from pdfrw import PdfReader, PdfWriter, PdfDict, PdfName
from o1_rag_generation import write_rag_responses
import json
import pdfrw
from pathlib import Path

def clean_field_name(field_name):
    """Cleans noisy characters from field names."""
    if field_name:
        return re.sub(r'\\\d+', '', field_name).strip('()')
    return field_name

# Progress callback function
def update_fill_progress(current, total, doc_type, user_id, supabase):
    """Updates the progress status in the database"""
    if supabase:
        progress_status = f"filling_pdf_page_{current}_of_{total}"
        try:
            supabase.table("user_documents").update({
                "processing_status": progress_status
            }).eq("user_id", user_id).execute()
            print(f"Updated progress: {progress_status}")
        except Exception as e:
            print(f"Error updating progress: {str(e)}")

def fill_and_check_pdf(input_pdf, output_pdf, response_dict=None, doc_type=None, user_id=None, supabase=None):
    if response_dict is None:
        response_dict = {}
    
    template = PdfReader(input_pdf)
    total_pages = len(template.pages)
    
    # Check if we're using the trimmed PDF (which contains only O-1 pages)
    is_trimmed_pdf = "o1only" in input_pdf or total_pages <= 10
    
    print(f"Started filling PDF with {total_pages} pages" + (" (trimmed O-1 PDF)" if is_trimmed_pdf else ""))
    
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
    
    # For O-1, we expect exactly 10 relevant pages
    o1_total_pages = 10
    
    # Initial progress update - use the O-1 page count
    if supabase and user_id:
        update_fill_progress(0, o1_total_pages, doc_type, user_id, supabase)
    
    # Track processed page count for progress reporting
    processed_page_count = 0
    
    for page_num, page in enumerate(template.pages):
        # If using the full PDF, we would skip pages not in O1_RELEVANT_PAGES_0INDEXED
        # But since we're using the trimmed PDF, all pages are relevant
        
        # Safety check - don't process more than the expected O-1 pages
        if processed_page_count >= o1_total_pages:
            break
        
        # Increment processed page counter for progress reporting
        processed_page_count += 1
        
        # Update progress for each relevant page - report sequential numbers
        if supabase and user_id:
            update_fill_progress(processed_page_count, o1_total_pages, doc_type, user_id, supabase)
            
        annotations = page.get('/Annots')
        if annotations:
            for annotation in annotations:
                if annotation.get('/Subtype') == '/Widget':
                    field_type = annotation.get('/FT')
                    original_name = annotation.get('/T')
                    
                    # Count total fillable fields
                    field_stats["total_fields"] += 1

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
    
    # Final progress update - completed with the correct total
    if supabase and user_id:
        update_fill_progress(o1_total_pages, o1_total_pages, doc_type, user_id, supabase)
    
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
    
    PdfWriter().write(output_pdf, template)
    print(f"Completed filling PDF with {total_pages} pages")
    return total_pages, field_stats

import json
import re
from collections.abc import Mapping

def unescape_json_key(key):
    """
    Unescape and normalize JSON keys with special escape sequences.
    
    Args:
        key (str): Original JSON key potentially containing escape sequences
    
    Returns:
        str: Normalized, unescaped key
    """
    # Remove surrounding parentheses if present
    key = key.strip('()')
    
    # Replace specific escaped sequences
    key = key.replace('\\137', '_')  # Replace specific escape sequences
    key = key.replace('\\1330', '')
    key = key.replace('\\1331', '')
    key = key.replace('\\1332', '')
    key = key.replace('\\1333', '')
    
    # Unescape common JSON escape sequences
    key = key.encode('utf-8').decode('unicode_escape')
    
    return key

def unescape_json_value(value):
    """
    Unescape and normalize JSON values with special escape sequences.
    
    Args:
        value (str): Original JSON value potentially containing escape sequences
    
    Returns:
        str: Normalized, unescaped value
    """
    # Unescape common JSON escape sequences
    value = value.encode('utf-8').decode('unicode_escape')
    
    # Remove newline and control characters
    value = re.sub(r'[\n\r\x00-\x1F\x7F]', '', value)
    
    return value

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

def merge_json_from_file(file_path, handle_duplicates='overwrite'):
    """
    Merges multiple JSON objects from a file into a single dictionary.
    
    Args:
        file_path (str): Path to the file containing JSON data
        handle_duplicates (str): How to handle duplicate keys
            'overwrite' - later values overwrite earlier ones (default)
            'keep' - keep the first encountered value
            'merge' - attempt to merge nested dictionaries
            'error' - raise ValueError on duplicate keys
    
    Returns:
        dict: Merged dictionary containing all JSON data
    
    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: On invalid duplicate handling or unmergeable data
    """
    if handle_duplicates not in ['overwrite', 'keep', 'merge', 'error']:
        raise ValueError("Invalid handle_duplicates value. Must be 'overwrite', 'keep', 'merge', or 'error'")

    merged_data = {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
            
            # More robust JSON object extraction
            json_objects = []
            stack = []
            start_index = -1
            
            for i, char in enumerate(content):
                if char == '{':
                    if not stack:
                        start_index = i
                    stack.append(char)
                elif char == '}':
                    if stack:
                        stack.pop()
                        if not stack and start_index != -1:
                            json_objects.append(content[start_index:i+1])
                            start_index = -1
            
            for json_obj in json_objects:
                try:
                    # Clean up JSON string
                    cleaned_json = re.sub(r'//.*?$', '', json_obj, flags=re.MULTILINE)  # Remove comments
                    cleaned_json = re.sub(r'/\*.*?\*/', '', cleaned_json, flags=re.DOTALL)  # Remove block comments
                    cleaned_json = cleaned_json.strip()
                    
                    if not cleaned_json:  # Skip empty objects
                        continue
                    
                    # More flexible JSON parsing
                    try:
                        data = json.loads(cleaned_json)
                    except json.JSONDecodeError:
                        # Try parsing with unescaped keys
                        try:
                            # Custom parsing for problematic JSON
                            cleaned_data = {}
                            json_dict = eval(cleaned_json.replace('\\', '\\\\'))
                            for orig_key, value in json_dict.items():
                                # Normalize keys and values
                                normalized_key = unescape_json_key(orig_key)
                                normalized_value = unescape_json_value(str(value))
                                cleaned_data[normalized_key] = normalized_value
                            data = cleaned_data
                        except Exception as e:
                            print(f"Error parsing JSON (skipping): {e}\nProblematic JSON: {json_obj[:200]}...\n")
                            continue
                    
                    # Handle merging with different strategies
                    for key, value in data.items():
                        key = key.replace("/", "\\")

                        if (key[0] != "(" and key[0] != ")"):
                            key = "(" + key + ")"

                        if key in merged_data:
                            if handle_duplicates == 'error':
                                raise ValueError(f"Duplicate key found: {key}")
                            elif handle_duplicates == 'keep':
                                continue
                            elif handle_duplicates == 'merge' and isinstance(value, Mapping) and isinstance(merged_data[key], Mapping):
                                # Recursively merge dictionaries
                                merged_data[key] = merge_dicts(merged_data[key], value)
                                continue
                        
                        # Default behavior (overwrite)
                        merged_data[key] = value
                        
                except Exception as e:
                    print(f"Unexpected error processing JSON (skipping): {e}\nProblematic JSON: {json_obj[:200]}...\n")
                    continue
    
    except FileNotFoundError:
        raise FileNotFoundError(f"File not found: {file_path}")
    
    return merged_data

### CHANGE ###
def extract_page_28(input_pdf_path, output_pdf_path):
    """
    Extracts only page 28 from the input PDF and saves to output_pdf_path.
    
    Args:
        input_pdf_path (str): Path to the input PDF file
        output_pdf_path (str): Path where the extracted page will be saved
        
    Returns:
        bool: True if extraction was successful, False otherwise
    """
    try:
        print(f"[DEBUG] Extracting page 28 from: {input_pdf_path}")
        print(f"[DEBUG] Output path for page 28: {output_pdf_path}")
        
        # Check if input file exists
        if not os.path.exists(input_pdf_path):
            print(f"[DEBUG] Error: Input PDF file does not exist at {input_pdf_path}")
            return False
            
        reader = PdfReader(input_pdf_path)
        
        # Log PDF info
        print(f"[DEBUG] PDF has {len(reader.pages)} pages total")
        
        # Check if the PDF has enough pages
        if len(reader.pages) < 28:
            print(f"[DEBUG] Error: PDF has only {len(reader.pages)} pages, cannot extract page 28")
            return False
        
        # Page 28 has index 27 (0-indexed)
        page_28 = reader.pages[27]
        
        # Ensure directory exists
        output_dir = os.path.dirname(output_pdf_path)
        os.makedirs(output_dir, exist_ok=True)
        print(f"[DEBUG] Created/verified directory: {output_dir}")
        
        # Create the single-page PDF
        writer = PdfWriter()
        writer.addpage(page_28)
        writer.write(output_pdf_path)
        
        # Verify file was created and is accessible
        if os.path.exists(output_pdf_path):
            file_size = os.path.getsize(output_pdf_path)
            print(f"[DEBUG] Successfully extracted page 28 to: {output_pdf_path}")
            print(f"[DEBUG] File size: {file_size} bytes")
            
            # Try to verify the PDF is valid by opening it again
            try:
                verification_reader = PdfReader(output_pdf_path)
                print(f"[DEBUG] PDF verification successful - extracted PDF has {len(verification_reader.pages)} pages")
                return True
            except Exception as ve:
                print(f"[DEBUG] PDF verification failed: {str(ve)}")
                return False
        else:
            print(f"[DEBUG] Error: File was not created at {output_pdf_path}")
            return False
    except Exception as e:
        print(f"[DEBUG] Error extracting page 28: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

### CHANGE ###
def extract_o1_relevant_pages(input_pdf_path, output_pdf_path):
    """
    Extracts only the O-1 relevant pages (1-7 and 28-30) from the input PDF and saves to output_pdf_path.
    Pages are 1-indexed for user, 0-indexed for pdfrw.
    """
    reader = PdfReader(input_pdf_path)

    # Define page indices - standardized constants
    # 1-indexed for human reference (pages 1-7 and 28-30 of the form as labeled)
    O1_RELEVANT_PAGES_1INDEXED = list(range(1, 8)) + list(range(28, 31))
    # 0-indexed for programmatic use with pdfrw (e.g., array indices)
    O1_RELEVANT_PAGES_0INDEXED = list(range(0, 7)) + list(range(27, 30))
    
    # Use 0-indexed version for pdfrw
    selected_pages = [reader.pages[i] for i in O1_RELEVANT_PAGES_0INDEXED if i < len(reader.pages)]
    writer = PdfWriter()
    writer.addpages(selected_pages)
    writer.write(output_pdf_path)
    print(f"Trimmed O-1 PDF created at {output_pdf_path} with {len(selected_pages)} pages.")

### CHANGE ###
def run(user_info, doc_type=None, user_id=None, supabase=None):
    print("RUNNING RAG GENERATION")
    # Get the base directory (demo folder) using the script's location
    base_dir = Path(__file__).parent.parent
    
    # Path to the full and trimmed template PDFs
    full_template_pdf_path = str(base_dir / "o1-form-template-cleaned.pdf")
    trimmed_template_pdf_path = str(base_dir / "o1-form-template-cleaned-o1only.pdf")
    
    # Create timestamp for unique filenames to prevent caching issues
    timestamp = int(time.time())
    
    # Create public directory for web-accessible files if it doesn't exist
    public_dir = base_dir / "public"
    os.makedirs(public_dir, exist_ok=True)
    
    # New paths with timestamps for the generated PDFs
    filled_pdf_filename = f"o1-form-filled-{timestamp}.pdf"
    page_28_pdf_filename = f"o1-form-page28-{timestamp}.pdf"
    
    # Full paths for file system operations
    filled_pdf_path = str(public_dir / filled_pdf_filename)
    page_28_pdf_path = str(public_dir / page_28_pdf_filename)
    
    # Relative URL paths for browser access
    filled_pdf_url = f"/{filled_pdf_filename}"
    page_28_pdf_url = f"/{page_28_pdf_filename}"
    
    print(f"[DEBUG] Filled PDF path (filesystem): {filled_pdf_path}")
    print(f"[DEBUG] Filled PDF URL (browser): {filled_pdf_url}")
    print(f"[DEBUG] Page 28 PDF path (filesystem): {page_28_pdf_path}")
    print(f"[DEBUG] Page 28 PDF URL (browser): {page_28_pdf_url}")

    # Ensure the trimmed PDF exists (create if not)
    if not os.path.exists(trimmed_template_pdf_path):
        print("[DEBUG] Trimmed PDF doesn't exist, creating it now")
        extract_o1_relevant_pages(full_template_pdf_path, trimmed_template_pdf_path)
    else:
        print(f"[DEBUG] Trimmed PDF already exists at: {trimmed_template_pdf_path}")

    # Initial progress update for RAG generation
    if supabase and user_id:
        try:
            supabase.table("user_documents").update({
                "processing_status": "generating_rag_responses"
            }).eq("user_id", user_id).execute()
            print(f"[DEBUG] Updated status: generating_rag_responses")
        except Exception as e:
            print(f"[DEBUG] Error updating RAG progress: {str(e)}")
    
    # Make sure the RAG responses directory exists before writing history file
    rag_responses_dir = base_dir / "rag_responses"
    os.makedirs(rag_responses_dir, exist_ok=True)
    
    # Create history.txt if it doesn't exist, or clear it if starting fresh
    history_file = rag_responses_dir / "history.txt"
    if not history_file.exists():
        with open(history_file, "w", encoding="utf-8") as f:
            f.write("")  # Create empty file
    
    # Define page indices - standardized constants
    # 1-indexed for human reference (pages 1-7 and 28-30 of the form as labeled)
    O1_RELEVANT_PAGES_1INDEXED = list(range(1, 8)) + list(range(28, 31))
    
    # Pass user_id and supabase to the RAG generation
    print("[DEBUG] Starting RAG response generation")
    write_rag_responses(
        extra_info=f"User Info: {user_info}", 
        pages=O1_RELEVANT_PAGES_1INDEXED,  # Use 1-indexed pages for consistency
        user_id=user_id,
        supabase=supabase
    )
    
    # Use absolute paths by joining with base_dir
    response_dict_path = str(base_dir / "rag_responses/history.txt")
    
    # Fix the filled PDF path to be in the public directory
    ### CHANGE ###
    filled_pdf_path = str(base_dir / "public/o1-form-template-cleaned-filled.pdf")
    template_pdf_path = trimmed_template_pdf_path  # Use the trimmed version for O-1

    # Create directories if they don't exist
    os.makedirs(os.path.dirname(filled_pdf_path), exist_ok=True)

    # Update progress for PDF filling preparation
    if supabase and user_id:
        try:
            supabase.table("user_documents").update({
                "processing_status": "preparing_pdf_fill"
            }).eq("user_id", user_id).execute()
            print(f"[DEBUG] Updated status: preparing_pdf_fill")
        except Exception as e:
            print(f"[DEBUG] Error updating PDF prep progress: {str(e)}")

    response_dict = merge_json_from_file(response_dict_path, handle_duplicates="keep")
    
    # Add debug output for clarity
    print(f"[DEBUG] Starting PDF filling with {len(response_dict)} fields to {filled_pdf_path}")
    
    total_pages, field_stats = fill_and_check_pdf(
        template_pdf_path, 
        filled_pdf_path, 
        response_dict, 
        doc_type=doc_type, 
        user_id=user_id, 
        supabase=supabase
    )

    print(f"[DEBUG] PDF filling complete. Stats: {field_stats}")
    
    # Extract just page 28 after the full PDF is generated
    print("[DEBUG] Extracting page 28 for preview")
    page_28_extracted = extract_page_28(filled_pdf_path, page_28_pdf_path)
    
    if page_28_extracted:
        print(f"[DEBUG] Page 28 extraction successful")
        # Double check that the file exists and is readable
        if os.path.exists(page_28_pdf_path):
            print(f"[DEBUG] Page 28 PDF file exists at {page_28_pdf_path}")
            print(f"[DEBUG] File size: {os.path.getsize(page_28_pdf_path)} bytes")
            
            # Check file permissions to ensure it's readable by the web server
            try:
                file_permissions = oct(os.stat(page_28_pdf_path).st_mode & 0o777)
                print(f"[DEBUG] File permissions: {file_permissions}")
            except Exception as e:
                print(f"[DEBUG] Error checking file permissions: {str(e)}")
        else:
            print(f"[DEBUG] Warning: Page 28 PDF file does not exist at {page_28_pdf_path}")
            page_28_extracted = False
    else:
        print("[DEBUG] Page 28 extraction failed")
    
    # Final completion update
    if supabase and user_id:
        try:
            status = f"completed_pdf_fill_{total_pages}_pages"
            preview_message = "You can view page 28 now. The complete PDF will be available after matching with a visa expert."
            
            update_data = {
                "processing_status": status,
                "field_stats": json.dumps(field_stats),
                "page_28_preview_path": page_28_pdf_url if page_28_extracted else None,
                "preview_message": preview_message
            }
            
            supabase.table("user_documents").update(update_data).eq("user_id", user_id).execute()
            print(f"[DEBUG] Updated status: {status} with preview message")
            print(f"[DEBUG] Preview message: {preview_message}")
            print(f"[DEBUG] Preview path URL: {page_28_pdf_url if page_28_extracted else None}")
        except Exception as e:
            print(f"[DEBUG] Error updating completion status: {str(e)}")
    
    # Return additional info about page 28 preview
    result = {
        "total_pages": total_pages,
        "field_stats": field_stats,
        "page_28_preview_path": page_28_pdf_url if page_28_extracted else None,
        "preview_message": "You can view page 28 now. The complete PDF will be available after matching with a visa expert."
    }
    
    print(f"[DEBUG] Returning result with page 28 preview info: {result}")
    return result