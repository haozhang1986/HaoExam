# =============================================================================
# 导入语句 - 标准库
# =============================================================================
import html
import os
import re
import shutil
import tempfile
import traceback
import uuid
from datetime import timedelta
from typing import List, Optional, Union
from urllib.parse import quote

# =============================================================================
# 导入语句 - 第三方库
# =============================================================================
from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

# =============================================================================
# 导入语句 - 本地模块
# =============================================================================
from . import auth, crud, models, pdf_engine, schemas, utils
from .config import logger, settings
from .database import SessionLocal, engine, get_db
from .zip_ingest import ZipIngestor
from .services.generator import (
    SmartExamGenerator,
    GeneratorRequest,
    TopicWeight,
    SubtopicWeight,
    DifficultyRatio
)

# --- XSS 防护函数 ---
def sanitize_input(text: str) -> str:
    """清理用户输入，防止 XSS 攻击"""
    if text is None:
        return None
    # HTML 实体转义
    text = html.escape(text)
    # 移除可能的脚本标签残留
    text = re.sub(r'<[^>]*>', '', text)
    # 限制长度
    return text[:200].strip()

models.Base.metadata.create_all(bind=engine)

app = FastAPI()


# =============================================================================
# 初始化默认用户账户
# =============================================================================
def init_default_users():
    """
    创建内置测试账户（如果不存在）

    账户列表：
    - admin / admin123     (管理员 - 所有权限)
    - teacher / teacher123 (教师 - Gallery + Generator)
    - student / student123 (学生 - 仅 Gallery)
    """
    db = SessionLocal()
    try:
        default_users = [
            {"username": "admin", "password": "admin123", "role": "admin"},
            {"username": "teacher", "password": "teacher123", "role": "teacher"},
            {"username": "student", "password": "student123", "role": "student"},
        ]

        for user_data in default_users:
            # 检查用户是否已存在
            existing_user = db.query(models.User).filter(
                models.User.username == user_data["username"]
            ).first()

            if not existing_user:
                # 创建新用户
                hashed_password = auth.get_password_hash(user_data["password"])
                new_user = models.User(
                    username=user_data["username"],
                    hashed_password=hashed_password,
                    role=user_data["role"]
                )
                db.add(new_user)
                logger.info(f"Created default user: {user_data['username']} ({user_data['role']})")

        db.commit()
    except Exception as e:
        logger.error(f"Failed to create default users: {e}")
        db.rollback()
    finally:
        db.close()


# 应用启动时初始化默认用户
@app.on_event("startup")
async def startup_event():
    init_default_users()


# CORS Configuration - 从配置文件读取
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有方法，包括 OPTIONS 预检
    allow_headers=["*"],  # 允许所有请求头
)

# 静态文件目录 - 从配置文件读取
STATIC_DIR = str(settings.STATIC_DIR)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
# app.mount("/", StaticFiles(directory=os.path.join(BASE_DIR, "../frontend"), html=True), name="frontend")

# Dependency


# --- Tags API ---

@app.post("/tags/", response_model=schemas.Tag)
def create_tag(tag: schemas.TagCreate, db: Session = Depends(get_db)):
    # XSS 防护：清理输入
    tag.name = sanitize_input(tag.name)
    tag.category = sanitize_input(tag.category)
    return crud.create_tag(db=db, tag=tag)

