from app.database import SessionLocal
from app import models, schemas, crud
import shutil
import os

def seed_data():
    db = SessionLocal()
    try:
        # Create some tags
        print("Creating tags...")
        tag1 = models.Tag(name="Algebra", category="Topic")
        tag2 = models.Tag(name="Geometry", category="Topic")
        tag3 = models.Tag(name="Hard", category="Difficulty")
        
        db.add(tag1)
        db.add(tag2)
        db.add(tag3)
        db.commit()
        
        # Ensure static/uploads exists and copy a dummy image there for testing
        os.makedirs("static/uploads", exist_ok=True)
        dummy_image_path = "static/test_q.png"
        dummy_target_path = "static/uploads/seed_q.png"
        
        # Create a dummy image if it doesn't exist (just a placeholder file)
        if not os.path.exists(dummy_image_path):
             with open(dummy_image_path, "wb") as f:
                 f.write(b"placeholder")

        shutil.copy(dummy_image_path, dummy_target_path)
        
        print("Creating question...")
        # Create a question
        question = models.Question(
            curriculum="IGCSE",
            subject="Mathematics",
            year=2023,
            month="June",
            season="Summer",
            paper="1",
            question_number="1",
            difficulty=models.DifficultyLevel.Medium,
            question_image_path="static/uploads/seed_q.png",
            answer_image_path="static/uploads/seed_q.png"
        )
        
        question.tags.append(tag1)
        db.add(question)
        db.commit()
        
        print("Database seeded successfully!")
        
    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
