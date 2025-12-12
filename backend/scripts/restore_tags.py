from app.database import SessionLocal
from app import models
from sqlalchemy import text

# List of common Math Topics
TOPICS = [
    "Algebra",
    "Calculus",
    "Geometry",
    "Trigonometry",
    "Statistics",
    "Probability",
    "Mechanics",
    "Functions",
    "Coordinate Geometry",
    "Vectors",
    "Complex Numbers",
    "Matrices",
    "Differential Equations",
    "Sequences and Series",
    "Binomial Expansion",
    "Circular Measure"  # The one they were trying to add
]

def restore_tags():
    db = SessionLocal()
    try:
        print("Restoring common tags...")
        count = 0
        for name in TOPICS:
            # Check if exists
            exists = db.query(models.Tag).filter_by(name=name, category="Topic").first()
            if not exists:
                tag = models.Tag(name=name, category="Topic")
                db.add(tag)
                count += 1
        
        db.commit()
        print(f"Restored {count} Topic tags.")
        
    except Exception as e:
        print(f"Error restoring tags: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    restore_tags()
