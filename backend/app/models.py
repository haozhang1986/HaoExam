from sqlalchemy import Column, ForeignKey, Integer, String, Table, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from .database import Base
import enum

# Association table for many-to-many relationship between Question and Tag
question_tags = Table('question_tags', Base.metadata,
    Column('question_id', Integer, ForeignKey('questions.id', ondelete="CASCADE")),
    Column('tag_id', Integer, ForeignKey('tags.id', ondelete="CASCADE"))
)

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    TEACHER = "teacher"
    STUDENT = "student"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="student") # Stored as string, validated by Enum in App schema

class DifficultyLevel(str, enum.Enum):
    Easy = "Easy"
    Medium = "Medium"
    Hard = "Hard"

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    
    # Images (Stored as relative paths to static dir)
    question_image_path = Column(String, nullable=False)
    answer_image_path = Column(String, nullable=False)
    
    # Metadata
    curriculum = Column(String, index=True) # e.g., "A-Level", "AP"
    subject = Column(String, index=True) # e.g., "Math", "Physics"
    year = Column(Integer, index=True)
    month = Column(String, index=True) # e.g., "June", "November"
    season = Column(String) # e.g., "May/June"
    question_number = Column(String)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.Medium)
    
    # ExamSlicer Fields
    paper_number = Column(String, index=True) # e.g., "P1", "P3", "M1"
    question_type = Column(String) # e.g., "Calculation", "Graphing"
    topic = Column(String, index=True) # e.g., "Algebra", "Differentiation"
    subtopic = Column(String) # e.g., "Modulus Functions", "Chain Rule"
    subtopic_details = Column(String) # JSON string storing list of learning outcomes
    
    # Relationships
    tags = relationship("Tag", secondary=question_tags, back_populates="questions")

class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint('name', 'category', 'paper', 'subject', name='uq_tag_name_category_paper_subject'),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True) 
    category = Column(String, nullable=True) # e.g., "Topic", "Sub-topic"
    paper = Column(String, nullable=True) # e.g., "1", "3", "S1", "M1"
    subject = Column(String, nullable=True, index=True) # e.g., "Math", "Physics"

    questions = relationship("Question", secondary=question_tags, back_populates="tags")
