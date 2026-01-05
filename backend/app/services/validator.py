# =============================================================================
# Syllabus Validator - 数据校验服务
# =============================================================================
"""
基于 Syllabus JSON 的严格数据校验
确保所有上传的题目元数据符合 Syllabus 标准
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from ..config import logger, settings


class ValidationError(Exception):
    """校验失败异常，包含详细的错误信息"""

    def __init__(self, message: str, field: str = None, value: Any = None):
        self.message = message
        self.field = field
        self.value = value
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": self.message,
            "field": self.field,
            "value": self.value
        }


class SyllabusValidator:
    """
    Syllabus 校验器

    启动时加载所有 Syllabus JSON 到内存，提供严格的元数据校验功能。
    作为数据入库的"守门人"，确保所有题目的 Paper/Topic/Subtopic 都符合 Syllabus 定义。
    """

    def __init__(self, syllabus_dir: Path = None):
        self.syllabus_dir = syllabus_dir or (settings.BASE_DIR / "syllabus")

        # 主数据结构: subject_code -> syllabus data
        self.syllabi: Dict[str, Dict] = {}

        # 快速查找索引 (用于 O(1) 校验)
        # subject_code -> {paper_code: {topic_name: {subtopic_names}}}
        self._index: Dict[str, Dict[str, Dict[str, Set[str]]]] = {}

        # 科目名称到代码的映射
        self._subject_mapping = {
            'math': '9709',
            'mathematics': '9709',
            'physics': '9702',
            'chemistry': '9701',
            'economics': '9708',
        }

        # 加载所有 Syllabus
        self._load_all_syllabi()

    def _load_all_syllabi(self):
        """加载所有 Syllabus JSON 文件并建立索引"""
        if not self.syllabus_dir.exists():
            logger.warning(f"Syllabus directory not found: {self.syllabus_dir}")
            return

        for file_path in self.syllabus_dir.glob("*.json"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                # 从文件名或 meta 中提取 subject_code
                # 文件名格式: CIE_9709_MATH.json
                filename = file_path.stem  # CIE_9709_MATH
                parts = filename.split('_')
                if len(parts) >= 2:
                    subject_code = parts[1]  # 9709
                else:
                    subject_code = data.get('meta', {}).get('syllabus_code', filename)

                self.syllabi[subject_code] = data
                self._build_index(subject_code, data)

                logger.info(f"Loaded syllabus: {filename} (code: {subject_code})")

            except Exception as e:
                logger.error(f"Failed to load syllabus {file_path}: {e}")

    def _build_index(self, subject_code: str, syllabus: Dict):
        """为单个 Syllabus 建立快速查找索引"""
        self._index[subject_code] = {}

        for paper in syllabus.get('papers', []):
            paper_code = paper.get('paper_code', '').upper()
            self._index[subject_code][paper_code] = {}

            for topic in paper.get('topics', []):
                topic_name = topic.get('name', '')
                topic_normalized = self._normalize_name(topic_name)

                # 存储: normalized_topic_name -> {normalized_subtopic_names}
                subtopics = set()
                for subtopic in topic.get('subtopics', []):
                    subtopic_name = subtopic.get('name', '')
                    subtopics.add(self._normalize_name(subtopic_name))

                self._index[subject_code][paper_code][topic_normalized] = {
                    'original_name': topic_name,
                    'subtopics': subtopics,
                    'subtopic_originals': {
                        self._normalize_name(s.get('name', '')): s.get('name', '')
                        for s in topic.get('subtopics', [])
                    }
                }

    def _normalize_name(self, name: str) -> str:
        """标准化名称用于比较（去除前导数字、空格、标点、大小写）"""
        if not name:
            return ""
        # 去除前导数字和点号 (如 "1. Quadratics" -> "Quadratics")
        name = re.sub(r'^\d+\.?\s*', '', name)
        # 转小写，去除多余空格
        return name.lower().strip()

    def get_subject_code(self, subject: str) -> Optional[str]:
        """
        根据科目名称获取科目代码
        支持直接代码 ("9709") 或名称 ("math", "Mathematics")
        """
        # 直接是代码
        if subject in self.syllabi:
            return subject

        # 尝试名称映射
        subject_lower = subject.lower()
        return self._subject_mapping.get(subject_lower)

    def get_valid_papers(self, subject_code: str) -> List[str]:
        """获取指定科目的所有有效 Paper 代码"""
        if subject_code not in self._index:
            return []
        return list(self._index[subject_code].keys())

    def get_valid_topics(self, subject_code: str, paper_code: str) -> List[str]:
        """获取指定 Paper 下的所有有效 Topic 名称"""
        if subject_code not in self._index:
            return []
        paper_data = self._index[subject_code].get(paper_code.upper(), {})
        return [data['original_name'] for data in paper_data.values()]

    def get_valid_subtopics(self, subject_code: str, paper_code: str, topic: str) -> List[str]:
        """获取指定 Topic 下的所有有效 Subtopic 名称"""
        if subject_code not in self._index:
            return []
        paper_data = self._index[subject_code].get(paper_code.upper(), {})
        topic_normalized = self._normalize_name(topic)
        topic_data = paper_data.get(topic_normalized)
        if not topic_data:
            return []
        return list(topic_data.get('subtopic_originals', {}).values())

    def get_all_subtopics_by_paper(self, subject_code: str, paper_code: str) -> Tuple[Set[str], List[str]]:
        """
        获取指定 Paper 下所有 Topic 的全部 Subtopic

        Returns:
            (normalized_subtopics_set, original_subtopics_list)
            - normalized_subtopics_set: 用于快速校验的标准化名称集合
            - original_subtopics_list: 原始名称列表，用于错误提示
        """
        if subject_code not in self._index:
            return set(), []

        paper_data = self._index[subject_code].get(paper_code.upper(), {})
        normalized_set: Set[str] = set()
        originals_list: List[str] = []

        for topic_data in paper_data.values():
            # 收集所有 subtopic 的标准化名称
            normalized_set.update(topic_data.get('subtopics', set()))
            # 收集所有 subtopic 的原始名称
            originals_list.extend(topic_data.get('subtopic_originals', {}).values())

        return normalized_set, originals_list

    def validate_question_metadata(
        self,
        question_data: Dict[str, Any],
        subject: str = None,
        strict: bool = True
    ) -> Tuple[bool, Optional[ValidationError]]:
        """
        校验单个题目的元数据

        Args:
            question_data: 题目数据字典，包含 paper_number, topic, subtopics 等
            subject: 科目名称或代码 (如果不在 question_data 中)
            strict: 严格模式，如果 subtopic 不匹配也会报错

        Returns:
            (is_valid, error) - 如果校验通过返回 (True, None)，否则返回 (False, ValidationError)

        Raises:
            ValidationError: 如果校验失败且需要抛出异常
        """
        # 1. 确定科目代码
        subject = subject or question_data.get('subject', '')
        subject_code = self.get_subject_code(subject)

        if not subject_code:
            return False, ValidationError(
                f"Unknown subject: '{subject}'. Valid subjects: {list(self.syllabi.keys())}",
                field="subject",
                value=subject
            )

        if subject_code not in self._index:
            return False, ValidationError(
                f"No syllabus loaded for subject code: '{subject_code}'",
                field="subject_code",
                value=subject_code
            )

        # 2. 校验 Paper
        paper_code = question_data.get('paper_number', question_data.get('paper', ''))
        if not paper_code:
            return False, ValidationError(
                "Missing paper_number/paper field",
                field="paper_number",
                value=None
            )

        paper_code_upper = paper_code.upper()
        valid_papers = self.get_valid_papers(subject_code)

        if paper_code_upper not in self._index[subject_code]:
            return False, ValidationError(
                f"Invalid paper '{paper_code}' for subject {subject_code}. "
                f"Valid papers: {valid_papers}",
                field="paper_number",
                value=paper_code
            )

        # 3. 校验 Topic
        topic = question_data.get('topic', '')
        if not topic:
            # Topic 为空时跳过校验 (允许空 topic)
            return True, None

        topic_normalized = self._normalize_name(topic)
        paper_data = self._index[subject_code][paper_code_upper]

        if topic_normalized not in paper_data:
            valid_topics = self.get_valid_topics(subject_code, paper_code_upper)
            return False, ValidationError(
                f"Invalid topic '{topic}' for paper {paper_code}. "
                f"Valid topics: {valid_topics[:5]}{'...' if len(valid_topics) > 5 else ''}",
                field="topic",
                value=topic
            )

        # 4. 校验 Subtopics
        # 支持多种格式: subtopics (数组), subtopic (字符串)
        subtopics_list = question_data.get('subtopics', [])
        if not subtopics_list:
            old_subtopic = question_data.get('subtopic', '')
            subtopics_list = [old_subtopic] if old_subtopic else []

        if not subtopics_list or not strict:
            # 无 subtopic 或非严格模式，跳过校验
            return True, None

        # 注意: subtopic 可能来自同一 Paper 下的任意 Topic，不仅仅是主 topic
        # 因此需要获取该 Paper 下所有 Topic 的全部 subtopics
        valid_subtopics_normalized, valid_subtopics_originals = self.get_all_subtopics_by_paper(
            subject_code, paper_code_upper
        )

        for subtopic in subtopics_list:
            if not subtopic:
                continue
            subtopic_normalized = self._normalize_name(subtopic)
            if subtopic_normalized not in valid_subtopics_normalized:
                return False, ValidationError(
                    f"Invalid subtopic '{subtopic}' for paper {paper_code}. "
                    f"Valid subtopics: {valid_subtopics_originals[:5]}{'...' if len(valid_subtopics_originals) > 5 else ''}",
                    field="subtopic",
                    value=subtopic
                )

        return True, None

    def validate_question_metadata_or_raise(
        self,
        question_data: Dict[str, Any],
        subject: str = None,
        strict: bool = True
    ):
        """
        校验题目元数据，失败时抛出异常

        这是 validate_question_metadata 的便捷版本，直接抛出异常而不是返回元组
        """
        is_valid, error = self.validate_question_metadata(question_data, subject, strict)
        if not is_valid:
            raise error


# 全局单例 (延迟初始化)
_validator_instance: Optional[SyllabusValidator] = None


def get_validator() -> SyllabusValidator:
    """获取全局 SyllabusValidator 单例"""
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = SyllabusValidator()
    return _validator_instance
