import hashlib
import os
from pypdf import PdfReader
from typing import Optional

def get_file_hash(filepath: str, block_size: int = 65536) -> str:
    """Calculates the SHA-256 hash of a file."""
    hasher = hashlib.sha256()
    try:
        with open(filepath, 'rb') as afile:
            buf = afile.read(block_size)
            while len(buf) > 0:
                hasher.update(buf)
                buf = afile.read(block_size)
    except Exception as e:
        print(f"Error hashing {filepath}: {e}")
        return ""
    return hasher.hexdigest()

def extract_text(filepath: str, max_chars: int = 2000) -> Optional[str]:
    """
    Extracts text from a file to help with classification.
    Currently supports .pdf and simple text files.
    """
    ext = os.path.splitext(filepath)[1].lower()
    
    if ext == '.pdf':
        try:
            reader = PdfReader(filepath)
            text = ""
            for i in range(min(3, len(reader.pages))): # Read up to first 3 pages
                page_text = reader.pages[i].extract_text()
                if page_text:
                    text += page_text + " "
            return text[:max_chars].strip()
        except Exception as e:
            print(f"Error extracting PDF text from {filepath}: {e}")
            return None
            
            # For common text-based files
    if ext in ['.txt', '.csv', '.md', '.json']:
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read(max_chars).strip()
        except:
            return None

    # For images
    if ext in ['.png', '.jpg', '.jpeg', '.tiff', '.bmp']:
        try:
            from PIL import Image
            import pytesseract
            img = Image.open(filepath)
            # Read first 2000 characters from image to save time
            text = pytesseract.image_to_string(img)
            return text[:max_chars].strip()
        except Exception as e:
            print(f"Error extracting image text from {filepath}: {e}")
            return None

    return None
