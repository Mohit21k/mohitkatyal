import argparse
import os
import yaml
from pathlib import Path

from db.history import HistoryDB
from classifier.ai_classifier import AIClassifier
from organizer.file_mover import FileMover
from watcher.file_watcher import FolderWatcher

def load_config(config_path: str) -> dict:
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def run_batch_existing(folders: list[str], file_mover: FileMover):
    """Processes existing files in the given directories once."""
    print("Running batch process on existing files...")
    for folder in folders:
        expanded_folder = os.path.expanduser(folder)
        if not os.path.exists(expanded_folder):
            continue
        print(f"Scanning {expanded_folder}")
        for item in os.listdir(expanded_folder):
             filepath = os.path.join(expanded_folder, item)
             if os.path.isfile(filepath):
                 file_mover.process_file(filepath)
    print("Batch processing complete.")

def main():
    parser = argparse.ArgumentParser(description="AI File Organizer Daemon")
    parser.add_argument('--config', default='config/config.yaml', help='Path to config file')
    parser.add_argument('--run-existing', action='store_true', help='Scan and organize existing files before starting watcher')
    args = parser.parse_args()

    # Determine absolute path for config and db relative to the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, args.config)
    
    if not os.path.exists(config_path):
        print(f"Error: Config file not found at {config_path}")
        return

    config = load_config(config_path)

    # Initialize Database
    db_path = config.get("system", {}).get("log_db_path", "db/history.db")
    if not os.path.isabs(db_path):
         db_path = os.path.join(script_dir, db_path)
    db = HistoryDB(db_path)

    # Initialize Classifier
    cfgs = config.get("classifier", {})
    categories = list(config.get("categories", {}).keys())
    classifier = AIClassifier(
        ollama_url=cfgs.get("ollama_url", "http://localhost:11434/api/generate"),
        model=cfgs.get("model", "llama3"),
        categories=categories
    )

    # Initialize Mover
    mover = FileMover(config, db, classifier)

    folders_to_watch = config.get("watcher", {}).get("folders", [])

    if args.run_existing:
        run_batch_existing(folders_to_watch, mover)

    # Setup Watcher
    watcher = FolderWatcher(folders_to_watch, mover)
    
    print("Starting AI File Organizer service...")
    watcher.start()

    # Create the Menu Bar Application
    import rumps

    class FileOrganizerApp(rumps.App):
        def __init__(self):
            super(FileOrganizerApp, self).__init__("🤖")
            self.menu = ["Manual Sweep", "Undo Last Action"]

        @rumps.clicked("Manual Sweep")
        def manual_sweep(self, _):
            import threading
            threading.Thread(target=run_batch_existing, args=(folders_to_watch, mover)).start()
            rumps.notification("AI File Organizer", "Sweep Started", "Scanning folders manually...")

        @rumps.clicked("Undo Last Action")
        def undo(self, _):
            result = mover.undo_last_move()
            rumps.notification("AI File Organizer Undo", "Status", result)

    # Launch UI
    FileOrganizerApp().run()

if __name__ == "__main__":
    main()
