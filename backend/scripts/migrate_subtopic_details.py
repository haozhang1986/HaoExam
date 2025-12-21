"""
Migration to add subtopic_details field to questions table
"""

from sqlalchemy import create_engine, text
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_db_path():
    """Find the database file"""
    if os.path.exists("sql_app.db"):
        return "sql_app.db"
    
    parent_db = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sql_app.db")
    if os.path.exists(parent_db):
        return parent_db
    
    workspace_root = "/Users/haozhang/Desktop/HaoExam-main/sql_app.db"
    if os.path.exists(workspace_root):
        return workspace_root
    
    return None

def migrate():
    db_path = get_db_path()
    
    if not db_path:
        print("❌ Error: Could not find sql_app.db database file")
        return False
    
    print(f"✅ Found database at: {db_path}")
    
    engine = create_engine(f'sqlite:///{db_path}')
    
    with engine.connect() as conn:
        try:
            result = conn.execute(text("PRAGMA table_info(questions)")).fetchall()
            existing_columns = [row[1] for row in result]
            
            if 'subtopic_details' in existing_columns:
                print("⏭️  Column 'subtopic_details' already exists, skipping...")
                return True
            
            print("➕ Adding column 'subtopic_details'...")
            conn.execute(text("ALTER TABLE questions ADD COLUMN subtopic_details VARCHAR"))
            conn.commit()
            print("✅ Successfully added 'subtopic_details' column")
            
            return True
            
        except Exception as e:
            print(f"❌ Error during migration: {e}")
            return False

if __name__ == "__main__":
    print("="*60)
    print("🔄 Adding subtopic_details Field Migration")
    print("="*60)
    success = migrate()
    sys.exit(0 if success else 1)
