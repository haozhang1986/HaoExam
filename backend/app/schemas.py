# =============================================================================
# Pydantic Schemas - API 请求/响应模型
# =============================================================================
from typing import Any, List, Optional, Union
from pydantic import BaseModel, field_validator
from .models import DifficultyLevel


# =============================================================================
# User Schemas
# =============================================================================
class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "student"


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str


# =============================================================================
# Tag Schemas
# =============================================================================
class TagBase(BaseModel):
    name: str
    color: Optional[str] = "#3B82F6"  # 默认蓝色
    category: Optional[str] = "custom"


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: int

    class Config:
        from_attributes = True


# =============================================================================
# Question Schemas
# =============================================================================
class QuestionBase(BaseModel):
    # 考试元数据
    curriculum: Optional[str] = None      # CIE, Edexcel, AP
    subject: Optional[str] = None         # Math, Physics
    subject_code: Optional[str] = None    # 9709, 9702
    year: Optional[int] = None
    season: Optional[str] = None          # s, w, m
    paper: Optional[str] = None           # 1, 2, 3

    # 题目信息
    question_number: Optional[str] = None
    question_index: Optional[int] = None
    difficulty: Optional[DifficultyLevel] = DifficultyLevel.Medium
    question_type: Optional[str] = None

    # 知识点
    topic: Optional[str] = None
    subtopic: Optional[Union[str, List[str]]] = None  # 单个字符串或多个subtopic数组
    subtopic_details: Optional[Any] = None  # 可能是字符串数组、对象或对象数组

    # 选择题文本答案
    answer_text: Optional[str] = None  # 文本答案: "A", "B", "C", "D"


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(QuestionBase):
    question_image_path: Optional[str] = None
    answer_image_path: Optional[str] = None
    tags: Optional[List[TagCreate]] = None


class Question(QuestionBase):
    id: int
    question_image_path: str
    answer_image_path: str
    source_filename: Optional[str] = None  # 数据溯源
    tags: List[Tag] = []

    class Config:
        from_attributes = True

    @field_validator('subtopic', mode='before')
    @classmethod
    def parse_subtopic(cls, v):
        """Convert JSON array string to list if needed"""
        if v is None:
            return None
        if isinstance(v, str):
            # 尝试解析 JSON 数组格式 (如 '["A", "B", "C"]')
            if v.startswith('['):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            # 普通字符串直接返回
            return v
        return v

    @field_validator('subtopic_details', mode='before')
    @classmethod
    def parse_subtopic_details(cls, v):
        """Convert JSON string to list/dict if needed"""
        if v is None:
            return None
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except Exception:
                return None
        return v


# =============================================================================
# Worksheet Schemas
# =============================================================================
class WorksheetGenerateRequest(BaseModel):
    question_ids: List[int]
    include_answers: bool = False


# =============================================================================
# ZIP Upload Response Schema
# =============================================================================
class ZipUploadError(BaseModel):
    question: str
    reason: str


class ZipUploadResponse(BaseModel):
    success: bool
    processed_count: int
    skipped_count: int
    errors: List[ZipUploadError] = []


# =============================================================================
# Smart Generator Schemas - 智能组卷
# =============================================================================
class SubtopicWeightSchema(BaseModel):
    """子知识点权重"""
    subtopic: str
    weight: int  # 0-100, 占该 Topic 内部的比例


class TopicWeightSchema(BaseModel):
    """知识点权重"""
    topic: str
    weight: int  # 0-100, 占全卷的比例
    subtopics: List[SubtopicWeightSchema] = []


class DifficultyRatioSchema(BaseModel):
    """难度比例 (三者之和应为100)"""
    Easy: int = 30
    Medium: int = 50
    Hard: int = 20

    @field_validator('Easy', 'Medium', 'Hard', mode='before')
    @classmethod
    def validate_range(cls, v):
        if not isinstance(v, int):
            v = int(v)
        if not 0 <= v <= 100:
            raise ValueError('Difficulty value must be between 0 and 100')
        return v


class SmartGeneratorRequest(BaseModel):
    """智能组卷请求"""
    subject_code: str                         # 科目代码: 9709, 9702
    paper: str                                # 试卷: P1, P2, P3
    total_questions: int                      # 总题数
    topic_weights: List[TopicWeightSchema]    # 知识点权重配置
    difficulty_ratio: DifficultyRatioSchema   # 难度比例

    @field_validator('total_questions', mode='before')
    @classmethod
    def validate_total(cls, v):
        if not isinstance(v, int):
            v = int(v)
        if v < 1 or v > 100:
            raise ValueError('Total questions must be between 1 and 100')
        return v


class UnfilledSlot(BaseModel):
    """未填充的槽位信息"""
    topic: str
    subtopic: str
    difficulty: str


class SmartGeneratorResponse(BaseModel):
    """智能组卷响应"""
    success: bool
    question_ids: List[int]
    slots_filled: int
    slots_requested: int
    fallback_used: int  # 使用了回退难度的槽位数
    unfilled_slots: List[UnfilledSlot] = []
    message: str = ""


class RerollRequest(BaseModel):
    """单题重新抽取请求"""
    question_id: int
    subject_code: str
    paper: str
    topic: str
    subtopic: str
    exclude_ids: List[int]  # 需要排除的题目ID (当前试卷中的所有题)


class RerollResponse(BaseModel):
    """单题重新抽取响应"""
    success: bool
    new_question_id: Optional[int] = None
    message: str = ""
