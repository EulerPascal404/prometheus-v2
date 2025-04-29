from openai import OpenAI
from glob import glob
from tqdm import trange, tqdm
from pathlib import Path
import os
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

CREATED_VECTOR_STORE = True
# Global variable to control number of pages filled - set to 10 for now
NUM_PAGES = 10

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

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

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
    base_dir = Path(__file__).parent.parent
    print(f"Base directory: {base_dir}")
    print(f"Base directory exists: {os.path.exists(base_dir)}")
    
    # Use absolute paths for all file operations
    extracted_text_dir = base_dir / "extracted_text"
    print(f"Extracted text directory: {extracted_text_dir}")
    print(f"Extracted text directory exists: {os.path.exists(extracted_text_dir)}")
    
    # Create directories if they don't exist
    os.makedirs(extracted_text_dir, exist_ok=True)
    os.makedirs(base_dir / "rag_responses", exist_ok=True)
    
    files = glob(str(extracted_text_dir / "*.txt"))
    print(f"Found {len(files)} text files in {extracted_text_dir}")
    for file in files:
        print(f"  - {file}")
    
    # Clear history file before starting
    history_file = str(base_dir / "rag_responses/history.txt")
    os.makedirs(os.path.dirname(history_file), exist_ok=True)
    # Clear history file before we start
    with open(history_file, 'w', encoding='utf-8') as f:
        f.write("")
    
    # Process each page with progress updates
    for idx, page_num in enumerate(pages):
        # Update progress before processing each page
        if supabase and user_id:
            log_page_progress(idx + 1, total_pages, user_id, supabase)
        
        form_data_file = str(base_dir / f"extracted_form_data/page_{page_num}.txt")
        page_filled_file = str(base_dir / f"rag_responses/page_{page_num}_filled.txt")
        print(f"Looking for form data file: {form_data_file}")
        print(f"Form data file exists: {os.path.exists(form_data_file)}")
        
        try:
            # Read form data - handle missing files gracefully
            form_data = ""
            if os.path.exists(form_data_file):
                form_data = read_text_file(form_data_file)
                print(f"Successfully read form data file: {form_data_file}")
            else:
                print(f"Warning: Form data file not found: {form_data_file}")
                # Try alternative path
                alt_form_data_file = str(Path.cwd() / f"extracted_form_data/page_{page_num}.txt")
                print(f"Trying alternative path: {alt_form_data_file}")
                if os.path.exists(alt_form_data_file):
                    form_data = read_text_file(alt_form_data_file)
                    print(f"Successfully read form data from alternative path: {alt_form_data_file}")
                else:
                    print(f"Alternative path also not found: {alt_form_data_file}")
                    continue
            
            # Get the extracted text for this page
            page_text = ""
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
                    continue
            
            text_prompt = form_data + page_text

            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You have been given a text file containing a form and a dictionary containing keys and possible options. You have also been given information about a user. Output the same dictionary but filled with the responses for an application for the user. It is very important that in the outputed dictionary, the keys are EXACTLY the same as the original keys. For select either yes or no, make sure to only check one of the boxes. Make sure written responses are clear, and detailed making a strong argument. For fields without enough information, fill N/A and specify the type: N/A_per = needs personal info, N/A_r = resume info needed, N/A_rl = recommendation letter info needed, N/A_p = publication info needed, N/A_ss = salary/success info needed, N/A_pm = professional membership info needed. Only fill out fields that can be entirely filled out with the user info provided, do not infer anything. Only output the dictionary. Don't include the word python or ```" + extra_info},
                    {"role": "user", "content": text_prompt}
                ]
            )

            # Check if the response output exists and has the expected structure
            print(f"Processing page {page_num}: Response received")
            if response and hasattr(response, 'choices') and len(response.choices) > 0:
                response_text = response.choices[0].message.content
                
                # Save to individual page file
                write_to_file(page_filled_file, response_text)
                
                # Append to history file
                append_to_file(history_file, response_text)
                
                print(f"Response for page {page_num} has been saved and appended to history")
            else:
                print(f"No valid response found for page {page_num}")
                continue

        except Exception as e:
            print(f"Error processing page {page_num}: {e}")
            continue

        # Add progress update after each page is processed
        if supabase and user_id and (idx % 3 == 0 or idx == len(pages) - 1):  # Update every 3 pages or on the last page
            log_page_progress(idx + 1, total_pages, user_id, supabase)
            
    print(f"Completed processing {total_pages} pages")