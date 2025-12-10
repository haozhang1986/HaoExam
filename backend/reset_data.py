import os
import shutil
from app.database import SessionLocal, engine
from app import models

# 1. Clear Database
db = SessionLocal()
try:
    # Delete all rows
    num_questions = db.query(models.Question).delete()
    num_tags = db.query(models.Tag).delete()
    db.commit()
    print(f"Deleted {num_questions} questions and {num_tags} tags from database.")
except Exception as e:
    print(f"Error clearing database: {e}")
    db.rollback()
finally:
    db.close()

# 2. Clear Uploads Folder
# Assuming this script is run from d:\FirstWebsite\backend
uploads_dir = os.path.join("static", "uploads")
if os.path.exists(uploads_dir):
    try:
        # Delete all files in uploads dir
        for filename in os.listdir(uploads_dir):
            file_path = os.path.join(uploads_dir, filename)
            try:
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)
            except Exception as e:
                print(f"Failed to delete {file_path}. Reason: {e}")
        print(f"Cleared uploads directory: {uploads_dir}")
    except Exception as e:
        print(f"Error clearing uploads directory: {e}")
else:
    print(f"Uploads directory not found: {uploads_dir}")
