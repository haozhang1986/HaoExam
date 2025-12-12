from app.database import SessionLocal
from app import models
from sqlalchemy import text

def remove_generic_tags():
    db = SessionLocal()
    try:
        print("Removing generic Topic tags...")
        # Delete tags with category 'Topic'
        # We should be careful not to delete user's custom tags if they used 'Topic'.
        # But based on restore_tags.py, I added them.
        # User's tag was 'Circular Measure' category.
        
        # We can delete specific names I added to be safe
        TOPICS = [
            "Algebra", "Calculus", "Geometry", "Trigonometry", "Statistics",
            "Probability", "Mechanics", "Functions", "Coordinate Geometry",
            "Vectors", "Complex Numbers", "Matrices", "Differential Equations",
            "Sequences and Series", "Binomial Expansion", "Circular Measure"
        ]
        
        db.query(models.Tag).filter(
            models.Tag.name.in_(TOPICS),
            models.Tag.category == "Topic"
        ).delete(synchronize_session=False)
        
        db.commit()
        print("Removed generic tags.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    remove_generic_tags()
