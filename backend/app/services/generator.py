# =============================================================================
# Smart Exam Generator Service - 智能组卷服务
# =============================================================================
# 算法流程:
# Step 1: Bucket Allocation - 根据权重分配每个 Subtopic 的题目数量
# Step 2: Difficulty Mapping - 按比例分配难度，随机打散到各槽位
# Step 3: Query & Fallback - 查询数据库，优先保证知识点匹配，难度可回退
# =============================================================================

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Set
import random
import logging

from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models import Question, DifficultyLevel

logger = logging.getLogger(__name__)


# =============================================================================
# Data Classes - 数据结构定义
# =============================================================================
@dataclass
class SubtopicWeight:
    """子知识点权重"""
    subtopic: str
    weight: int  # 0-100


@dataclass
class TopicWeight:
    """知识点权重"""
    topic: str
    weight: int  # 0-100
    subtopics: List[SubtopicWeight] = field(default_factory=list)


@dataclass
class DifficultyRatio:
    """难度比例"""
    easy: int = 30
    medium: int = 50
    hard: int = 20


@dataclass
class GeneratorRequest:
    """组卷请求"""
    subject_code: str
    paper: str
    total_questions: int
    topic_weights: List[TopicWeight]
    difficulty_ratio: DifficultyRatio


@dataclass
class SlotRequirement:
    """槽位需求 - 代表一道题的要求"""
    topic: str
    subtopic: str
    preferred_difficulty: DifficultyLevel
    fallback_difficulties: List[DifficultyLevel]


@dataclass
class GeneratorResult:
    """组卷结果"""
    question_ids: List[int]
    slots_filled: int
    slots_requested: int
    fallback_used: int  # 使用了回退难度的数量
    unfilled_slots: List[Dict]  # 未能填充的槽位


