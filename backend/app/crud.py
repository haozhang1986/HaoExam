# =============================================================================
# CRUD 操作模块 - Database Operations
# =============================================================================
import json
import os
import traceback
from typing import List, Optional, Union

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from . import models, schemas
from .config import logger

# =============================================================================
# 路径配置
# =============================================================================
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# =============================================================================
# Question CRUD
# =============================================================================
def get_question(db: Session, question_id: int):
    return db.query(models.Question).filter(models.Question.id == question_id).first()


def get_questions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    # 基础筛选
    curriculum: Optional[str] = None,
    subject: Optional[str] = None,
    subject_code: Optional[str] = None,
    year: Optional[int] = None,
    season: Optional[str] = None,
    paper: Optional[str] = None,
    # 题目筛选
    difficulty: Optional[Union[models.DifficultyLevel, List[models.DifficultyLevel]]] = None,
    question_type: Optional[str] = None,
    # 知识点筛选 (支持多选)
    topic: Optional[Union[str, List[str]]] = None,
    subtopic: Optional[Union[str, List[str]]] = None,
    # 标签筛选
    tag_category: Optional[Union[str, List[str]]] = None,
    tag_name: Optional[Union[str, List[str]]] = None,
    # ID 筛选 (支持单个或多个)
    id: Optional[Union[int, List[int]]] = None,
    # 数据溯源
    source_filename: Optional[str] = None,
    # 兼容旧参数 (映射到新字段)
    month: Optional[str] = None,
    paper_number: Optional[str] = None,
):
    """获取题目列表，支持多种筛选条件"""

    # 兼容旧参数
    if month and not season:
        month_to_season = {'11': 'w', '10': 'w', '5': 's', '6': 's', '3': 'm', '2': 'm'}
        season = month_to_season.get(str(month), month)
    if paper_number and not paper:
        paper = paper_number  # 保留原始值，不再去掉 P 前缀

    query = db.query(models.Question)

    # ID 筛选 (支持单个或多个)
    if id is not None:
        if isinstance(id, list):
            if len(id) > 0:
                query = query.filter(models.Question.id.in_(id))
        else:
            query = query.filter(models.Question.id == id)

    # 基础筛选
    if curriculum:
        query = query.filter(models.Question.curriculum == curriculum)
    if subject:
        query = query.filter(models.Question.subject == subject)
    if subject_code:
        query = query.filter(models.Question.subject_code == subject_code)
    if year:
        query = query.filter(models.Question.year == year)
    if season:
        query = query.filter(models.Question.season == season)
    if paper:
        query = query.filter(models.Question.paper == paper)

    # 数据溯源筛选
    if source_filename:
        query = query.filter(models.Question.source_filename == source_filename)

    # 知识点筛选 (支持多选)
    if topic:
        if isinstance(topic, list) and len(topic) > 0:
            query = query.filter(models.Question.topic.in_(topic))
        elif isinstance(topic, str):
            query = query.filter(models.Question.topic == topic)

    # Subtopic 筛选 (支持 JSON 数组存储)
    # subtopic 字段可能是：普通字符串 或 JSON 数组字符串 '["a", "b"]'
    if subtopic:
        subtopic_list = subtopic if isinstance(subtopic, list) else [subtopic]
        if len(subtopic_list) > 0:
            # 构建 OR 条件：精确匹配 或 JSON 数组内包含
            conditions = []
            for st in subtopic_list:
                # 1. 精确匹配（纯字符串存储）
                conditions.append(models.Question.subtopic == st)
                # 2. JSON 数组内包含（使用 LIKE 匹配）
                conditions.append(models.Question.subtopic.like(f'%"{st}"%'))
            query = query.filter(or_(*conditions))

    if question_type:
        query = query.filter(models.Question.question_type == question_type)

    # 难度筛选
    if difficulty:
        if isinstance(difficulty, list):
            query = query.filter(models.Question.difficulty.in_(difficulty))
        else:
            query = query.filter(models.Question.difficulty == difficulty)

    # 标签筛选
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

    # 按 question_index 排序，然后按 ID
    query = query.order_by(models.Question.question_index, models.Question.id)

    return query.distinct().offset(skip).limit(limit).all()


