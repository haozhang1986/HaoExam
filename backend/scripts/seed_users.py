import sys
import os

# Add backend directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal, engine
from app import models, auth

# Create tables if they don't exist (important for new User table)
models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

def create_user(username, password, role):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        print(f"Creating user: {username} ({role})")
        hashed_pw = auth.get_password_hash(password)
        db_user = models.User(username=username, hashed_password=hashed_pw, role=role)
        db.add(db_user)
    else:
        print(f"User {username} already exists. Updating role/password...")
        user.hashed_password = auth.get_password_hash(password)
        user.role = role

    db.commit()

# Seed Users
create_user("admin", "admin123", "admin")
create_user("teacher", "teacher123", "teacher")
create_user("student", "student123", "student")

print("Seeding complete.")
db.close()
