import sys
import os
import json
import glob

# Add parent directory to path to import app modules
# Assuming script is in backend/scripts/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app import models

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_tags():
    db = SessionLocal()
    
    # Locate Syllabus Directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(current_dir))
    syllabus_dir = os.path.join(project_root, "backend", "syllabus")
    
    if not os.path.exists(syllabus_dir):
        print(f"Syllabus directory not found: {syllabus_dir}")
        return

    # In-memory cache to prevent duplicates within this transaction
    # Now includes (Name, Category, Paper, Subject)
    seen_tags = set()
    
    total_files = 0
    total_tags = 0

    json_files = glob.glob(os.path.join(syllabus_dir, "*.json"))
    
    print(f"Found {len(json_files)} syllabus files in {syllabus_dir}")

    try:
        for json_path in json_files:
            filename = os.path.basename(json_path)
            print(f"Processing {filename}...")
            
            # Deduce Subject from Filename (Naive approach)
            # Expected format: "Curriculum_Subject_Code.json" or similar.
            # e.g., "A-Level_Math_9709.json" -> Subject="Math"
            # If "Math" is in the name, use "Math". 
            # Robust way: Split by _, take 2nd element? 
            # Or look for known subjects.
            
            subject_val = "Math" # Default fallback
            fn_lower = filename.lower()
            if "math" in fn_lower:
                subject_val = "Math"
            elif "physic" in fn_lower:
                subject_val = "Physics"
            elif "chem" in fn_lower:
                subject_val = "Chemistry"
            elif "bio" in fn_lower:
                subject_val = "Biology"
            elif "econ" in fn_lower:
                subject_val = "Economics"
            
            try:
                with open(json_path, 'r', encoding='utf-8') as f:
                    syllabus = json.load(f)
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                continue

            if isinstance(syllabus, list):
                for paper_obj in syllabus:
                    paper_full_name = paper_obj.get("Paper", "Unknown")
                    if "Paper " in paper_full_name:
                        paper_val = paper_full_name.replace("Paper ", "").strip()
                    else:
                        paper_val = paper_full_name
                    
                    topics_list = paper_obj.get("Topics", [])
                    
                    for topic_obj in topics_list:
                        topic_name = topic_obj.get("Topic")
                        if not topic_name:
                            continue
                        
                        subtopics = topic_obj.get("Subtopics", [])
                        for subtopic_name in subtopics:
                            # Check cache (key must include paper & subject)
                            if (subtopic_name, topic_name, paper_val, subject_val) in seen_tags:
                                continue

                            # Check DB
                            existing_tag = db.query(models.Tag).filter(
                                models.Tag.name == subtopic_name,
                                models.Tag.category == topic_name,
                                models.Tag.paper == paper_val,
                                models.Tag.subject == subject_val
                            ).first()
                            
                            if not existing_tag:
                                new_tag = models.Tag(
                                    name=subtopic_name, 
                                    category=topic_name, 
                                    paper=paper_val,
                                    subject=subject_val
                                )
                                db.add(new_tag)
                                seen_tags.add((subtopic_name, topic_name, paper_val, subject_val))
                                total_tags += 1
                                try:
                                    print(f"    [+] Added: [{subject_val}] [P{paper_val}] [{topic_name}] -> {subtopic_name}")
                                except UnicodeEncodeError:
                                    pass
                            else:
                                seen_tags.add((subtopic_name, topic_name, paper_val, subject_val))
                                
            else:
                print(f"Error: JSON root in {filename} should be a list.")
        
        db.commit()
        print(f"Total tags added: {total_tags}")

    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("Populating tags...")
    seed_tags()
    print("Done.")