def create_question(
    db: Session,
    question: schemas.QuestionCreate,
    question_image_path: str,
    answer_image_path: str,
    source_filename: str = None,
    tags: List[schemas.TagCreate] = None
):
    """创建新题目"""
    if tags is None:
        tags = []

    db_question = models.Question(
        **question.model_dump(),
        question_image_path=question_image_path,
        answer_image_path=answer_image_path,
        source_filename=source_filename or "manual_upload"
    )

    try:
        # 处理标签
        for tag_data in tags:
            db_tag = db.query(models.Tag).filter(
                models.Tag.name == tag_data.name,
                models.Tag.category == tag_data.category
            ).first()

            if not db_tag:
                db_tag = models.Tag(
                    name=tag_data.name,
                    category=tag_data.category,
                    color=getattr(tag_data, 'color', '#3B82F6')
                )
                db.add(db_tag)
                db.flush()
                db.refresh(db_tag)

            db_question.tags.append(db_tag)

        db.add(db_question)
        db.commit()
        db.refresh(db_question)

        return db.query(models.Question).options(
            joinedload(models.Question.tags)
        ).filter(models.Question.id == db_question.id).first()

    except Exception as e:
        logger.error(f"Error creating question: {e}")
        db.rollback()
        raise


def update_question(db: Session, question_id: int, question_update: schemas.QuestionUpdate):
    """更新题目"""
    db_question = db.query(models.Question).filter(
        models.Question.id == question_id
    ).first()

    if not db_question:
        return None

    update_data = question_update.model_dump(exclude_unset=True)

    # 单独处理标签更新
    if 'tags' in update_data:
        tags_data = update_data.pop('tags')
        db_question.tags = []

        if tags_data:
            for tag in tags_data:
                db_tag = db.query(models.Tag).filter(
                    models.Tag.name == tag['name'],
                    models.Tag.category == tag.get('category')
                ).first()

                if not db_tag:
                    try:
                        with db.begin_nested():
                            db_tag = models.Tag(
                                name=tag['name'],
                                category=tag.get('category'),
                                color=tag.get('color', '#3B82F6')
                            )
                            db.add(db_tag)
                            db.flush()
                            db.refresh(db_tag)
                    except IntegrityError:
                        db_tag = db.query(models.Tag).filter(
                            models.Tag.name == tag['name'],
                            models.Tag.category == tag.get('category')
                        ).first()

                if db_tag:
                    db_question.tags.append(db_tag)

    # 更新其他字段
    for key, value in update_data.items():
        if hasattr(db_question, key):
            setattr(db_question, key, value)

    db.commit()
    db.refresh(db_question)

    return db.query(models.Question).options(
        joinedload(models.Question.tags)
    ).filter(models.Question.id == db_question.id).first()


def delete_question(db: Session, question_id: int):
    """删除题目及其图片文件"""
    db_question = db.query(models.Question).filter(
        models.Question.id == question_id
    ).first()

    if not db_question:
        return False

    # 删除图片文件
    for path in [db_question.question_image_path, db_question.answer_image_path]:
        if path:
            full_path = os.path.join(BACKEND_DIR, path)
            if os.path.exists(full_path):
                try:
                    os.remove(full_path)
                except OSError as e:
                    logger.warning(f"Error deleting image: {e}")

    db.delete(db_question)
    db.commit()
    return True


def delete_questions_by_source(db: Session, source_filename: str) -> int:
    """
    根据 source_filename 批量删除题目
    用于数据溯源：删除某套试卷的所有题目
    返回删除的题目数量
    """
    questions = db.query(models.Question).filter(
        models.Question.source_filename == source_filename
    ).all()

    count = 0
    for q in questions:
        # 删除图片文件
        for path in [q.question_image_path, q.answer_image_path]:
            if path:
                full_path = os.path.join(BACKEND_DIR, path)
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except OSError as e:
                        logger.warning(f"Error deleting image: {e}")

        db.delete(q)
        count += 1

    db.commit()
    return count


# =============================================================================
# Tag CRUD
# =============================================================================
def get_tags(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Tag).offset(skip).limit(limit).all()


def create_tag(db: Session, tag: schemas.TagCreate):
    db_tag = models.Tag(
        name=tag.name,
        category=tag.category,
        color=getattr(tag, 'color', '#3B82F6')
    )
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


def update_tag(db: Session, tag_id: int, tag_update: schemas.TagCreate):
    db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
    if db_tag:
        db_tag.name = tag_update.name
        db_tag.category = tag_update.category
        if hasattr(tag_update, 'color'):
            db_tag.color = tag_update.color
        db.commit()
        db.refresh(db_tag)
        return db_tag
    return None


