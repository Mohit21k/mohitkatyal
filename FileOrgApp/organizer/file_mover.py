import os
import shutil
import time
import gc
from pathlib import Path
from utils.helpers import get_file_hash, extract_text
from utils.notifications import notify_mac
from classifier.ai_classifier import AIClassifier
from db.history import HistoryDB

class FileMover:
    def __init__(self, config: dict, db: HistoryDB, classifier: AIClassifier):
        self.config = config
        self.db = db
        self.classifier = classifier
        self.categories_map = config.get("categories", {})
        
        # Ensure category directories exist
        for cat_name, path_str in self.categories_map.items():
            expanded_path = os.path.expanduser(path_str)
            os.makedirs(expanded_path, exist_ok=True)
            self.categories_map[cat_name] = expanded_path

    def _get_unique_filename(self, dest_dir: str, filename: str) -> str:
        """Appends a counter to the filename if the destination file already exists."""
        base, ext = os.path.splitext(filename)
        counter = 1
        new_filename = filename
        while os.path.exists(os.path.join(dest_dir, new_filename)):
            new_filename = f"{base}_{counter}{ext}"
            counter += 1
        return new_filename

    def process_file(self, filepath: str):
        """Main flow: Hash -> Check Duplicate -> Extract -> Classify -> Move -> Log."""
        # Add slight delay to ensure file write is finished (basic debounce)
        time.sleep(1)
        
        if not os.path.exists(filepath):
            return

        filename = os.path.basename(filepath)
        
        # 1. Hashing and duplicate check
        file_hash = get_file_hash(filepath)
        if self.db.hash_exists(file_hash):
            print(f"[{filename}] Duplicate file detected based on contents. Skipping move to avoid clutter.")
            # Depending on preference, we could delete `os.remove(filepath)`
            return

        # 2. Extract content
        print(f"[{filename}] Extracting text...")
        content_snippet = extract_text(filepath)
        
        # 3. Classify
        print(f"[{filename}] Classifying with Ollama...")
        category = self.classifier.classify(filename, content_snippet)
        print(f"[{filename}] Classified as: {category}")

        # 4. Move
        dest_dir = self.categories_map.get(category)
        if not dest_dir:
            print(f"[{filename}] Category '{category}' not found in map, defaulting to Misc.")
            dest_dir = self.categories_map.get("Misc", os.path.expanduser("~/Documents/Misc"))
            os.makedirs(dest_dir, exist_ok=True)
            category = "Misc"

        new_filename = self._get_unique_filename(dest_dir, filename)
        dest_path = os.path.join(dest_dir, new_filename)

        try:
            shutil.move(filepath, dest_path)
            print(f"[{filename}] Moved to {dest_path}")
            
            # 5. Log
            self.db.log_move(new_filename, filepath, dest_path, category, file_hash)
            notify_mac("AI File Organizer", f"Sorted '{new_filename}' to {category}")

        except Exception as e:
            print(f"[{filename}] Error moving file: {e}")
            
        finally:
            # Force aggressive garbage collection after each file
            content_snippet = None
            gc.collect()

    def undo_last_move(self) -> str:
        """Reverses the last recorded file transfer."""
        record = self.db.get_latest_move()
        if not record:
            return "No previous move found."
            
        dest_path = record["destination_path"]
        src_path = record["source_path"]
        
        if not os.path.exists(dest_path):
            return "File no longer exists in destination."
            
        # Move back
        try:
            shutil.move(dest_path, src_path)
            self.db.delete_log(record["id"])
            filename = record["filename"]
            notify_mac("AI File Organizer", f"Reverted '{filename}' back to Downloads")
            return f"Successfully restored {filename}!"
        except Exception as e:
            return f"Failed to undo: {e}"
