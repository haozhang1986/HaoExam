from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app import models

def check_data():
    db = SessionLocal()
    try:
        # Check Tags
        tag_count = db.query(models.Tag).count()
        print(f"Tags count: {tag_count}")

        # Check Questions
        q_count = db.query(models.Question).count()
        print(f"Questions count: {q_count}")

        # Check if any questions have subjects/curriculums
        subjects = db.query(models.Question.subject).distinct().all()
        print(f"Distinct Subjects: {[s[0] for s in subjects]}")

    finally:
        db.close()

if __name__ == "__main__":
    check_data()
