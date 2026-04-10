import requests
import json
from typing import List, Dict

class AIClassifier:
    def __init__(self, ollama_url: str, model: str, categories: List[str]):
        self.ollama_url = ollama_url
        self.model = model
        self.categories = categories
        
    def classify(self, filename: str, content_snippet: str = None) -> str:
        """
        Queries the local Ollama model to classify the file into one of the categories.
        Expects the model to return a JSON object with a 'category' key.
        """
        categories_str = ", ".join([f"'{c}'" for c in self.categories])
        
        prompt = f"""
You are an AI file organizer. Categorize the file exactly into one of the following categories: {categories_str}.
If you are unsure, categorize it as 'Misc'.
Return ONLY a valid JSON object with a single key 'category' and string value. No other text.

Filename: {filename}
"""
        if content_snippet:
            # Provide at most 1000 characters of content to keep it fast
            prompt += f"\nFile Content Snippet: {content_snippet[:1000]}\n"

        payload = {
             "model": self.model,
             "prompt": prompt,
             "stream": False,
             "format": "json", # Ollama supports enforcing JSON output if supported by model
             "keep_alive": 0   # <--- OPTIMIZATION: Unloads model from RAM immediately after answering
        }
        
        try:
            response = requests.post(self.ollama_url, json=payload, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            response_text = data.get("response", "{}")
            
            parsed_response = json.loads(response_text)
            category = parsed_response.get("category", "Misc")
            
            if category not in self.categories:
                return "Misc"
            return category
            
        except Exception as e:
            print(f"Error classifying file {filename} with Ollama: {e}")
            return "Misc" # Fallback
