import os
import json
import time
import re

# Set how far back to look for "newly added" files (in seconds). 
# 3600 seconds = 1 hour. Adjust if you ran the previous script longer ago.
TIME_THRESHOLD_SECONDS = 3600 

def clean_text(text):
    if not isinstance(text, str):
        return text
        
    # 1. Fix the specific mojibake (encoding errors) present in your CSV
    mojibake_fixes = {
        '√∫': 'ú',      # e.g., Araújo
        'ƒá': 'ć',      # e.g., Popović
        '√≠': 'í',      # e.g., Martín
        '√§': 'ä',      # e.g., Hämäläinen
        '√©': 'é',      # e.g., Pérez
        '√∂': 'ö',      # e.g., Höfer
        '‚Ä¶': '...',   # Ellipsis
        '¬†': ' ',      # Non-breaking space
        '‚Äô': "'",     # Right single quote
        '‚Äì': '-',     # En dash
        '‚Äú': '"',     # Left double quote
        '‚Äù': '"',     # Right double quote
    }
    
    for bad_char, good_char in mojibake_fixes.items():
        text = text.replace(bad_char, good_char)
        
    # 2. Strip out any remaining weird control characters or unprintable garbage
    text = re.sub(r'[^\x20-\x7E\xA0-\xFF]', '', text)
    
    # Clean up any accidental double spaces left behind
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def main():
    pub_dir = 'public/content/publications'
    if not os.path.exists(pub_dir):
        print(f"Directory {pub_dir} not found.")
        return

    current_time = time.time()
    cleaned_count = 0

    for filename in os.listdir(pub_dir):
        if not filename.endswith('.json'):
            continue
            
        filepath = os.path.join(pub_dir, filename)
        file_mod_time = os.path.getmtime(filepath)
        
        # Check if the file was modified within our time threshold
        if (current_time - file_mod_time) <= TIME_THRESHOLD_SECONDS:
            
            with open(filepath, 'r', encoding='utf-8') as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    print(f"Skipping {filename} - Invalid JSON")
                    continue
            
            needs_saving = False
            
            # Clean all string values in the JSON object
            for key, value in data.items():
                if isinstance(value, str):
                    cleaned_value = clean_text(value)
                    
                    # Specific fix for authors: replace trailing ellipsis with "et al"
                    if key == 'authors':
                        # Matches ", ..." or " ..." or "..." at the very end of the string
                        cleaned_value = re.sub(r',?\s*\.\.\.$', ' et al.', cleaned_value)
                    
                    if cleaned_value != value:
                        data[key] = cleaned_value
                        needs_saving = True
            
            # Only rewrite the file if we actually changed something
            if needs_saving:
                with open(filepath, 'w', encoding='utf-8') as f:
                    # ensure_ascii=False forces Python to write actual 'ä' instead of '\u00e4'
                    json.dump(data, f, indent=2, ensure_ascii=False)
                print(f"Cleaned: {filename}")
                cleaned_count += 1

    print(f"\nDone! Cleaned {cleaned_count} recently added files.")

if __name__ == '__main__':
    main()