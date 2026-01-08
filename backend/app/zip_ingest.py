# =============================================================================
# ZIP 导入模块 - ZIP Ingestion Module
# =============================================================================
"""
处理 ExamSlicer 生成的 ZIP 包上传和解析
使用 SyllabusValidator 进行严格的元数据校验
"""

import json
import os
import re
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from . import models
from .config import logger, settings
from .services.validator import SyllabusValidator, ValidationError, get_validator


# =============================================================================
# ZIP 导入器
# =============================================================================
class ZipIngestor:
    """
    处理 ZIP 文件导入

    工作流程:
    1. 解压 ZIP 到临时目录
    2. 读取 config.json 获取元数据
    3. 遍历题目 JSON，使用 SyllabusValidator 严格校验
    4. 保存图片到 static 目录
    5. 写入数据库
    6. 返回处理结果
    """

    def __init__(self, db: Session):
        self.db = db
        self.validator = get_validator()  # 使用新的 SyllabusValidator
        self.temp_dir: Optional[str] = None

        # 处理统计
        self.processed_count = 0
        self.skipped_count = 0
        self.errors: List[Dict[str, str]] = []

    def ingest_zip(self, zip_file_path: str, original_filename: str = None) -> Dict[str, Any]:
        """
        主入口：处理 ZIP 文件

        Args:
            zip_file_path: ZIP 文件的临时路径
            original_filename: 原始上传的文件名

        Returns:
            {
                "success": True/False,
                "processed_count": 15,
                "skipped_count": 2,
                "errors": [{"question": "Q3", "reason": "..."}]
            }
        """
        try:
            # 1. 解压 ZIP
            logger.info(f"Extracting ZIP: {original_filename or zip_file_path}")
            self.temp_dir = self._extract_zip(zip_file_path)

            # 2. 读取 config.json
            config = self._read_config()
            logger.info(f"Config loaded: {config}")

            # 3. 获取科目代码 (用于校验)
            subject = config.get('subject', '')
            subject_code = self.validator.get_subject_code(subject)
            if not subject_code:
                logger.warning(f"No syllabus found for subject: {subject}")

            # 4. 确定 source_filename
            source_filename = self._determine_source_filename(config, original_filename)

            # 5. 遍历并处理每个题目
            questions_dir = os.path.join(self.temp_dir, 'questions')
            answers_dir = os.path.join(self.temp_dir, 'answers')

            if not os.path.exists(questions_dir):
                raise ValueError("ZIP does not contain 'questions' directory")

            # 收集所有题目 JSON 文件
            question_jsons = sorted([
                f for f in os.listdir(questions_dir)
                if f.endswith('.json')
            ], key=self._sort_question_key)

            logger.info(f"Found {len(question_jsons)} question(s) to process")

            # 6. 处理每个题目
            for idx, json_filename in enumerate(question_jsons, start=1):
                question_id = json_filename.replace('.json', '')  # Q1, Q2, ...

                try:
                    self._process_question(
                        question_id=question_id,
                        question_index=idx,
                        questions_dir=questions_dir,
                        answers_dir=answers_dir,
                        config=config,
                        subject_code=subject_code,
                        source_filename=source_filename
                    )
                    self.processed_count += 1

                except ValidationError as e:
                    # 校验失败 - 记录详细错误
                    logger.error(f"Validation failed for {question_id}: {e.message}")
                    self.errors.append({
                        "question": question_id,
                        "reason": e.message,
                        "field": e.field,
                        "value": str(e.value) if e.value else None
                    })
                    self.skipped_count += 1

                except Exception as e:
                    logger.error(f"Error processing {question_id}: {e}")
                    self.errors.append({
                        "question": question_id,
                        "reason": str(e)
                    })
                    self.skipped_count += 1

            # 7. 提交数据库事务
            self.db.commit()
            logger.info(f"Ingestion complete: {self.processed_count} processed, {self.skipped_count} skipped")

            return {
                "success": True,
                "processed_count": self.processed_count,
                "skipped_count": self.skipped_count,
                "errors": self.errors
            }

        except Exception as e:
            logger.error(f"ZIP ingestion failed: {e}", exc_info=True)
            self.db.rollback()
            return {
                "success": False,
                "processed_count": self.processed_count,
                "skipped_count": self.skipped_count,
                "errors": self.errors + [{"question": "GLOBAL", "reason": str(e)}]
            }

        finally:
            # 清理临时目录
            self._cleanup()

    def _extract_zip(self, zip_path: str) -> str:
        """解压 ZIP 文件到临时目录"""
        temp_dir = tempfile.mkdtemp(prefix="haoexam_upload_")

        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(temp_dir)

        return temp_dir

    def _read_config(self) -> Dict[str, Any]:
        """读取 config.json"""
        config_path = os.path.join(self.temp_dir, 'config.json')

        if not os.path.exists(config_path):
            logger.warning("config.json not found, using empty config")
            return {}

        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _determine_source_filename(self, config: Dict, original_filename: str) -> str:
        """
        确定 source_filename
        优先使用 config 中的信息构建标准文件名
        """
        # 尝试从 config 构建标准文件名
        # 格式: 9709_s20_qp_1.pdf
        subject_code = config.get('subject_code', '')
        year = str(config.get('year', ''))[-2:]  # 取后两位
        season = config.get('season', config.get('month', ''))
        paper = config.get('paper_number', '').replace('P', '').replace('p', '')

        if subject_code and year and paper:
            # 标准化 season
            season_map = {'11': 'w', '10': 'w', '5': 's', '6': 's', '3': 'm', '2': 'm'}
            if season in season_map:
                season = season_map[season]
            elif not season:
                season = 's'  # 默认 summer

            return f"{subject_code}_{season}{year}_qp_{paper}.pdf"

        # 回退到原始文件名
        if original_filename:
            return original_filename.replace('.zip', '.pdf')

        # 最后回退
        return f"unknown_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    def _sort_question_key(self, filename: str) -> int:
        """用于排序题目文件的 key 函数"""
        # Q1.json -> 1, Q10.json -> 10
        match = re.search(r'Q(\d+)', filename)
        return int(match.group(1)) if match else 0

    def _process_question(
        self,
        question_id: str,
        question_index: int,
        questions_dir: str,
        answers_dir: str,
        config: Dict,
        subject_code: Optional[str],
        source_filename: str
    ):
        """处理单个题目"""

        # 1. 读取题目 JSON
        json_path = os.path.join(questions_dir, f"{question_id}.json")
        with open(json_path, 'r', encoding='utf-8') as f:
            question_data = json.load(f)

        # 2. 合并 config 和题目数据
        merged_data = {**config, **question_data}

        # 3. 获取图片信息
        images = question_data.get('images', {})
        question_image_name = images.get('question', f"{question_id}.jpg")
        answer_image_name = images.get('answer', f"{question_id}_ans.jpg")

        question_image_src = os.path.join(questions_dir, question_image_name)
        answer_image_src = os.path.join(answers_dir, answer_image_name)

        # 3.5 检查是否有文本答案 (选择题)
        text_answer = question_data.get('answer')  # 例如: "A", "B", "C", "D"

        # 4. 验证图片存在
        if not os.path.exists(question_image_src):
            raise FileNotFoundError(f"Question image not found: {question_image_name}")

        # 答案图片: 如果有文本答案则可选，否则必须存在
        has_answer_image = os.path.exists(answer_image_src)
        if not has_answer_image and not text_answer:
            raise FileNotFoundError(f"Answer image not found: {answer_image_name}")

        # 5. 使用 SyllabusValidator 严格校验元数据
        paper_code = merged_data.get('paper_number', 'P1')
        topic = merged_data.get('topic', '')

        # 兼容新旧格式: subtopics (数组) 或 subtopic (字符串)
        subtopics_list = merged_data.get('subtopics', [])
        if not subtopics_list:
            # 旧格式: 单个 subtopic 字符串
            old_subtopic = merged_data.get('subtopic', '')
            subtopics_list = [old_subtopic] if old_subtopic else []

        # 取第一个作为主 subtopic (用于 Syllabus 校验)
        subtopic = subtopics_list[0] if subtopics_list else ''

        if subject_code:
            # 构建校验数据
            validation_data = {
                'paper_number': paper_code,
                'topic': topic,
                'subtopics': subtopics_list,
            }

            # 调用 validator 进行严格校验
            # 校验失败时会抛出 ValidationError
            self.validator.validate_question_metadata_or_raise(
                validation_data,
                subject=subject_code,
                strict=True  # 严格模式：subtopic 也必须匹配
            )

        # 6. 保存图片到 static 目录
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        q_filename = f"{source_filename.replace('.pdf', '')}_{question_id}_q_{timestamp}.jpg"

        uploads_dir = settings.UPLOADS_DIR
        uploads_dir.mkdir(parents=True, exist_ok=True)

        q_dest = uploads_dir / q_filename
        shutil.copy2(question_image_src, q_dest)

        # 相对路径 (用于数据库存储)
        q_relative_path = f"static/uploads/{q_filename}"

        # 答案图片: 如果存在则复制，否则使用占位符 (文本答案场景)
        if has_answer_image:
            a_filename = f"{source_filename.replace('.pdf', '')}_{question_id}_a_{timestamp}.jpg"
            a_dest = uploads_dir / a_filename
            shutil.copy2(answer_image_src, a_dest)
            a_relative_path = f"static/uploads/{a_filename}"
        else:
            # 文本答案场景: 使用占位符路径
            a_relative_path = "text_answer"

        # 7. 准备数据库字段
        # 处理 year (可能是字符串)
        year_value = merged_data.get('year')
        if isinstance(year_value, str):
            year_value = int(year_value) if year_value.isdigit() else None

        # 处理 difficulty
        difficulty_str = merged_data.get('difficulty', 'Medium')
        try:
            difficulty = models.DifficultyLevel[difficulty_str]
        except KeyError:
            difficulty = models.DifficultyLevel.Medium

        # 处理 subtopic: 多个时存为 JSON 数组，单个时存为字符串
        if len(subtopics_list) > 1:
            subtopic_value = json.dumps(subtopics_list, ensure_ascii=False)
        else:
            subtopic_value = subtopic  # 单个或空时保持字符串

        # 处理 subtopic_details (转为 JSON 字符串)
        # 新格式: 多个subtopic时为数组 [{name:..., details:...}, ...]
        # 旧格式: 单个时为对象或字符串数组
        subtopic_details = merged_data.get('subtopic_details')
        if subtopic_details:
            if isinstance(subtopic_details, (list, dict)):
                subtopic_details = json.dumps(subtopic_details, ensure_ascii=False)
            # 已经是字符串则保持不变

        # 处理 answer_text (选择题文本答案)
        # 优先从题目 JSON 根节点获取，支持 Multiple Choice / Logic 等题型
        answer_text = question_data.get('answer')  # 例如: "D", "A", "B", "C"

        # 处理 season (从 month 转换)
        season = merged_data.get('season', '')
        month = merged_data.get('month', '')
        if not season and month:
            month_to_season = {'11': 'w', '10': 'w', '5': 's', '6': 's', '3': 'm', '2': 'm'}
            season = month_to_season.get(str(month), '')

        # 提取 subject_code (从参数或 merged_data)
        db_subject_code = subject_code or merged_data.get('subject_code', '')

        # 8. 创建数据库记录
        # 标准化 subject 名称 (首字母大写)
        subject_raw = merged_data.get('subject', '')
        subject_normalized = self._normalize_subject(subject_raw)

        db_question = models.Question(
            # 图片路径
            question_image_path=q_relative_path,
            answer_image_path=a_relative_path,

            # 数据溯源
            source_filename=source_filename,

            # 考试元数据
            curriculum=merged_data.get('curriculum'),
            subject=subject_normalized,
            subject_code=db_subject_code,
            year=year_value,
            season=season,
            paper=paper_code,  # 保留原始值: P1, S1, M1 等

            # 题目信息
            question_number=question_id.replace('Q', ''),  # Q1 -> 1
            question_index=question_index,
            difficulty=difficulty,
            question_type=merged_data.get('question_type'),

            # 知识点
            topic=topic,
            subtopic=subtopic_value,  # 多个时为JSON数组，单个时为字符串
            subtopic_details=subtopic_details,

            # 选择题文本答案
            answer_text=answer_text,
        )

        self.db.add(db_question)
        self.db.flush()  # 获取 ID

        logger.debug(f"Created question {question_id} (DB ID: {db_question.id})")

    def _cleanup(self):
        """清理临时目录"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir)
                self.temp_dir = None
            except Exception as e:
                logger.warning(f"Failed to cleanup temp dir: {e}")

    def _normalize_subject(self, subject: str) -> str:
        """
        标准化 subject 名称
        统一为首字母大写格式: math -> Math, PHYSICS -> Physics
        """
        if not subject:
            return subject

        # 标准化映射表
        subject_mapping = {
            'math': 'Math',
            'mathematics': 'Math',
            'physics': 'Physics',
            'chemistry': 'Chemistry',
            'economics': 'Economics',
            'biology': 'Biology',
        }

        subject_lower = subject.lower().strip()

        # 先检查映射表
        if subject_lower in subject_mapping:
            return subject_mapping[subject_lower]

        # 默认: 首字母大写
        return subject.strip().title()