# =============================================================================
# Smart Exam Generator - 核心算法
# =============================================================================
class SmartExamGenerator:
    """
    智能组卷生成器

    核心算法:
    1. 根据 Topic/Subtopic 权重计算每个知识点需要几道题
    2. 根据全局难度比例分配 Easy/Medium/Hard
    3. 查询数据库填充槽位，支持难度回退
    """

    def __init__(self, db: Session):
        self.db = db
        self._used_question_ids: Set[int] = set()

    def generate(self, request: GeneratorRequest) -> GeneratorResult:
        """
        主入口：生成试卷

        Args:
            request: 组卷请求，包含科目、试卷、题数、权重配置

        Returns:
            GeneratorResult: 包含题目ID列表和统计信息
        """
        logger.info(f"开始组卷: subject={request.subject_code}, paper={request.paper}, "
                   f"total={request.total_questions}")

        # Step 1: 计算槽位分配
        slots = self._calculate_slots(request)
        logger.info(f"Step 1 完成: 分配了 {len(slots)} 个槽位")

        # Step 2: 分配难度
        slots_with_difficulty = self._assign_difficulties(slots, request.difficulty_ratio)
        logger.info(f"Step 2 完成: 难度分配完成")

        # Step 3: 查询填充
        result = self._fill_slots(slots_with_difficulty, request.subject_code, request.paper)
        logger.info(f"Step 3 完成: 填充了 {result.slots_filled}/{result.slots_requested} 个槽位, "
                   f"回退使用 {result.fallback_used} 次")

        return result

    # =========================================================================
    # Step 1: Bucket Allocation - 槽位分配
    # =========================================================================
    def _calculate_slots(self, request: GeneratorRequest) -> List[Tuple[str, str]]:
        """
        根据嵌套权重计算题目分配

        算法:
        1. 归一化 Topic 权重
        2. 按比例计算每个 Topic 的题数
        3. 在每个 Topic 内部，归一化 Subtopic 权重并分配

        Returns:
            List of (topic, subtopic) tuples
        """
        slots: List[Tuple[str, str]] = []
        total = request.total_questions

        # 如果没有配置权重，返回空
        if not request.topic_weights:
            return slots

        # 归一化 Topic 权重
        total_topic_weight = sum(tw.weight for tw in request.topic_weights)
        if total_topic_weight == 0:
            return slots

        # 用于处理舍入误差的累积器
        accumulated_questions = 0.0
        allocated_questions = 0

        for i, topic_weight in enumerate(request.topic_weights):
            # 计算该 Topic 应分配的题数（使用累积法处理舍入）
            accumulated_questions += total * topic_weight.weight / total_topic_weight
            topic_questions = round(accumulated_questions) - allocated_questions
            allocated_questions += topic_questions

            if topic_questions <= 0:
                continue

            if not topic_weight.subtopics:
                # 没有指定 Subtopic，全部分配给 Topic 级别
                for _ in range(topic_questions):
                    slots.append((topic_weight.topic, ""))
                continue

            # 归一化 Subtopic 权重
            total_subtopic_weight = sum(sw.weight for sw in topic_weight.subtopics)
            if total_subtopic_weight == 0:
                # 如果 subtopic 权重都是0，平均分配
                for j, sw in enumerate(topic_weight.subtopics):
                    count = topic_questions // len(topic_weight.subtopics)
                    if j < topic_questions % len(topic_weight.subtopics):
                        count += 1
                    for _ in range(count):
                        slots.append((topic_weight.topic, sw.subtopic))
                continue

            # 按权重分配到各 Subtopic
            sub_accumulated = 0.0
            sub_allocated = 0

            for sw in topic_weight.subtopics:
                sub_accumulated += topic_questions * sw.weight / total_subtopic_weight
                subtopic_questions = round(sub_accumulated) - sub_allocated
                sub_allocated += subtopic_questions

                for _ in range(subtopic_questions):
                    slots.append((topic_weight.topic, sw.subtopic))

        # 确保总数正确（处理可能的舍入误差）
        while len(slots) < total and request.topic_weights:
            # 补充到第一个有权重的 topic/subtopic
            tw = request.topic_weights[0]
            subtopic = tw.subtopics[0].subtopic if tw.subtopics else ""
            slots.append((tw.topic, subtopic))

        while len(slots) > total:
            slots.pop()

        return slots

    # =========================================================================
    # Step 2: Difficulty Mapping - 难度映射
    # =========================================================================
    def _assign_difficulties(
        self,
        slots: List[Tuple[str, str]],
        ratio: DifficultyRatio
    ) -> List[SlotRequirement]:
        """
        根据全局难度比例分配每个槽位的难度

        算法:
        1. 根据比例计算 E/M/H 各需要多少
        2. 构建难度列表并随机打乱
        3. 分配给各槽位，并设置回退顺序

        Returns:
            List of SlotRequirement with difficulty info
        """
        n = len(slots)
        if n == 0:
            return []

        # 计算各难度数量
        easy_count = round(n * ratio.easy / 100)
        hard_count = round(n * ratio.hard / 100)
        medium_count = n - easy_count - hard_count

        # 确保不为负
        if medium_count < 0:
            # 如果 easy + hard 超过了总数，按比例缩减
            total_eh = easy_count + hard_count
            easy_count = round(n * easy_count / total_eh)
            hard_count = n - easy_count
            medium_count = 0

        # 构建难度列表
        difficulties = (
            [DifficultyLevel.Easy] * easy_count +
            [DifficultyLevel.Medium] * medium_count +
            [DifficultyLevel.Hard] * hard_count
        )

        # 随机打乱，使难度分布更均匀
        random.shuffle(difficulties)

        # 定义回退顺序：优先相邻难度
        fallback_map = {
            DifficultyLevel.Easy: [DifficultyLevel.Medium, DifficultyLevel.Hard],
            DifficultyLevel.Medium: [DifficultyLevel.Easy, DifficultyLevel.Hard],
            DifficultyLevel.Hard: [DifficultyLevel.Medium, DifficultyLevel.Easy],
        }

        # 构建 SlotRequirement 列表
        return [
            SlotRequirement(
                topic=slots[i][0],
                subtopic=slots[i][1],
                preferred_difficulty=difficulties[i],
                fallback_difficulties=fallback_map[difficulties[i]]
            )
            for i in range(len(slots))
        ]

    # =========================================================================
    # Step 3: Query & Fallback - 查询与回退
    # =========================================================================
    def _fill_slots(
        self,
        slots: List[SlotRequirement],
        subject_code: str,
        paper: str
    ) -> GeneratorResult:
        """
        查询数据库填充每个槽位

        核心逻辑:
        - 优先匹配 (topic, subtopic, difficulty)
        - 如果没有匹配，尝试回退难度
        - 绝不更换 subtopic（内容准确性 > 难度匹配度）
        - 记录已使用的题目ID，防止重复

        Returns:
            GeneratorResult with question IDs and stats
        """
        question_ids: List[int] = []
        fallback_used = 0
        unfilled_slots: List[Dict] = []

        for slot in slots:
            question = self._find_question_for_slot(slot, subject_code, paper)

            if question:
                question_ids.append(question.id)
                self._used_question_ids.add(question.id)

                # 检查是否使用了回退难度
                if question.difficulty != slot.preferred_difficulty:
                    fallback_used += 1
            else:
                unfilled_slots.append({
                    "topic": slot.topic,
                    "subtopic": slot.subtopic,
                    "difficulty": slot.preferred_difficulty.value
                })

        return GeneratorResult(
            question_ids=question_ids,
            slots_filled=len(question_ids),
            slots_requested=len(slots),
            fallback_used=fallback_used,
            unfilled_slots=unfilled_slots
        )

    def _find_question_for_slot(
        self,
        slot: SlotRequirement,
        subject_code: str,
        paper: str
    ) -> Optional[Question]:
        """
        为单个槽位查找匹配的题目

        查找顺序:
        1. 精确匹配 (subtopic + preferred_difficulty)
        2. 尝试回退难度 (subtopic + fallback_difficulties)
        3. 忽略难度 (只匹配 subtopic)
        4. 如果还没有，尝试只匹配 topic

        Returns:
            Question or None
        """
        # 难度尝试顺序
        difficulties_to_try = [slot.preferred_difficulty] + slot.fallback_difficulties

        # 策略 1 & 2: 尝试各难度级别
        for difficulty in difficulties_to_try:
            question = self._query_question(
                subject_code=subject_code,
                paper=paper,
                topic=slot.topic,
                subtopic=slot.subtopic,
                difficulty=difficulty
            )
            if question:
                return question

        # 策略 3: 忽略难度，只匹配 subtopic
        if slot.subtopic:
            question = self._query_question(
                subject_code=subject_code,
                paper=paper,
                topic=slot.topic,
                subtopic=slot.subtopic,
                difficulty=None
            )
            if question:
                return question

        # 策略 4: 只匹配 topic（如果 subtopic 为空或上面都失败）
        question = self._query_question(
            subject_code=subject_code,
            paper=paper,
            topic=slot.topic,
            subtopic=None,
            difficulty=None
        )

        return question

    def _query_question(
        self,
        subject_code: str,
        paper: str,
        topic: str,
        subtopic: Optional[str],
        difficulty: Optional[DifficultyLevel]
    ) -> Optional[Question]:
        """
        执行数据库查询

        Args:
            subject_code: 科目代码
            paper: 试卷编号
            topic: 主题
            subtopic: 子主题（可选）
            difficulty: 难度（可选）

        Returns:
            Random question matching criteria, or None
        """
        query = self.db.query(Question).filter(
            Question.subject_code == subject_code,
            ~Question.id.in_(self._used_question_ids)
        )

        # Paper 过滤 - 支持 "P1" 和 "1" 两种格式
        paper_normalized = paper.replace('P', '').replace('p', '')
        query = query.filter(
            or_(
                Question.paper == paper,
                Question.paper == paper_normalized,
                Question.paper == f"P{paper_normalized}"
            )
        )

        # Topic 过滤
        if topic:
            query = query.filter(Question.topic == topic)

        # Subtopic 过滤 - 支持 JSON 数组格式
        if subtopic:
            query = query.filter(
                or_(
                    Question.subtopic == subtopic,
                    Question.subtopic.like(f'%"{subtopic}"%')  # JSON array format
                )
            )

        # Difficulty 过滤
        if difficulty:
            query = query.filter(Question.difficulty == difficulty)

        # 获取所有匹配结果并随机选一个
        questions = query.all()
        if questions:
            return random.choice(questions)

        return None

    # =========================================================================
    # Reroll - 单题重新抽取
    # =========================================================================
    def reroll_question(
        self,
        question_id: int,
        subject_code: str,
        paper: str,
        topic: str,
        subtopic: str,
        exclude_ids: List[int]
    ) -> Optional[int]:
        """
        替换单道题目

        保持相同的 topic/subtopic，但换一道不同的题

        Args:
            question_id: 当前题目ID
            subject_code: 科目代码
            paper: 试卷编号
            topic: 主题
            subtopic: 子主题
            exclude_ids: 需要排除的题目ID列表

        Returns:
            新题目的ID，如果找不到则返回 None
        """
        # 将排除列表转换为集合并添加当前题目
        excluded = set(exclude_ids)
        excluded.add(question_id)

        query = self.db.query(Question).filter(
            Question.subject_code == subject_code,
            ~Question.id.in_(excluded)
        )

        # Paper 过滤
        paper_normalized = paper.replace('P', '').replace('p', '')
        query = query.filter(
            or_(
                Question.paper == paper,
                Question.paper == paper_normalized,
                Question.paper == f"P{paper_normalized}"
            )
        )

        # Topic 过滤
        if topic:
            query = query.filter(Question.topic == topic)

        # Subtopic 过滤
        if subtopic:
            query = query.filter(
                or_(
                    Question.subtopic == subtopic,
                    Question.subtopic.like(f'%"{subtopic}"%')
                )
            )

        questions = query.all()
        if questions:
            return random.choice(questions).id

        return None
