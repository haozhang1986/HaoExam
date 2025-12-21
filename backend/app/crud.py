from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from . import models, schemas
import shutil

def get_question(db: Session, question_id: int):
    return db.query(models.Question).filter(models.Question.id == question_id).first()

from typing import Optional, List, Union

def get_questions(
    db: Session, 
    skip: int = 0, 
    limit: int = 100,
    curriculum: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[str] = None,
    difficulty: Optional[Union[models.DifficultyLevel, List[models.DifficultyLevel]]] = None, # Allow List
    tag_category: Optional[Union[str, List[str]]] = None, # Allow List
    tag_name: Optional[Union[str, List[str]]] = None, # Allow List
    id: Optional[int] = None,
    # ExamSlicer fields - now support multi-select
    paper_number: Optional[str] = None,
    topic: Optional[Union[str, List[str]]] = None,  # Multi-select support
    subtopic: Optional[Union[str, List[str]]] = None,  # Multi-select support
    question_type: Optional[str] = None
):
    with open("query_debug.log", "a") as f:
        f.write(f"GET_QUESTIONS: curr={curriculum}, sub={subject}, yr={year}, mth={month}, diff={difficulty}, cat={tag_category}, name={tag_name}, id={id}, paper={paper_number}, topic={topic}, subtopic={subtopic}, qtype={question_type}\n")
    
    query = db.query(models.Question)

    if id:
        query = query.filter(models.Question.id == id)
    if curriculum:
        query = query.filter(models.Question.curriculum == curriculum)
    if subject:
        query = query.filter(models.Question.subject == subject)
    if year:
        query = query.filter(models.Question.year == year)
    if month:
        query = query.filter(models.Question.month == month)
    
    # ExamSlicer field filters with multi-select support
    if paper_number:
        query = query.filter(models.Question.paper_number == paper_number)
    
    if topic:
        if isinstance(topic, list):
            if len(topic) > 0:  # Only apply filter if list is not empty
                query = query.filter(models.Question.topic.in_(topic))
        else:
            query = query.filter(models.Question.topic == topic)
    
    if subtopic:
        if isinstance(subtopic, list):
            if len(subtopic) > 0:  # Only apply filter if list is not empty
                query = query.filter(models.Question.subtopic.in_(subtopic))
        else:
            query = query.filter(models.Question.subtopic == subtopic)
    
    if question_type:
        query = query.filter(models.Question.question_type == question_type)
    
    # Debug Logging for Filter Checks
    # import sys
    # print(f"Filtering Difficulty: {difficulty} (Type: {type(difficulty)})", file=sys.stderr)
    
    if difficulty:
        if isinstance(difficulty, list):
            query = query.filter(models.Question.difficulty.in_(difficulty))
        else:
            query = query.filter(models.Question.difficulty == difficulty)


    if tag_category or tag_name:
        query = query.join(models.Question.tags)
        
        if tag_category:
            if isinstance(tag_category, list):
                query = query.filter(models.Tag.category.in_(tag_category))
            else:
                query = query.filter(models.Tag.category == tag_category)
        
        if tag_name:
            if isinstance(tag_name, list):
                query = query.filter(models.Tag.name.in_(tag_name))
            else:
                query = query.filter(models.Tag.name == tag_name)

    return query.distinct().offset(skip).limit(limit).all()

def create_question(db: Session, question: schemas.QuestionCreate, question_image_path: str, answer_image_path: str, tags: List[schemas.TagCreate] = []):
    db_question = models.Question(
        **question.dict(),
        question_image_path=question_image_path,
        answer_image_path=answer_image_path
    )
    
    try:
        # Handle Tags
        for tag_data in tags:
            # Check if tag exists (by name and category)
            db_tag = db.query(models.Tag).filter(models.Tag.name == tag_data.name, models.Tag.category == tag_data.category).first()
            if not db_tag:
                db_tag = models.Tag(name=tag_data.name, category=tag_data.category)
                db.add(db_tag)
                # Flush to get ID and allow appending
                db.flush() 
                db.refresh(db_tag)

            db_question.tags.append(db_tag)

        db.add(db_question)
        db.commit()
        db.refresh(db_question)
        # Return Eager Loaded Instance to avoid detached instance errors during validation
        return db.query(models.Question).options(joinedload(models.Question.tags)).filter(models.Question.id == db_question.id).first()
    except Exception as e:
        import traceback
        with open("error_log.txt", "a") as f:
            f.write(f"Error in create_question: {str(e)}\n")
            f.write(traceback.format_exc())
            f.write("\n")
        db.rollback()
        raise e

