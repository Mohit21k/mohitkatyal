import time
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from organizer.file_mover import FileMover

class DefaultHandler(FileSystemEventHandler):
    def __init__(self, file_mover: FileMover):
        super().__init__()
        self.file_mover = file_mover
        
        # Keep track of recently processed files (in memory debounce)
        # to prevent duplicate events on macOS
        self.processed = {}

    def is_valid_file(self, filepath: str) -> bool:
        """Filters out hidden files and temporary downloads."""
        filename = os.path.basename(filepath)
        if filename.startswith('.'): return False
        if filename.endswith('.crdownload') or filename.endswith('.part'): return False
        return True

    def on_created(self, event):
        if event.is_directory:
            return
        self.handle_event(event.src_path)
        
    def on_modified(self, event):
        if event.is_directory:
            return
        self.handle_event(event.src_path)

    def handle_event(self, filepath: str):
        if not self.is_valid_file(filepath):
            return
            
        current_time = time.time()
        # Debounce: If we saw this exact file in the last 5 seconds, ignore the event.
        if filepath in self.processed and current_time - self.processed[filepath] < 5:
            return
            
        self.processed[filepath] = current_time
        print(f"Watchdog event triggered for: {filepath}")
        
        try:
             self.file_mover.process_file(filepath)
        except Exception as e:
             print(f"Failed to process {filepath}: {e}")

class FolderWatcher:
    def __init__(self, watch_dirs: list[str], file_mover: FileMover):
        self.watch_dirs = [os.path.expanduser(d) for d in watch_dirs]
        self.file_mover = file_mover
        self.observer = Observer()

    def start(self):
        handler = DefaultHandler(self.file_mover)
        count = 0
        for directory in self.watch_dirs:
            if not os.path.exists(directory):
                print(f"Warning: directory {directory} does not exist, skipping.")
                continue
            self.observer.schedule(handler, directory, recursive=False)
            print(f"Watching {directory}...")
            count += 1
            
        if count == 0:
            print("No valid directories to watch. Exiting watcher.")
            return

        self.observer.start()
        print("Observer running in background...")

    def stop(self):
        self.observer.stop()
        self.observer.join()
