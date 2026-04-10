import sqlite3
import os
from datetime import datetime

class HistoryDB:
    def __init__(self, db_path: str):
        self.db_path = db_path
        # Ensure directory exists
        os.makedirs(os.path.dirname(os.path.abspath(self.db_path)), exist_ok=True)
        self.init_db()

    def init_db(self):
        """Creates the history table if it doesn't exist."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS file_moves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT,
                filename TEXT,
                source_path TEXT,
                destination_path TEXT,
                category TEXT,
                file_hash TEXT
            )
        ''')
        conn.commit()
        conn.close()

    def log_move(self, filename: str, source: str, destination: str, category: str, file_hash: str):
        """Logs a file move operation."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        timestamp = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO file_moves (timestamp, filename, source_path, destination_path, category, file_hash)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (timestamp, filename, source, destination, category, file_hash))
        conn.commit()
        conn.close()
        
    def hash_exists(self, file_hash: str) -> bool:
        """Checks if a file hash already exists in our history (duplicate detection)."""
        if not file_hash: return False
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT 1 FROM file_moves WHERE file_hash = ? LIMIT 1', (file_hash,))
        result = cursor.fetchone()
        conn.close()
        return result is not None

    def get_latest_move(self) -> dict:
        """Fetches the last logged file movement for undo functionality."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM file_moves ORDER BY id DESC LIMIT 1')
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None

    def delete_log(self, record_id: int):
        """Deletes a log record from the database (used after undo)."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM file_moves WHERE id = ?', (record_id,))
        conn.commit()
        conn.close()

