import os
import re

# Path to the extracted form data folder
form_data_dir = os.path.join("data", "extracted_form_data")

# Get a list of all text files in the directory
file_list = [f for f in os.listdir(form_data_dir) if f.endswith(".txt")]

# Pattern to match "Page: X" and dashed lines
page_pattern = re.compile(r"^Page: \d+$")
dash_pattern = re.compile(r"^-+$")

# Process each file
for filename in file_list:
    file_path = os.path.join(form_data_dir, filename)
    
    # Read the current content
    with open(file_path, 'r', encoding='utf-8') as file:
        lines = file.readlines()
    
    # Filter out the unwanted lines
    filtered_lines = []
    for line in lines:
        line = line.strip()
        if not page_pattern.match(line) and not dash_pattern.match(line):
            filtered_lines.append(line + '\n')
    
    # Write the cleaned content back to the file
    with open(file_path, 'w', encoding='utf-8') as file:
        file.writelines(filtered_lines)
    
    print(f"Processed {filename}")

print(f"Successfully cleaned {len(file_list)} files.") 