# =============================================================================
# HaoExam 数据库模型 - Database Models
# =============================================================================
from sqlalchemy import Column, ForeignKey, Integer, String, Table, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base
import enum


# =============================================================================
# 多对多关联表 - Association Tables
# =============================================================================
question_tags = Table(
    'question_tags',
    Base.metadata,
    Column('question_id', Integer, ForeignKey('questions.id', ondelete="CASCADE")),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete="CASCADE"))
)


# =============================================================================
# 枚举类型 - Enums
# =============================================================================
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"


class DifficultyLevel(str, enum.Enum):
    Easy = "Easy"
    Medium = "Medium"
    Hard = "Hard"


# =============================================================================
# User 表 - 用户管理
# =============================================================================
class User(Base):
    """
    用户表：管理系统用户
    - admin: 管理员，可上传/删除题目
    - teacher: 教师，可组卷
    - student: 学生，可刷题
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="student")


# =============================================================================
# Question 表 - 题目核心表
# =============================================================================
class Question(Base):
    """
    题目表：存储所有真题数据

    数据溯源：通过 source_filename 可快速定位/删除某套试卷的所有题目
    示例：DELETE FROM questions WHERE source_filename = '9709_s20_qp_1.pdf'
    """
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)

    # -------------------------------------------------------------------------
    # 图片路径 (相对于 static 目录)
    # -------------------------------------------------------------------------
    question_image_path = Column(String, nullable=False)  # 题目图片
    answer_image_path = Column(String, nullable=False)    # 答案图片

    # -------------------------------------------------------------------------
    # 数据溯源 (关键字段)
    # -------------------------------------------------------------------------
    source_filename = Column(String, index=True, nullable=False)  # 来源文件名，如 "9709_s20_qp_1.pdf"

    # -------------------------------------------------------------------------
    # 考试元数据
    # -------------------------------------------------------------------------
    curriculum = Column(String, index=True)      # 课程体系: "CIE", "Edexcel", "AP"
    subject = Column(String, index=True)         # 科目: "Math", "Physics", "Chemistry"
    subject_code = Column(String, index=True)    # 科目代码: "9709", "9702", "9701"
    year = Column(Integer, index=True)           # 年份: 2020, 2021, 2022
    season = Column(String, index=True)          # 考季: "s" (Summer), "w" (Winter), "m" (March)
    paper = Column(String, index=True)           # 试卷编号: "1", "2", "3" (不区分 variant)

    # -------------------------------------------------------------------------
    # 题目信息
    # -------------------------------------------------------------------------
    question_number = Column(String)             # 题号 (字符串): "1", "2", "2a", "2b"
    question_index = Column(Integer)             # 排序索引 (整数): 1, 2, 3, 4...
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.Medium)
    question_type = Column(String)               # 题型: "Calculation", "Proof", "Graphing"

    # -------------------------------------------------------------------------
    # 知识点分类 (主要分类依据)
    # -------------------------------------------------------------------------
    topic = Column(String, index=True)           # 主题: "Algebra", "Calculus", "Mechanics"
    subtopic = Column(String)                    # 子主题: "Quadratics", "Differentiation"
    subtopic_details = Column(String)            # 学习目标 (JSON 字符串)

    # -------------------------------------------------------------------------
    # 选择题文本答案 (Multiple Choice Text Answer)
    # -------------------------------------------------------------------------
    answer_text = Column(String, nullable=True)  # 文本答案: "A", "B", "C", "D"

    # -------------------------------------------------------------------------
    # 关系
    # -------------------------------------------------------------------------
    tags = relationship("Tag", secondary=question_tags, back_populates="questions")


# =============================================================================
# Tag 表 - 通用标签库
# =============================================================================
class Tag(Base):
    """
    标签表：纯粹的标签库，不与特定科目/试卷绑定

    用途：
    - 自定义分类标记 (如 "重点", "易错", "高频考点")
    - 教师/学生可自由打标签
    - category 用于标签分组显示
    """
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint('name', 'category', name='uq_tag_name_category'),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)    # 标签名: "高频考点", "易错题"
    color = Column(String, default="#3B82F6")            # 颜色代码: "#FF5733", "#3B82F6"
    category = Column(String, default="custom")          # 分类: "system", "custom", "topic"

    questions = relationship("Question", secondary=question_tags, back_populates="tags")