def delete_tag(db: Session, tag_id: int):
    try:
        db_tag = db.query(models.Tag).filter(models.Tag.id == tag_id).first()
        if db_tag:
            # 先删除关联
            stmt = models.question_tags.delete().where(
                models.question_tags.c.tag_id == tag_id
            )
            db.execute(stmt)
            # 再删除标签
            db.delete(db_tag)
            db.commit()
            return True
        return False
    except Exception as e:
        logger.error(f"Error deleting tag {tag_id}: {e}")
        db.rollback()
        return False


# =============================================================================
# 元数据查询
# =============================================================================
def get_subjects(db: Session):
    return db.query(models.Question.subject).distinct().all()


def get_curriculums(db: Session):
    return db.query(models.Question.curriculum).distinct().all()


def get_distinct_values(
    db: Session,
    field: str,
    curriculum: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[int] = None,
    season: Optional[str] = None,
    paper: Optional[str] = None,
    topic: Optional[Union[str, List[str]]] = None,
    # 兼容旧参数
    month: Optional[str] = None,
    paper_number: Optional[str] = None,
    tag_category: Optional[str] = None,
):
    """
    获取指定字段的去重值列表
    用于前端筛选器的选项填充
    """
    # 兼容旧参数
    if month and not season:
        month_to_season = {'11': 'w', '10': 'w', '5': 's', '6': 's', '3': 'm', '2': 'm'}
        season = month_to_season.get(str(month), month)
    if paper_number and not paper:
        paper = paper_number  # 保留原始值，不再去掉 P 前缀

    # 构建基础查询
    if field == 'tag_category':
        query = db.query(models.Tag.category)
    elif field == 'tag_name':
        query = db.query(models.Tag.name)
    elif hasattr(models.Question, field):
        query = db.query(getattr(models.Question, field))
    else:
        return []

    # 如果查询标签字段且有题目筛选条件，需要 join
    has_question_filters = any([curriculum, subject, year, season, paper, topic])

    if field in ['tag_category', 'tag_name'] and has_question_filters:
        query = query.join(models.Tag.questions)

    # 应用筛选条件
    if curriculum:
        if field in ['tag_category', 'tag_name']:
            query = query.filter(models.Question.curriculum == curriculum)
        elif hasattr(models.Question, field):
            query = query.filter(models.Question.curriculum == curriculum)

    if subject:
        if field in ['tag_category', 'tag_name']:
            query = query.filter(models.Question.subject == subject)
        elif hasattr(models.Question, field):
            query = query.filter(models.Question.subject == subject)

    if year:
        if field in ['tag_category', 'tag_name']:
            query = query.filter(models.Question.year == year)
        elif hasattr(models.Question, field):
            query = query.filter(models.Question.year == year)

    if season:
        if field in ['tag_category', 'tag_name']:
            query = query.filter(models.Question.season == season)
        elif hasattr(models.Question, field):
            query = query.filter(models.Question.season == season)

    if paper:
        if field in ['tag_category', 'tag_name']:
            query = query.filter(models.Question.paper == paper)
        elif hasattr(models.Question, field):
            query = query.filter(models.Question.paper == paper)

    # Topic 筛选 (用于级联：获取指定 topic 下的 subtopic)
    if topic:
        if isinstance(topic, list) and len(topic) > 0:
            query = query.filter(models.Question.topic.in_(topic))
        elif isinstance(topic, str):
            query = query.filter(models.Question.topic == topic)

    # 标签分类筛选
    if tag_category and field == 'tag_name':
        query = query.filter(models.Tag.category == tag_category)

    # 获取去重结果
    raw_values = [r[0] for r in query.distinct().all() if r[0] is not None]

    # 特殊处理 subtopic：可能是 JSON 数组字符串
    if field == 'subtopic':
        result_set = set()

        # 提取主题前缀列表（用于过滤子主题）
        # 例如：topic = "4. Differentiation" → prefix = "4."
        topic_prefixes = []
        if topic:
            topic_list = topic if isinstance(topic, list) else [topic]
            for t in topic_list:
                # 提取主题编号前缀，如 "4. Differentiation" → "4."
                if t and '.' in t:
                    prefix = t.split('.')[0] + '.'
                    topic_prefixes.append(prefix)

        for value in raw_values:
            # 尝试解析 JSON 数组
            if value.startswith('['):
                try:
                    items = json.loads(value)
                    if isinstance(items, list):
                        result_set.update(items)
                    else:
                        result_set.add(value)
                except json.JSONDecodeError:
                    result_set.add(value)
            else:
                result_set.add(value)

        # 如果有主题前缀过滤，只返回匹配的子主题
        if topic_prefixes:
            result_set = {
                st for st in result_set
                if any(st.startswith(prefix) for prefix in topic_prefixes)
            }
        return list(result_set)

    return raw_values