@app.get("/tags/", response_model=List[schemas.Tag])
def read_tags(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_tags(db, skip=skip, limit=limit)

@app.put("/tags/{tag_id}", response_model=schemas.Tag)
def update_tag(tag_id: int, tag: schemas.TagCreate, db: Session = Depends(get_db)):
    # XSS 防护：清理输入
    tag.name = sanitize_input(tag.name)
    tag.category = sanitize_input(tag.category)
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

# --- 图片上传验证 ---
async def validate_image(file: UploadFile) -> tuple[bool, str]:
    """验证图片文件类型和大小"""
    if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
        return False, f"不支持的文件类型: {file.content_type}。只允许 JPG/PNG 格式。"

    content = await file.read()
    await file.seek(0)

    if len(content) > settings.MAX_IMAGE_SIZE:
        size_mb = len(content) / (1024 * 1024)
        max_mb = settings.MAX_IMAGE_SIZE / (1024 * 1024)
        return False, f"文件过大: {size_mb:.2f}MB。最大允许 {max_mb:.0f}MB。"

    return True, ""

async def validate_images(files: List[UploadFile]) -> tuple[bool, str]:
    """验证多个图片文件"""
    for file in files:
        valid, error = await validate_image(file)
        if not valid:
            return False, error
    return True, ""

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
async def create_question(
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
    # 0. 验证图片文件
    valid, error = await validate_images(question_images)
    if not valid:
        raise HTTPException(status_code=400, detail=f"题目图片验证失败: {error}")

    valid, error = await validate_images(answer_images)
    if not valid:
        raise HTTPException(status_code=400, detail=f"答案图片验证失败: {error}")

    # 1. Save Images
    # Ensure uploads directory exists
    uploads_dir = os.path.join(STATIC_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    def save_stitched_image(files: List[UploadFile]) -> str:
        # Stitch images
        stitched_img = utils.stitch_images(files)

        if not stitched_img:
            return None

        # Generate unique filename (JPEG format)
        filename = f"{uuid.uuid4()}.jpg"
        file_path = os.path.join(uploads_dir, filename)

        # Save as JPEG with good quality
        stitched_img.save(file_path, format="JPEG", quality=92)

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
    id: List[int] = Query(None),  # 支持多个 ID: ?id=1&id=2&id=3
    # ExamSlicer fields - multi-select support
    paper_number: str = None,
    topic: List[str] = Query(None),  # Multi-select support
    subtopic: List[str] = Query(None),  # Multi-select support
    question_type: str = None,
    # 关键词搜索
    keyword: str = None,
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
        question_type=question_type,
        keyword=keyword
    )
    
    # RBAC: Student (or Guest) cannot see answers
    # If no user (Guest) or Role is Student -> Hide Answers
    # TODO: 临时关闭答案隐藏，开发完成后需重新启用
    # if not current_user or current_user.role == "student":
    #     for q in questions:
    #         q.answer_image_path = "hidden"

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


# =============================================================================
# Question Studio API - 题目工坊
# =============================================================================

@app.get("/api/questions/{question_id}", response_model=schemas.Question)
def get_question_by_id(question_id: int, db: Session = Depends(get_db)):
    """根据 ID 获取单个题目"""
    db_question = crud.get_question(db, question_id)
    if not db_question:
        raise HTTPException(status_code=404, detail="Question not found")
    return db_question


@app.post("/api/upload/image")
async def upload_single_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    上传单张图片，用于 Question Studio

    返回: {"filename": "xxx.jpg", "path": "static/uploads/xxx.jpg"}
    """
    # 权限检查：只有 admin 可以上传
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload images"
        )

    # 验证图片
    valid, error = await validate_image(file)
    if not valid:
        raise HTTPException(status_code=400, detail=error)

    # 保存图片
    uploads_dir = os.path.join(STATIC_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    # 读取内容
    content = await file.read()

    # 转换为 JPEG 格式
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(content))
    img = utils._convert_to_rgb(img)

    # 生成唯一文件名
    filename = f"{uuid.uuid4()}.jpg"
    file_path = os.path.join(uploads_dir, filename)

    # 保存为 JPEG
    img.save(file_path, format="JPEG", quality=92)

    relative_path = f"static/uploads/{filename}"
    return {"filename": filename, "path": relative_path}


@app.post("/api/upload/images")
async def upload_multiple_images(
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    上传多张图片并拼接，用于 Question Studio

    多张图片会垂直拼接（右对齐）成一张图片。
    返回: {"filename": "xxx.jpg", "path": "static/uploads/xxx.jpg"}
    """
    # 权限检查：只有 admin 可以上传
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload images"
        )

    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files uploaded")

    # 验证所有图片
    valid, error = await validate_images(files)
    if not valid:
        raise HTTPException(status_code=400, detail=error)

    # 读取所有图片内容
    image_bytes_list = []
    for file in files:
        content = await file.read()
        image_bytes_list.append(content)

    # 拼接图片
    stitched_img = utils.stitch_images_from_bytes(image_bytes_list)
    if not stitched_img:
        raise HTTPException(status_code=400, detail="Failed to stitch images")

    # 保存拼接后的图片
    uploads_dir = os.path.join(STATIC_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}.jpg"
    file_path = os.path.join(uploads_dir, filename)

    # 保存为 JPEG
    stitched_img.save(file_path, format="JPEG", quality=92)

    relative_path = f"static/uploads/{filename}"
    return {"filename": filename, "path": relative_path}


@app.post("/api/questions/studio", response_model=schemas.Question)
async def create_question_from_studio(
    question_image_path: str = Form(...),
    answer_image_path: str = Form(...),
    curriculum: str = Form(None),
    subject: str = Form(None),
    subject_code: str = Form(None),
    year: int = Form(None),
    season: str = Form(None),
    paper: str = Form(None),
    question_number: str = Form(None),
    difficulty: str = Form("Medium"),
    question_type: str = Form(None),
    topic: str = Form(None),
    subtopic: str = Form(None),  # JSON array string, e.g., '["1.1 xxx", "1.2 yyy"]'
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    从 Question Studio 创建题目（使用预上传的图片路径）
    """
    # 权限检查
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create questions"
        )

    # 验证图片路径存在
    q_full_path = os.path.join(settings.BASE_DIR, question_image_path)
    a_full_path = os.path.join(settings.BASE_DIR, answer_image_path)

    if not os.path.exists(q_full_path):
        raise HTTPException(status_code=400, detail=f"Question image not found: {question_image_path}")
    if not os.path.exists(a_full_path):
        raise HTTPException(status_code=400, detail=f"Answer image not found: {answer_image_path}")

    # 转换 difficulty 字符串为枚举
    difficulty_enum = models.DifficultyLevel.Medium
    if difficulty:
        try:
            difficulty_enum = models.DifficultyLevel(difficulty)
        except ValueError:
            pass  # 使用默认值

    # 创建题目数据
    question_data = schemas.QuestionCreate(
        curriculum=curriculum or "CIE",
        subject=subject,
        subject_code=subject_code,
        year=year,
        season=season,
        paper=paper,
        question_number=question_number,
        difficulty=difficulty_enum,
        question_type=question_type,
        topic=topic,
        subtopic=subtopic  # 直接传递 JSON 字符串
    )

    # 创建题目
    return crud.create_question(
        db=db,
        question=question_data,
        question_image_path=question_image_path,
        answer_image_path=answer_image_path,
        source_filename="studio_manual"
    )


# --- ZIP Ingestion API ---

@app.post("/api/upload")
async def upload_zip_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    上传并处理 ExamSlicer 生成的 ZIP 包

    处理流程:
    1. 接收 ZIP 文件
    2. 解压并读取 config.json 和各题目 JSON
    3. 校验 Topic/Subtopic 是否在 Syllabus 中存在
    4. 保存图片到 static/uploads 目录
    5. 写入数据库
    6. 返回处理结果

    响应格式:
    {
        "success": true,
        "processed_count": 15,
        "skipped_count": 2,
        "errors": [
            {"question": "Q3", "reason": "Topic 'Algbra' not found in syllabus"},
            {"question": "Q5", "reason": "Missing answer image"}
        ]
    }
    """
    # 1. 权限检查：只有 admin 可以上传
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can upload ZIP files"
        )

    # 2. 文件类型检查
    if not file.filename or not file.filename.endswith('.zip'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a ZIP archive (.zip)"
        )

    # 3. 保存上传的文件到临时目录
    temp_zip = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            temp_zip = temp_file.name
            # 分块写入，支持大文件
            shutil.copyfileobj(file.file, temp_file)

        logger.info(f"ZIP Upload: {file.filename} by {current_user.username}")

        # 4. 处理 ZIP 文件
        ingestor = ZipIngestor(db=db)
        result = ingestor.ingest_zip(
            zip_file_path=temp_zip,
            original_filename=file.filename
        )

        # 5. 记录日志
        logger.info(
            f"Ingestion complete - "
            f"Processed: {result['processed_count']}, "
            f"Skipped: {result['skipped_count']}, "
            f"Errors: {len(result['errors'])}"
        )

        # 6. 返回结果
        return {
            "success": result['success'],
            "processed_count": result['processed_count'],
            "skipped_count": result['skipped_count'],
            "errors": result['errors']
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"ZIP upload failed: {error_msg}", exc_info=True)

        # 返回错误响应（而不是抛出异常，以便前端能获取部分结果）
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "processed_count": 0,
                "skipped_count": 0,
                "errors": [{"question": "GLOBAL", "reason": error_msg}]
            }
        )

    finally:
        # 清理临时文件
        if temp_zip and os.path.exists(temp_zip):
            try:
                os.unlink(temp_zip)
            except Exception:
                pass


