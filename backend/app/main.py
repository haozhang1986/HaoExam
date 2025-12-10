from fastapi import FastAPI, Depends, HTTPException
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import SessionLocal, engine
from fastapi.staticfiles import StaticFiles
import os

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

# CORS Configuration
origins = [
    "*", # Allow all origins for development (including file://)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
# Assuming main.py is in backend/app/ and static is in backend/static/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Ensure static directory exists
os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
# app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "../frontend"), html=True), name="frontend")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



# --- Tags API ---

@app.post("/tags/", response_model=schemas.Tag)
def create_tag(tag: schemas.TagCreate, db: Session = Depends(get_db)):
    return crud.create_tag(db=db, tag=tag)

@app.get("/tags/", response_model=List[schemas.Tag])
def read_tags(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_tags(db, skip=skip, limit=limit)

@app.put("/tags/{tag_id}", response_model=schemas.Tag)
def update_tag(tag_id: int, tag: schemas.TagCreate, db: Session = Depends(get_db)):
    db_tag = crud.update_tag(db, tag_id, tag)
    if not db_tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return db_tag

@app.delete("/tags/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    success = crud.delete_tag(db, tag_id)
    if not success:
        raise HTTPException(status_code=404, detail="Tag not found")
    return {"status": "success"}

from typing import List
from fastapi import File, UploadFile, Form, Query
import uuid
from . import utils

# --- Questions API ---

@app.get("/subjects/", response_model=List[str])
def read_subjects(db: Session = Depends(get_db)):
    subjects = crud.get_subjects(db)
    # Extract subject strings from tuples and filter out None
    return [s[0] for s in subjects if s[0]]

@app.get("/curriculums/", response_model=List[str])
def read_curriculums(db: Session = Depends(get_db)):
    curriculums = crud.get_curriculums(db)
    # Extract curriculum strings from tuples and filter out None
    return [c[0] for c in curriculums if c[0]]

@app.post("/questions/", response_model=schemas.Question)
def create_question(
    question_images: List[UploadFile] = File(...),
    answer_images: List[UploadFile] = File(...),
    curriculum: str = Form(None),
    subject: str = Form(None),
    year: int = Form(None),
    month: str = Form(None),
    season: str = Form(None),
    paper: str = Form(None),
    question_number: str = Form(None),
    difficulty: models.DifficultyLevel = Form(models.DifficultyLevel.Medium),
    tag_category: str = Form(None), # Level 1
    tag_name: str = Form(None),     # Level 2
    db: Session = Depends(get_db)
):
    # 1. Save Images
    # Ensure uploads directory exists
    uploads_dir = os.path.join(STATIC_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    def save_stitched_image(files: List[UploadFile]) -> str:
        # Stitch images
        stitched_img = utils.stitch_images(files)
        
        if not stitched_img:
            return None

        # Generate unique filename
        filename = f"{uuid.uuid4()}.png"
        file_path = os.path.join(uploads_dir, filename)
        
        # Save
        stitched_img.save(file_path, format="PNG")
            
        # Return relative path for DB
        return f"static/uploads/{filename}"

    q_path = save_stitched_image(question_images)
    a_path = save_stitched_image(answer_images)

    if not q_path or not a_path:
        raise HTTPException(status_code=400, detail="Failed to process images")

    # 2. Create DB Record
    question_data = schemas.QuestionCreate(
        curriculum=curriculum,
        subject=subject,
        year=year,
        month=month,
        season=season,
        paper=paper,
        question_number=question_number,
        difficulty=difficulty
    )
    
    tags = []
    if tag_name:
        tags.append(schemas.TagCreate(name=tag_name, category=tag_category))

    return crud.create_question(db=db, question=question_data, question_image_path=q_path, answer_image_path=a_path, tags=tags)

@app.get("/questions/", response_model=List[schemas.Question])
def read_questions(
    skip: int = 0, 
    limit: int = 100, 
    curriculum: str = None,
    subject: str = None,
    year: int = None,
    month: str = None,
    difficulty: models.DifficultyLevel = None,
    tag_category: str = Query(None),
    tag_name: str = Query(None),
    db: Session = Depends(get_db)
):
    return crud.get_questions(
        db, 
        skip=skip, 
        limit=limit, 
        curriculum=curriculum, 
        subject=subject,
        year=year,
        month=month,
        difficulty=difficulty,
        tag_category=tag_category,
        tag_name=tag_name
    )

@app.put("/questions/{question_id}", response_model=schemas.Question)
def update_question(question_id: int, question: schemas.QuestionUpdate, db: Session = Depends(get_db)):
    db_question = crud.update_question(db, question_id, question)
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question

@app.delete("/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)):
    success = crud.delete_question(db, question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"status": "success"}

from fastapi.responses import FileResponse
from . import pdf_engine

@app.post("/worksheet/generate")
def generate_worksheet(request: schemas.WorksheetRequest, db: Session = Depends(get_db)):
    # Fetch questions
    # Note: .in_() might not preserve order. 
    questions = db.query(models.Question).filter(models.Question.id.in_(request.question_ids)).all()
    
    # Sort questions to match the order in request.question_ids
    question_map = {q.id: q for q in questions}
    ordered_questions = [question_map[qid] for qid in request.question_ids if qid in question_map]
    
    output_path = os.path.join(STATIC_DIR, "worksheet.pdf")
    pdf_engine.generate_worksheet(ordered_questions, output_path, include_answers=request.include_answers)
    
    return FileResponse(output_path, media_type='application/pdf', filename="worksheet.pdf")

# Mount frontend at root (must be last to avoid shadowing API routes)
app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "../frontend"), html=True), name="frontend")
