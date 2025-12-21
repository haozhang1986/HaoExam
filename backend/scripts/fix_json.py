
import os
import re
import json

def clean_rtf_json():
    # Path to original file (Project Root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))
    rtf_path = os.path.join(project_root, "CIE9709Syllabus.json")
    clean_path = os.path.join(project_root, "clean_syllabus.json")

    print(f"Reading {rtf_path}...")
    with open(rtf_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Simple heuristic to find the JSON array
    # 1. Find the first '['
    start = content.find('[')
    if start == -1:
        print("Error: Could not find start of JSON array '['")
        return

    # 2. Find the last ']'
    # We might have trailing RTF brace '}' so we look for last ']'
    end = content.rfind(']')
    if end == -1:
        print("Error: Could not find end of JSON array ']'")
        return

    json_str = content[start:end+1]
    
    # 3. Clean up RTF artifacts
    # The output showed backslashes at end of lines like ` "Top": "...",\`
    # and escaped braces `\{\`
    
    # Remove backslashes
    json_str = json_str.replace('\\', '')
    
    # It might have removed escaping for quotes if any? 
    # Usually JSON keys/values are "foo", so \"foo\" -> "foo" is fine?
    # But wait, original file had `"Paper": "P1",\` -> `\` is distinct.
    # In RTF `\` starts a control word. 
    # Let's hope removing all `\` works.
    # BUT, if the JSON has `\\` (escaped backslash), we break it. 
    # Unlikely for syllabus topics.
    
    # Also remove weird RTF newlines or loose braces if any inside?
    # The view showed simple structure.
    
    print("Attempting to parse cleaned JSON...")
    try:
        data = json.loads(json_str)
        print("Success! Writing to clean_syllabus.json")
        with open(clean_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
    except json.JSONDecodeError as e:
        print(f"Failed to parse: {e}")
        print("Attempting to repair truncated JSON...")
        
        # Heuristic repair for the specific truncation case observed
        # The string ends with incomplete structure.
        # We look for the last closing brace '}' or bracket ']' that is "safe".
        # In our case, we saw it ended with '\{}' which became '{}' or similar after cleaning
        
        # Trim from the right until we find a '}' or ']'
        last_brace = json_str.rfind('}')
        last_bracket = json_str.rfind(']')
        
        cut_point = max(last_brace, last_bracket)
        
        if cut_point != -1:
            repaired_json = json_str[:cut_point+1]
            # Now we need to determine what to append.
            # We are likely deep inside.
            # If we assume we are inside Topics array -> ]
            # Inside Paper object -> }
            # Inside Root array -> ]
            # Let's try appending various closures until it validates
            
            closures = [
                "]", 
                "}]", 
                "}]", 
                "]}]", 
                "}]}]",
                "]}]}]"
            ]
            
            success = False
            for closure in closures:
                candidate = repaired_json + closure
                try:
                    data = json.loads(candidate)
                    print(f"Repaired successfully with closure: '{closure}'")
                    with open(clean_path, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2)
                    success = True
                    break
                except json.JSONDecodeError:
                    continue
            
            if not success:
                print("Could not meta-repair the JSON.")
        else:
            print("No valid cutting point found.")

if __name__ == "__main__":
    clean_rtf_json()
