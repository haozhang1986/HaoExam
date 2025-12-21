from typing import List, Optional
from pydantic import BaseModel, validator
from .models import DifficultyLevel

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "student" # Default to student, allow teacher/admin via specific code/UI later? Or just student for now. User said "create account", usually starts as student.

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

class TagBase(BaseModel):
    name: str
    category: Optional[str] = None

class TagCreate(TagBase):
    pass

class Tag(TagBase):
    id: int

    class Config:
        orm_mode = True

class QuestionBase(BaseModel):
    curriculum: Optional[str] = None
    subject: Optional[str] = None
    year: Optional[int] = None
    month: Optional[str] = None
    season: Optional[str] = None
    question_number: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.Medium
    # ExamSlicer Fields
    paper_number: Optional[str] = None
    question_type: Optional[str] = None
    topic: Optional[str] = None
    subtopic: Optional[str] = None
    subtopic_details: Optional[List[str]] = None  # List of learning outcomes

class QuestionCreate(QuestionBase):
    # Image paths will be handled separately or passed here after upload
    pass

class QuestionUpdate(QuestionBase):
    tags: Optional[List[TagCreate]] = None

class Question(QuestionBase):
    id: int
    question_image_path: str
    answer_image_path: str
    tags: List[Tag] = []

    class Config:
        orm_mode = True
    
    @validator('subtopic_details', pre=True)
    def parse_subtopic_details(cls, v):
        """Convert JSON string to list if needed"""
        if v is None:
            return None
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except:
                return None
        return v

class WorksheetGenerateRequest(BaseModel):
    question_ids: List[int]
    include_answers: bool = False
