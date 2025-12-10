import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import models, pdf_engine
from PIL import Image

# Setup DB connection
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def generate_full_pdf():
    print("Fetching all questions...")
    questions = db.query(models.Question).all()
    print(f"Found {len(questions)} questions.")
    
    output_path = "full_test_worksheet.pdf"
    print(f"Generating PDF to {output_path}...")
    
    try:
        pdf_engine.generate_worksheet(questions, output_path, include_answers=True)
        print("PDF generation successful!")
    except Exception as e:
        print(f"PDF generation FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    generate_full_pdf()
