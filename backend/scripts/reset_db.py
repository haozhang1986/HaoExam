import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, SessionLocal
from app import models, auth

def reset_database():
    print("WARNING: This will delete all data in the database.")
    print("Dropping all tables...")
    models.Base.metadata.drop_all(bind=engine)
    
    print("Recreating tables...")
    models.Base.metadata.create_all(bind=engine)
    
    print("Tables recreated.")
    
    # Seed Admin User
    db = SessionLocal()
    try:
        print("Seeding default users...")
        users = [
            ("admin", "admin123", "admin"),
            ("teacher", "teacher123", "teacher"),
            ("student", "student123", "student")
        ]
        
        for username, password, role in users:
            hashed_pw = auth.get_password_hash(password)
            user = models.User(username=username, hashed_password=hashed_pw, role=role)
            db.add(user)
        
        db.commit()
        print("Default users created.")
    except Exception as e:
        print(f"Error seeding users: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    reset_database()
