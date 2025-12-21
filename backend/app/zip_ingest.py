"""
ZIP Ingestion Module - Handles ZIP file upload and batch import
"""

import os
import json
import shutil
import zipfile
import tempfile
from typing import Optional, Dict, Any
from datetime import datetime
from pathlib import Path

from app.database import SessionLocal
from app import models


class ZipIngestor:
    """Handles ZIP file ingestion for ExamSlicer data"""
    
    def __init__(self):
        self.db = SessionLocal()
        self.stats = {
            "total_questions": 0,
            "created": 0,
            "errors": 0,
            "tags_created": 0
        }
        self.temp_dir = None
    
    def __del__(self):
        if self.db:
            self.db.close()
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def find_or_create_tag(self, name: str, category: str, paper: Optional[str] = None, subject: Optional[str] = None):
        """Find existing tag or create new one"""
        tag = self.db.query(models.Tag).filter(
            models.Tag.name == name,
            models.Tag.category == category,
            models.Tag.paper == paper,
            models.Tag.subject == subject
        ).first()
        
        if not tag:
            tag = models.Tag(
                name=name,
                category=category,
                paper=paper,
                subject=subject
            )
            self.db.add(tag)
            self.db.flush()
            self.stats["tags_created"] += 1
        
        return tag
    
    def copy_image_to_static(self, source_path: str, question_id: int, image_type: str = "question") -> str:
        """Copy image file to static directory"""
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Image not found: {source_path}")
        
        static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
        os.makedirs(static_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = os.path.splitext(source_path)[1]
        filename = f"q{question_id}_{image_type}_{timestamp}{ext}"
        dest_path = os.path.join(static_dir, filename)
        relative_path = f"static/{filename}"
        
        shutil.copy2(source_path, dest_path)
        return relative_path
    
    def extract_zip(self, zip_path: str) -> str:
        """Extract ZIP file to temporary directory"""
        self.temp_dir = tempfile.mkdtemp(prefix="examslicer_")
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(self.temp_dir)
        
        return self.temp_dir
    
    def read_config(self, extract_dir: str) -> Dict[str, Any]:
        """Read config.json for batch metadata"""
        config_path = os.path.join(extract_dir, "config.json")
        
        if not os.path.exists(config_path):
            # Try to find config.json in subdirectories
            for root, dirs, files in os.walk(extract_dir):
                if "config.json" in files:
                    config_path = os.path.join(root, "config.json")
                    break
        
        if not os.path.exists(config_path):
            print("⚠️  Warning: config.json not found, using default values")
            return {}
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def ingest_question(self, json_path: str, base_dir: str, config_data: Dict[str, Any]):
        """Ingest a single question from JSON and images"""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            question_num = os.path.basename(json_path).replace('.json', '')
            
            # Get image paths
            if "images" in metadata:
                question_image_name = metadata["images"].get("question", f"{question_num}.jpg")
                answer_image_name = metadata["images"].get("answer", f"{question_num}_ans.jpg")
            else:
                question_image_name = f"{question_num}.jpg"
                answer_image_name = f"{question_num}_ans.jpg"
            
            question_image_path = os.path.join(base_dir, question_image_name)
            answer_image_path = os.path.join(base_dir, answer_image_name)
            
            # Check if question image exists
            if not os.path.exists(question_image_path):
                # Try finding in subdirectories
                for root, dirs, files in os.walk(base_dir):
                    if question_image_name in files:
                        question_image_path = os.path.join(root, question_image_name)
                        break
                
                if not os.path.exists(question_image_path):
                    raise FileNotFoundError(f"Question image not found: {question_image_name}")
            
            # Check if answer image exists
            if not os.path.exists(answer_image_path):
                for root, dirs, files in os.walk(base_dir):
                    if answer_image_name in files:
                        answer_image_path = os.path.join(root, answer_image_name)
                        break
            
            # Merge config data with question metadata
            full_metadata = {**config_data, **metadata}
            
            # Create temporary question ID
            temp_id = int(datetime.now().timestamp() * 1000) % 100000
            
            # Convert subtopic_details list to JSON string if present
            subtopic_details_str = None
            if full_metadata.get("subtopic_details"):
                subtopic_details_str = json.dumps(full_metadata["subtopic_details"])
            
            # Create Question object
            db_question = models.Question(
                question_image_path="temp",
                answer_image_path="temp",
                curriculum=full_metadata.get("curriculum"),
                subject=full_metadata.get("subject"),
                year=full_metadata.get("year"),
                month=full_metadata.get("month"),
                season=full_metadata.get("season"),
                question_number=question_num,
                difficulty=models.DifficultyLevel[full_metadata.get("difficulty", "Medium")],
                paper_number=full_metadata.get("paper_number"),
                question_type=full_metadata.get("question_type"),
                topic=full_metadata.get("topic"),
                subtopic=full_metadata.get("subtopic"),
                subtopic_details=subtopic_details_str
            )
            
            # Create tags
            if full_metadata.get("topic"):
                topic_tag = self.find_or_create_tag(
                    name=full_metadata["topic"],
                    category="Topic",
                    paper=full_metadata.get("paper_number"),
                    subject=full_metadata.get("subject")
                )
                db_question.tags.append(topic_tag)
            
            if full_metadata.get("subtopic"):
                subtopic_tag = self.find_or_create_tag(
                    name=full_metadata["subtopic"],
                    category="Subtopic",
                    paper=full_metadata.get("paper_number"),
                    subject=full_metadata.get("subject")
                )
                db_question.tags.append(subtopic_tag)
            
            # Add to database to get ID
            self.db.add(db_question)
            self.db.flush()
            
            # Copy images with actual database ID
            q_img_path = self.copy_image_to_static(question_image_path, db_question.id, "question")
            a_img_path = self.copy_image_to_static(answer_image_path, db_question.id, "answer") if os.path.exists(answer_image_path) else ""
            
            # Update paths
            db_question.question_image_path = q_img_path
            db_question.answer_image_path = a_img_path
            
            self.stats["created"] += 1
            self.stats["total_questions"] += 1
            
            print(f"  ✅ Created question {question_num} (ID: {db_question.id})")
            
        except Exception as e:
            print(f"  ❌ Error processing {json_path}: {e}")
            self.stats["errors"] += 1
            raise
    
    def ingest_zip(self, zip_path: str) -> Dict[str, Any]:
        """Main ingestion method for ZIP file"""
        try:
            print(f"\n📦 Extracting ZIP file...")
            extract_dir = self.extract_zip(zip_path)
            print(f"  ✅ Extracted to: {extract_dir}")
            
            print(f"\n📄 Reading config.json...")
            config_data = self.read_config(extract_dir)
            print(f"  Curriculum: {config_data.get('curriculum', 'N/A')}")
            print(f"  Subject: {config_data.get('subject', 'N/A')}")
            print(f"  Year: {config_data.get('year', 'N/A')}")
            
            print(f"\n🔍 Scanning for JSON files...")
            json_files = []
            for root, dirs, files in os.walk(extract_dir):
                for file in files:
                    if file.endswith('.json') and file.startswith('Q') and file != 'config.json':
                        json_files.append(os.path.join(root, file))
            
            json_files.sort()
            print(f"  Found {len(json_files)} question(s)")
            
            if not json_files:
                raise ValueError("No question JSON files found in ZIP")
            
            print(f"\n📝 Processing questions...")
            for json_path in json_files:
                self.ingest_question(json_path, os.path.dirname(json_path), config_data)
            
            # Commit all changes
            self.db.commit()
            print(f"\n  💾 Changes committed to database")
            
            return {
                "success": True,
                "stats": self.stats
            }
            
        except Exception as e:
            print(f"\n❌ Error during ingestion: {e}")
            if self.db:
                self.db.rollback()
            raise
        finally:
            # Cleanup temp directory
            if self.temp_dir and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                self.temp_dir = None