# 保留旧的端点路径以兼容
@app.post("/api/v1/ingest/zip")
async def ingest_zip_file_legacy(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    """Legacy endpoint - redirects to /api/upload"""
    return await upload_zip_file(file=file, db=db, current_user=current_user)


# =============================================================================
# Smart Generator API - 智能组卷
# =============================================================================

@app.post("/api/generator/smart", response_model=schemas.SmartGeneratorResponse)
async def generate_smart_exam(
    request: schemas.SmartGeneratorRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_teacher_or_admin)
):
    """
    智能组卷 API (需要 Teacher 或 Admin 权限)

    根据权重配置生成试卷：
    - topic_weights: 各知识点权重
    - difficulty_ratio: 难度比例 (Easy/Medium/Hard)

    算法流程:
    1. Bucket Allocation - 根据权重分配每个 Subtopic 的题目数量
    2. Difficulty Mapping - 按比例分配难度
    3. Query & Fallback - 查询数据库，优先保证知识点匹配
    """
    try:
        # 转换 schema 到 dataclass
        topic_weights = [
            TopicWeight(
                topic=tw.topic,
                weight=tw.weight,
                subtopics=[
                    SubtopicWeight(subtopic=sw.subtopic, weight=sw.weight)
                    for sw in tw.subtopics
                ]
            )
            for tw in request.topic_weights
        ]

        generator_request = GeneratorRequest(
            subject_code=request.subject_code,
            paper=request.paper,
            total_questions=request.total_questions,
            topic_weights=topic_weights,
            difficulty_ratio=DifficultyRatio(
                easy=request.difficulty_ratio.Easy,
                medium=request.difficulty_ratio.Medium,
                hard=request.difficulty_ratio.Hard
            )
        )

        # 执行生成
        generator = SmartExamGenerator(db)
        result = generator.generate(generator_request)

        # 转换响应
        return schemas.SmartGeneratorResponse(
            success=result.slots_filled > 0,
            question_ids=result.question_ids,
            slots_filled=result.slots_filled,
            slots_requested=result.slots_requested,
            fallback_used=result.fallback_used,
            unfilled_slots=[
                schemas.UnfilledSlot(**slot) for slot in result.unfilled_slots
            ],
            message=f"生成完成: {result.slots_filled}/{result.slots_requested} 道题"
        )

    except Exception as e:
        logger.error(f"Smart generator error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generator/reroll", response_model=schemas.RerollResponse)
