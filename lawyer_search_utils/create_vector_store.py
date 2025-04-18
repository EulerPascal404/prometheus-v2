from openai import OpenAI
import os
import json
from glob import glob

def create_json_file(data, filename):
  """
  Creates a JSON file from a Python dictionary.

  Args:
      data (dict): The dictionary to be written to the JSON file.
      filename (str): The name of the JSON file to be created.
  """
  try:
    with open(filename, 'w') as file:
      json.dump(data, file, indent=4)
    print(f"JSON file '{filename}' created successfully.")
  except Exception as e:
    print(f"An error occurred: {e}")

VECTOR_STORE_ID = "vs_680295db3acc8191b3018c1fda9f5f58"

openai_api_key = os.environ.get("OPENAI_API_KEY")

client = OpenAI(api_key=openai_api_key)

if not VECTOR_STORE_ID:

    vector_store = client.vector_stores.create(
        name="Lawyer Database"
    )
    print(vector_store)

else:
    print(f"Vector store {VECTOR_STORE_ID} already exists. Using existing vector store.")

    vector_store = client.vector_stores.retrieve(
        vector_store_id=VECTOR_STORE_ID
    )

    for pth in glob("lawyer_search_utils/json_data/*.json"):
       f_obj = client.files.create(
        file=open(pth, "rb"),
        purpose="user_data"
        )
       print(f_obj)
       vector_store_file = client.vector_stores.files.create(
        vector_store_id=VECTOR_STORE_ID,
        file_id=f_obj.id
        )
    print(vector_store_file)

    
        