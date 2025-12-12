import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models

def debug_db():
    db = SessionLocal()
    try:
        # 1. List all Tags
        print("--- ALL TAGS ---")
        tags = db.query(models.Tag).all()
        for t in tags:
            print(f"ID: {t.id}, Cat: '{t.category}', Name: '{t.name}'")

        # 2. Check Question -> Tags relationships
        print("\n--- QUESTION TAGS (First 5) ---")
        questions = db.query(models.Question).limit(5).all()
        for q in questions:
            tag_strs = [f"{t.category}:{t.name}" for t in q.tags]
            print(f"QID: {q.id}, Tags: {tag_strs}")

        # 3. Test Filter Query Manually
        print("\n--- TEST FILTER MATCH ---")
        # Find a category from existing tags
        if tags:
            sample_cat = tags[0].category
            print(f"Testing Filter for Category: '{sample_cat}'")
            
            # Replicate crud.get_questions logic
            query = db.query(models.Question).join(models.Question.tags).filter(models.Tag.category == sample_cat)
            count = query.count()
            print(f"Query Result Count: {count}")
            
            # Check EXACT string match
            print(f"Sample Cat Type: {type(sample_cat)}")
            print(f"Sample Cat Length: {len(sample_cat)}")
            
    finally:
        db.close()

if __name__ == "__main__":
    debug_db()
