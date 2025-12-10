from sqlalchemy import Column, ForeignKey, Integer, String, Table, Enum
from sqlalchemy.orm import relationship
from .database import Base
import enum

# Association table for many-to-many relationship between Question and Tag
question_tags = Table('question_tags', Base.metadata,
    Column('question_id', Integer, ForeignKey('questions.id')),
    Column('tag_id', Integer, ForeignKey('tags.id'))
)

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
    paper = Column(String) # e.g., "Paper 1"
    question_number = Column(String)
    difficulty = Column(Enum(DifficultyLevel), default=DifficultyLevel.Medium)
    
    # Relationships
    tags = relationship("Tag", secondary=question_tags, back_populates="questions")

class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True) # e.g., "Integration", "Calculus"
    category = Column(String, nullable=True) # e.g., "Topic", "Sub-topic"

    questions = relationship("Question", secondary=question_tags, back_populates="tags")