def update_question(db: Session, question_id: int, question_update: schemas.QuestionUpdate):
    db_question = db.query(models.Question).filter(models.Question.id == question_id).first()
    if not db_question:
        return None
    
    update_data = question_update.dict(exclude_unset=True)
    
    # Handle tags update separately if present
    if 'tags' in update_data:
        tags_data = update_data.pop('tags')
        db_question.tags = [] # Clear existing tags
        if tags_data:
            for tag in tags_data:
                # Reuse existing logic to find or create tag
                # We need to replicate the find-or-create logic here
                db_tag = db.query(models.Tag).filter(
                    models.Tag.name == tag['name'], 
                    models.Tag.category == tag['category']
                ).first()
                if not db_tag:
                    try:
                        with db.begin_nested():
                            db_tag = models.Tag(name=tag['name'], category=tag['category'])
                            db.add(db_tag)
                            db.flush()
                            db.refresh(db_tag)
                    except IntegrityError:
                        # Nested rollback is automatic with begin_nested context manager if it raises?
                        # Wait, begin_nested context manager swallows error if we handle it?
                        # No, if exception raised in block, it rolls back. We handle it here.
                        db_tag = db.query(models.Tag).filter(models.Tag.name == tag['name'], models.Tag.category == tag['category']).first()
                
                if db_tag:
                    db_question.tags.append(db_tag)

    for key, value in update_data.items():
        setattr(db_question, key, value)

    db.commit()
    db.refresh(db_question)
    # Return Eager Loaded Instance
    return db.query(models.Question).options(joinedload(models.Question.tags)).filter(models.Question.id == db_question.id).first()

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
    try:
        db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if db_tag:
            # Force delete from association table using raw SQL expression
            # This bypasses potential ORM relationship mapping issues
            stmt = models.question_tags.delete().where(models.question_tags.c.tag_id == tag_id)
            db.execute(stmt)
            
            # Now delete the tag
            db.delete(db_tag)
            db.commit()
            return True
        return False
    except Exception as e:
        print(f"Error deleting tag {tag_id}: {e}")
        db.rollback()
        return False

def get_distinct_values(
    db: Session, 
    field: str, 
    curriculum: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[str] = None,
    tag_category: Optional[str] = None,
    paper: Optional[str] = None,
    # Add support for Topic→Subtopic cascading
    topic: Optional[Union[str, List[str]]] = None,
    paper_number: Optional[str] = None
):
    """
    Get distinct values for a specific field, filtered by other fields.
    Supports columns in Question model and Tags.
    """
    # Base Query
    if field == 'tag_category':
        query = db.query(models.Tag.category)
    elif field == 'tag_name':
        query = db.query(models.Tag.name)
    elif field == 'paper':
        # Paper can be on Question or Tag... 
        # But User wants "Paper No" dropdown.
        # Questions have "question_number", but that's like "1(a)".
        # Tags now have "paper" (e.g. "1").
        # If field is "paper", we should probably return distinct models.Tag.paper
        # BUT wait, the Question model doesn't have "paper_number" explicitly as a column (only question_number).
        # We might need to rely on Tag.paper for the dropdown if we want to filter Topics by it.
        query = db.query(models.Tag.paper)
    elif hasattr(models.Question, field):
        query = db.query(getattr(models.Question, field))
    else:
        return []

    # Check if we need to filter by question attributes
    has_question_filters = any([curriculum, subject, year, month, topic, paper_number])
    
    # If filtering by question attributes, we MUST join questions (for tag fields)
    if field in ['tag_category', 'tag_name', 'paper'] and has_question_filters:
        query = query.join(models.Tag.questions)
    
    # Apply filters
    if curriculum:
        query = query.filter(models.Question.curriculum == curriculum)
    if subject:
        query = query.filter(models.Question.subject == subject)
    if year:
        query = query.filter(models.Question.year == year)
    if month:
        query = query.filter(models.Question.month == month)
    
    # CRITICAL: Topic filter for cascading (e.g., get subtopics for selected topics)
    if topic:
        if isinstance(topic, list):
            if len(topic) > 0:
                query = query.filter(models.Question.topic.in_(topic))
        else:
            query = query.filter(models.Question.topic == topic)
    
    # Paper number filter
    if paper_number:
        query = query.filter(models.Question.paper_number == paper_number)
    
    # Filter by Paper (if provided)
    if paper:
        if field in ['tag_category', 'tag_name']:
             query = query.filter(models.Tag.paper == paper)
        elif hasattr(models.Question, field):
             query = query.join(models.Question.tags).filter(models.Tag.paper == paper)
    
    # Filter by Subject (if provided) for Tags
    # Critical: If we are in "Input Mode" (has_question_filters is False/we force it), 
    # we want to filter Tags by the selected Subject dropdown, NOT by joining Questions.
    # But get_distinct_values assumes 'subject' param implies Models.Question.subject by default.
    # We need to distinguish.
    # Actually, if has_question_filters is True, we joined Question.
    # If it is False, we didn't.
    # BUT, if we want to filter Tags by Subject from the Tag table, we need to apply it to models.Tag.subject.
    
    if subject and field in ['tag_category', 'tag_name']:
        # If we joined questions, we already filtered by Question.subject.
        # But for correct data population, Question.subject likely matches Tag.subject.
        # However, for INPUT mode (uploading new q), we don't join questions.
        # So we MUST filter models.Tag.subject if the column exists.
        # We just added it.
        if hasattr(models.Tag, 'subject'):
             query = query.filter(models.Tag.subject == subject)
    
    # For tag filters
    if tag_category:
        if isinstance(tag_category, list):
            if field == 'tag_name':
                 query = query.filter(models.Tag.category.in_(tag_category))
            else:
                 if field not in ['tag_category', 'tag_name', 'paper']:
                     query = query.join(models.Question.tags).filter(models.Tag.category.in_(tag_category))
        else:
            if field == 'tag_category':
                query = query.filter(models.Tag.category == tag_category)
            elif field == 'tag_name':
                 query = query.filter(models.Tag.category == tag_category)
            else:
                 if field not in ['tag_category', 'tag_name', 'paper']:
                    query = query.join(models.Question.tags).filter(models.Tag.category == tag_category)
    
    return [r[0] for r in query.distinct().all() if r[0] is not None]
