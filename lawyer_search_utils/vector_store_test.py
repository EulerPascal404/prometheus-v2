from openai import OpenAI
import os
import json
from glob import glob

VECTOR_STORE_ID = "vs_680295db3acc8191b3018c1fda9f5f58"

openai_api_key = os.environ.get("OPENAI_API_KEY")

client = OpenAI(api_key=openai_api_key)

results = client.vector_stores.search(
    vector_store_id=VECTOR_STORE_ID,
    query="I need a lawyer with experience in immigration law",
    max_num_results=1,
)

print(results.data[0].score)