"""
Bulk ingestion script for ExamSlicer output.
Processes folders containing Qx.jpg, Qx.json, and Qx_ans.jpg files.
"""

import os
import sys
import json
import shutil
import argparse
from datetime import datetime
from pathlib import Path

# Add parent directory to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app import models, schemas

class BulkIngestor:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.db = SessionLocal() if not dry_run else None
        self.stats = {
            "total_questions": 0,
            "created": 0,
            "skipped": 0,
            "errors": 0,
            "tags_created": 0
        }
    
    def __del__(self):
        if self.db:
            self.db.close()
    
    def find_or_create_tag(self, name, category, paper=None, subject=None):
        """Find existing tag or create new one"""
        if self.dry_run:
            print(f"      [DRY-RUN] Would find/create tag: {name} ({category})")
            return None
        
        # Query for existing tag
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
            print(f"      ✅ Created new tag: {name} ({category})")
        
        return tag
    
    def copy_image_to_static(self, source_path, question_id,  image_type="question"):
        """Copy image file to static directory with unique name"""
        if not os.path.exists(source_path):
            print(f"      ⚠️  Warning: Image not found: {source_path}")
            return None
        
        # Create static directory if it doesn't exist
        static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
        os.makedirs(static_dir, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = os.path.splitext(source_path)[1]
        filename = f"q{question_id}_{image_type}_{timestamp}{ext}"
        dest_path = os.path.join(static_dir, filename)
        relative_path = f"static/{filename}"
        
        if self.dry_run:
            print(f"      [DRY-RUN] Would copy {os.path.basename(source_path)} -> {relative_path}")
            return relative_path
        
        shutil.copy2(source_path, dest_path)
        return relative_path
    
    def ingest_question(self, json_path, question_dir, answer_dir, default_metadata=None):
        """Ingest a single question from JSON and images"""
        try:
            # Read JSON metadata
            with open(json_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            question_num = os.path.basename(json_path).replace('.json', '')
            print(f"\n  📝 Processing {question_num}...")
            
            # Get image paths from JSON or construct them
            if "images" in metadata:
                question_image_name = metadata["images"].get("question", f"{question_num}.jpg")
                answer_image_name = metadata["images"].get("answer", f"{question_num}_ans.jpg")
            else:
                question_image_name = f"{question_num}.jpg"
                answer_image_name = f"{question_num}_ans.jpg"
            
            question_image_path = os.path.join(question_dir, question_image_name)
            answer_image_path = os.path.join(answer_dir, answer_image_name)
            
            # Check if images exist
            if not os.path.exists(question_image_path):
                print(f"    ❌ Error: Question image not found: {question_image_path}")
                self.stats["errors"] += 1
                return
            
            if not os.path.exists(answer_image_path):
                print(f"    ⚠️  Warning: Answer image not found: {answer_image_path}")
                # Continue anyway, answer might be optional
            
            # Merge default metadata with question metadata
            full_metadata = {**(default_metadata or {}), **metadata}
            
            # Create temporary question ID for file naming (use timestamp)
            temp_id = int(datetime.now().timestamp() * 1000) % 100000
            
            # Copy images to static directory
            q_img_path = self.copy_image_to_static(question_image_path, temp_id, "question")
            a_img_path = self.copy_image_to_static(answer_image_path, temp_id, "answer") if os.path.exists(answer_image_path) else None
            
            if self.dry_run:
                print(f"    [DRY-RUN] Would create question with:")
                print(f"      - topic: {full_metadata.get('topic')}")
                print(f"      - subtopic: {full_metadata.get('subtopic')}")
                print(f"      - difficulty: {full_metadata.get('difficulty')}")
                print(f"      - paper_number: {full_metadata.get('paper_number')}")
                self.stats["total_questions"] += 1
                return
            
            # Create Question object
            db_question = models.Question(
                question_image_path=q_img_path,
                answer_image_path=a_img_path or "",  # Use empty string if no answer
                curriculum=full_metadata.get("curriculum"),
                subject=full_metadata.get("subject"),
                year=full_metadata.get("year"),
                month=full_metadata.get("month"),
                season=full_metadata.get("season"),
                question_number=question_num,
                difficulty=models.DifficultyLevel[full_metadata.get("difficulty", "Medium")],
                # ExamSlicer fields
                paper_number=full_metadata.get("paper_number"),
                question_type=full_metadata.get("question_type"),
                topic=full_metadata.get("topic"),
                subtopic=full_metadata.get("subtopic")
            )
            
            # Create tags from topic and subtopic
            if full_metadata.get("topic"):
                topic_tag = self.find_or_create_tag(
                    name=full_metadata["topic"],
                    category="Topic",
                    paper=full_metadata.get("paper_number"),
                    subject=full_metadata.get("subject")
                )
                if topic_tag:
                    db_question.tags.append(topic_tag)
            
            if full_metadata.get("subtopic"):
                subtopic_tag = self.find_or_create_tag(
                    name=full_metadata["subtopic"],
                    category="Subtopic",
                    paper=full_metadata.get("paper_number"),
                    subject=full_metadata.get("subject")
                )
                if subtopic_tag:
                    db_question.tags.append(subtopic_tag)
            
            # Add to database
            self.db.add(db_question)
            self.db.flush()
            
            # Rename image files with actual database ID
            if q_img_path:
                new_q_path = q_img_path.replace(f"q{temp_id}_", f"q{db_question.id}_")
                old_full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), q_img_path)
                new_full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), new_q_path)
                if os.path.exists(old_full_path):
                    os.rename(old_full_path, new_full_path)
                    db_question.question_image_path = new_q_path
            
            if a_img_path:
                new_a_path = a_img_path.replace(f"q{temp_id}_", f"q{db_question.id}_")
                old_full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), a_img_path)
                new_full_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), new_a_path)
                if os.path.exists(old_full_path):
                    os.rename(old_full_path, new_full_path)
                    db_question.answer_image_path = new_a_path
            
            self.stats["created"] += 1
            self.stats["total_questions"] += 1
            print(f"    ✅ Created question ID: {db_question.id}")
            
        except Exception as e:
            print(f"    ❌ Error processing {json_path}: {e}")
            import traceback
            traceback.print_exc()
            self.stats["errors"] += 1
    
    def ingest_folder(self, question_dir, answer_dir, default_metadata=None):
        """Ingest all questions from a folder"""
        print(f"\n📂 Scanning directories:")
        print(f"  Questions: {question_dir}")
        print(f"  Answers:   {answer_dir}")
        
        # Find all JSON files
        json_files = sorted([f for f in os.listdir(question_dir) if f.endswith('.json')])
        
        if not json_files:
            print("  ❌ No JSON files found!")
            return
        
        print(f"\n  Found {len(json_files)} question(s) to process")
        
        for json_file in json_files:
            json_path = os.path.join(question_dir, json_file)
            self.ingest_question(json_path, question_dir, answer_dir, default_metadata)
        
        # Commit all changes
        if not self.dry_run:
            try:
                self.db.commit()
                print("\n  💾 Changes committed to database")
            except Exception as e:
                print(f"\n  ❌ Error committing to database: {e}")
                self.db.rollback()
                raise
    
    def print_stats(self):
        """Print ingestion statistics"""
        print("\n" + "="*60)
        print("📊 INGESTION SUMMARY")
        print("="*60)
        print(f"Total questions processed: {self.stats['total_questions']}")
        print(f"✅ Successfully created:    {self.stats['created']}")
        print(f"⏭️  Skipped:                {self.stats['skipped']}")
        print(f"❌ Errors:                 {self.stats['errors']}")
        print(f"🏷️  New tags created:       {self.stats['tags_created']}")
        print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description='Bulk ingest ExamSlicer output into HaoExam database')
    parser.add_argument('--question-dir', required=True, help='Directory containing question images and JSON files')
    parser.add_argument('--answer-dir', required=True, help='Directory containing answer images')
    parser.add_argument('--subject', default='Mathematics', help='Subject name (default: Mathematics)')
    parser.add_argument('--curriculum', default='Cambridge International AS & A Level', help='Curriculum name')
    parser.add_argument('--year', type=int, help='Exam year')
    parser.add_argument('--month', help='Exam month')
    parser.add_argument('--dry-run', action='store_true', help='Run without making database changes')
    
    args = parser.parse_args()
    
    # Validate directories
    if not os.path.isdir(args.question_dir):
        print(f"❌ Error: Question directory not found: {args.question_dir}")
        sys.exit(1)
    
    if not os.path.isdir(args.answer_dir):
        print(f"❌ Error: Answer directory not found: {args.answer_dir}")
        sys.exit(1)
    
    # Prepare default metadata
    default_metadata = {
        "subject": args.subject,
        "curriculum": args.curriculum,
        "year": args.year,
        "month": args.month
    }
    
    print("="*60)
    print("🚀 ExamSlicer Bulk Ingestion")
    print("="*60)
    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made")
        print("="*60)
    
    # Create ingestor and run
    ingestor = BulkIngestor(dry_run=args.dry_run)
    
    try:
        ingestor.ingest_folder(args.question_dir, args.answer_dir, default_metadata)
        ingestor.print_stats()
        
        if args.dry_run:
            print("✅ Dry run completed. Use without --dry-run to apply changes.\n")
        else:
            print("✅ Ingestion completed successfully!\n")
        
    except Exception as e:
        print(f"\n❌ Fatal error during ingestion: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