async def reroll_question_endpoint(
    request: schemas.RerollRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_teacher_or_admin)
):
    """
    单题重新抽取 API (需要 Teacher 或 Admin 权限)

    在保持相同 topic/subtopic 的前提下，替换为另一道题
    """
    try:
        generator = SmartExamGenerator(db)
        new_id = generator.reroll_question(
            question_id=request.question_id,
            subject_code=request.subject_code,
            paper=request.paper,
            topic=request.topic,
            subtopic=request.subtopic,
            exclude_ids=request.exclude_ids
        )

        if new_id:
            return schemas.RerollResponse(
                success=True,
                new_question_id=new_id,
                message="重新抽取成功"
            )
        else:
            return schemas.RerollResponse(
                success=False,
                new_question_id=None,
                message="没有可替换的题目"
            )

    except Exception as e:
        logger.error(f"Reroll error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Worksheet API - 试卷生成
# =============================================================================

@app.post("/worksheet/generate")
async def generate_worksheet_endpoint(
    request: schemas.WorksheetGenerateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_teacher_or_admin)
):
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
# 开发模式: 前端由 Vite dev server (port 3000) 单独服务，注释掉下面这行
# 生产模式: 取消注释并指向 frontend/dist 目录
# app.mount("/", StaticFiles(directory=str(settings.BASE_DIR / "../frontend/dist"), html=True), name="frontend")
