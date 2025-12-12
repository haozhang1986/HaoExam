from typing import List, Optional
from pydantic import BaseModel
from .models import DifficultyLevel

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
    paper: Optional[str] = None
    question_number: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.Medium

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

class WorksheetGenerateRequest(BaseModel):
    question_ids: List[int]
    include_answers: bool = False
