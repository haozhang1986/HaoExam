from sqlalchemy.orm import Session
from . import models, schemas

def get_question(db: Session, question_id: int):
    return db.query(models.Question).filter(models.Question.id == question_id).first()

from typing import Optional, List

def get_questions(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    curriculum: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[str] = None,
    difficulty: Optional[models.DifficultyLevel] = None,
    tag_category: Optional[str] = None,
    tag_name: Optional[str] = None
):
    query = db.query(models.Question)
    
    if tag_category or tag_name:
        query = query.join(models.Question.tags)
        if tag_category:
            query = query.filter(models.Tag.category == tag_category)
        if tag_name:
            query = query.filter(models.Tag.name == tag_name)
            
    if curriculum:
        query = query.filter(models.Question.curriculum == curriculum)
    if subject:
        query = query.filter(models.Question.subject == subject)
    if year:
        query = query.filter(models.Question.year == year)
    if month:
        query = query.filter(models.Question.month == month)
    if difficulty:
        query = query.filter(models.Question.difficulty == difficulty)
        
    return query.offset(skip).limit(limit).all()

def create_question(db: Session, question: schemas.QuestionCreate, question_image_path: str, answer_image_path: str, tags: List[schemas.TagCreate] = []):
    db_question = models.Question(
        **question.dict(),
        question_image_path=question_image_path,
        answer_image_path=answer_image_path
    )
    
    # Handle Tags
    for tag_data in tags:
        # Check if tag exists (by name and category)
        db_tag = db.query(models.Tag).filter(models.Tag.name == tag_data.name, models.Tag.category == tag_data.category).first()
        if not db_tag:
            db_tag = models.Tag(name=tag_data.name, category=tag_data.category)
            db.add(db_tag)
            db.commit()
            db.refresh(db_tag)
        db_question.tags.append(db_tag)

    db.add(db_question)
    db.commit()
    db.refresh(db_question)
    db.refresh(db_question)
    return db_question

def update_question(db: Session, question_id: int, question_update: schemas.QuestionUpdate):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not db_question:
        return None
    
    update_data = question_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_question, key, value)

    db.commit()
    db.refresh(db_question)
    return db_question

import os

def delete_question(db: Session, question_id: int):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if db_question:
        # Delete images from disk
        if db_question.question_image_path and os.path.exists(db_question.question_image_path):
            try:
                os.remove(db_question.question_image_path)
            except OSError as e:
                print(f"Error deleting question image: {e}")

        if db_question.answer_image_path and os.path.exists(db_question.answer_image_path):
            try:
                os.remove(db_question.answer_image_path)
            except OSError as e:
                print(f"Error deleting answer image: {e}")

        db.delete(db_question)
        db.commit()
        return True
    return False

def get_tags(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Tag).offset(skip).limit(limit).all()

def create_tag(db: Session, tag: schemas.TagCreate):
    db_tag = models.Tag(name=tag.name, category=tag.category)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag

def get_subjects(db: Session):
    return db.query(models.Question.subject).distinct().all()

def get_curriculums(db: Session):
    return db.query(models.Question.curriculum).distinct().all()

def update_tag(db: Session, tag_id: int, tag_update: schemas.TagCreate):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        db_tag.name = tag_update.name
        db_tag.category = tag_update.category
        db.commit()
        db.refresh(db_tag)
        return db_tag
    return None

def delete_tag(db: Session, tag_id: int):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        db.delete(db_tag)
        db.commit()
        return True
    return False
