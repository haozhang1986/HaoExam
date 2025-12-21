from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Query
from typing import List, Optional, Union
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, crud
from .database import SessionLocal, engine, get_db
from fastapi.staticfiles import StaticFiles
import os
import shutil

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
        question_number=question_number,
        difficulty=difficulty
    )
    
    tags = []
    if tag_name:
        tags.append(schemas.TagCreate(name=tag_name, category=tag_category))

    return crud.create_question(db=db, question=question_data, question_image_path=q_path, answer_image_path=a_path, tags=tags)

@app.exception_handler(Exception)
async def debug_exception_handler(request, exc):
    import traceback
    with open("global_error.log", "a") as f:
        f.write(f"Global Exception: {str(exc)}\n")
        f.write(traceback.format_exc())
        f.write("\n")
    return JSONResponse(status_code=500, content={"detail": "Internal Server Error", "error": str(exc)})

@app.get("/metadata/distinct/{field}")
def get_metadata(
    field: str,
    curriculum: str = None,
    subject: str = None,
    year: Optional[int] = None,
    month: Optional[str] = None,
    tag_category: Optional[Union[str, List[str]]] = Query(None),
    # Add support for Topic→Subtopic cascading
    topic: Optional[Union[str, List[str]]] = Query(None),
    paper_number: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_distinct_values(
        db, 
        field, 
        curriculum=curriculum, 
        subject=subject, 
        year=year, 
        month=month, 
        tag_category=tag_category,
        topic=topic,
        paper_number=paper_number
    )

from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from . import auth

# --- Auth API ---

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": user.role} # Returning role for frontend convenience

@app.post("/register", response_model=schemas.Token)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create user (Default role: Student, unless specified and allowed? Let's just create as Student for safety, or trust input for now)
    # User asked for 3 types. If they self-register, they should probably be Student.
    # But for flexibility in this demo, I will allow them to pass role if they want, or default to student.
    
    role = user.role if user.role in ["student", "teacher", "admin"] else "student"
    
    hashed_password = auth.get_password_hash(user.password)
    new_user = models.User(username=user.username, hashed_password=hashed_password, role=role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Auto-login
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": new_user.username, "role": new_user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer", "role": new_user.role}

# --- Questions API ---

# ... (subjects, curriculums, papers public or protected? Let's keep public for filters, or protect all?)
# User asked for multi-user system. Let's assume login required for main data.

from typing import Optional

@app.get("/questions/", response_model=List[schemas.Question])
def read_questions(
    skip: int = 0, 
    limit: int = 100, 
    curriculum: str = None,
    subject: str = None,
    year: int = None,
    month: str = None,
    difficulty: models.DifficultyLevel = None,
    tag_category: List[str] = Query(None),
    tag_name: List[str] = Query(None),
    id: Optional[int] = None,
    # ExamSlicer fields - multi-select support
    paper_number: str = None,
    topic: List[str] = Query(None),  # Multi-select support
    subtopic: List[str] = Query(None),  # Multi-select support
    question_type: str = None,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional)
):
    questions = crud.get_questions(
        db, 
        skip=skip, 
        limit=limit, 
        curriculum=curriculum, 
        subject=subject,
        year=year,
        month=month,
        difficulty=difficulty,
        tag_category=tag_category,
        tag_name=tag_name,
        id=id,
        paper_number=paper_number,
        topic=topic,
        subtopic=subtopic,
        question_type=question_type
    )
    
    # RBAC: Student (or Guest) cannot see answers
    # If no user (Guest) or Role is Student -> Hide Answers
    if not current_user or current_user.role == "student":
        for q in questions:
            q.answer_image_path = "hidden" # Or None/Empty string. "hidden" allows frontend to show lock icon if desired.
            
    return questions

@app.put("/questions/{question_id}", response_model=schemas.Question)
def update_question(question_id: int, question: schemas.QuestionUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
         raise HTTPException(status_code=403, detail="Not authorized")
    db_question = crud.update_question(db, question_id, question)
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question

@app.delete("/questions/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if current_user.role != "admin":
         raise HTTPException(status_code=403, detail="Not authorized")
    success = crud.delete_question(db, question_id)
    if not success:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"status": "success"}

# --- ZIP Ingestion API ---

@app.post("/api/v1/ingest/zip")
async def ingest_zip_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Upload and process a ZIP file containing ExamSlicer output
    Only admins can upload
    """
    # Check permission
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can upload ZIP files")
    
    # Validate file type
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="File must be a ZIP archive")
    
    # Save uploaded file temporarily
    import tempfile
    from .zip_ingest import ZipIngestor
    
    temp_zip = None
    try:
        # Create temporary file with proper cleanup
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            temp_zip = temp_file.name
            # Read and write in chunks to handle large files
            shutil.copyfileobj(file.file, temp_file)
        
        print(f"\n{'='*60}")
        print(f"📦 ZIP Upload: {file.filename}")
        print(f"👤 Uploaded by: {current_user.username}")
        print(f"{'='*60}")
        
        # Process the ZIP file
        ingestor = ZipIngestor()
        result = ingestor.ingest_zip(temp_zip)
        
        print(f"\n📊 INGESTION RESULTS")
        print(f"{'='*60}")
        print(f"✅ Successfully created: {result['stats']['created']}")
        print(f"🏷️  New tags created:    {result['stats']['tags_created']}")
        print(f"❌ Errors:              {result['stats']['errors']}")
        print(f"{'='*60}\n")
        
        return {
            "status": "success",
            "message": f"Successfully imported {result['stats']['created']} questions",
            "stats": result['stats']
        }
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback_str = traceback.format_exc()
        
        print(f"\n❌ ERROR during ZIP ingestion:")
        print(traceback_str)
        
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process ZIP file: {error_msg}"
        )
    
    finally:
        # Cleanup temporary ZIP file
        if temp_zip and os.path.exists(temp_zip):
            try:
                os.unlink(temp_zip)
            except:
                pass


from fastapi import Response
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from . import pdf_engine

@app.post("/worksheet/generate")
async def generate_worksheet_endpoint(request: schemas.WorksheetGenerateRequest, db: Session = Depends(get_db)):
    # 1. Fetch questions
    questions = db.query(models.Question).filter(models.Question.id.in_(request.question_ids)).all()
    
    # Sort
    question_map = {q.id: q for q in questions}
    ordered_questions = [question_map[qid] for qid in request.question_ids if qid in question_map]
    
    # 2. Generate to unique server file
    file_uuid = str(uuid.uuid4())
    file_id = f"{file_uuid}.pdf"  # File on disk still has .pdf
    output_path = os.path.join(STATIC_DIR, file_id)
    
    pdf_engine.generate_worksheet(ordered_questions, output_path, include_answers=request.include_answers)
    
    # 3. Return ID WITHOUT .pdf suffix (to avoid StaticFiles routing conflict)
    return {"status": "success", "file_id": file_uuid}

@app.get("/worksheet/prepare-download/{file_id}")
async def prepare_download_link(file_id: str, name: str = "worksheet.pdf"):
    """
    Physical rename strategy: copies the file to a new path with the user-friendly filename.
    Returns a download URL that will serve the file with Content-Disposition header.
    """
    # Add .pdf extension if missing (file_id is now UUID without .pdf)
    if not file_id.endswith('.pdf'):
        file_id = file_id + '.pdf'
    
    src_path = os.path.join(STATIC_DIR, file_id)
    if not os.path.exists(src_path):
        raise HTTPException(status_code=404, detail="File not found or expired")
    
    # Ensure filename has .pdf extension
    if not name.endswith('.pdf'):
        name = name + '.pdf'
    
    # Create specific folder for this file to avoid name collisions
    # Structure: static/downloads/<uuid>/<RealName.pdf>
    download_dir = os.path.join(STATIC_DIR, "downloads", file_id.replace('.pdf', ''))
    os.makedirs(download_dir, exist_ok=True)
    
    dest_path = os.path.join(download_dir, name)
    
    # Copy file (using copy2 to preserve metadata)
    shutil.copy2(src_path, dest_path)
    
    # Return URL to the download endpoint (not static files)
    from urllib.parse import quote
    url_name = quote(name)
    download_url = f"/download-file/{file_id.replace('.pdf', '')}/{url_name}"
    
    return {"status": "success", "url": download_url}

@app.get("/download-file/{uuid}/{filename}")
async def download_file(uuid: str, filename: str):
    """
    Serve file with Content-Disposition: attachment header to force download.
    """
    file_path = os.path.join(STATIC_DIR, "downloads", uuid, filename)
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/pdf'
    )

# Mount frontend at root (must be last to avoid shadowing API routes)
app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "../frontend"), html=True), name="frontend")
