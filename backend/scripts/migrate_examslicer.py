"""
Database migration script to add ExamSlicer fields to the questions table.
Adds: paper_number, question_type, topic, subtopic
"""

from sqlalchemy import create_engine, text
import os
import sys

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def get_db_path():
    """Find the database file"""
    # Try current directory first
    if os.path.exists("sql_app.db"):
        return "sql_app.db"
    
    # Try parent directory (if running from scripts/)
    parent_db = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sql_app.db")
    if os.path.exists(parent_db):
        return parent_db
    
    # Try workspace root
    workspace_root = "/Users/haozhang/Desktop/HaoExam-main/sql_app.db"
    if os.path.exists(workspace_root):
        return workspace_root
    
    return None

def migrate_database():
    db_path = get_db_path()
    
    if not db_path:
        print("❌ Error: Could not find sql_app.db database file")
        print("Please run this script from the HaoExam-main directory or backend directory")
        return False
    
    print(f"✅ Found database at: {db_path}")
    
    engine = create_engine(f'sqlite:///{db_path}')
    
    # List of new columns to add
    new_columns = [
        ("paper_number", "VARCHAR"),
        ("question_type", "VARCHAR"),
        ("topic", "VARCHAR"),
        ("subtopic", "VARCHAR")
    ]
    
    with engine.connect() as conn:
        try:
            # Get existing columns
            result = conn.execute(text("PRAGMA table_info(questions)")).fetchall()
            existing_columns = [row[1] for row in result]
            
            print("\n📋 Current columns in 'questions' table:")
            for col in existing_columns:
                print(f"  - {col}")
            
            # Add new columns if they don't exist
            added_count = 0
            for col_name, col_type in new_columns:
                if col_name in existing_columns:
                    print(f"\n⏭️  Column '{col_name}' already exists, skipping...")
                else:
                    print(f"\n➕ Adding column '{col_name}' ({col_type})...")
                    conn.execute(text(f"ALTER TABLE questions ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    added_count += 1
                    print(f"✅ Successfully added '{col_name}'")
            
            # Create indexes for performance
            print("\n📊 Creating indexes for new columns...")
            index_columns = ["paper_number", "topic"]
            for col_name in index_columns:
                if col_name not in existing_columns:  # Only if column was just added
                    try:
                        index_name = f"ix_questions_{col_name}"
                        conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON questions({col_name})"))
                        conn.commit()
                        print(f"✅ Created index on '{col_name}'")
                    except Exception as e:
                        print(f"⚠️  Note: Could not create index on '{col_name}': {e}")
            
            print(f"\n{'='*60}")
            print(f"✅ Migration completed successfully!")
            print(f"   - {added_count} new column(s) added")
            print(f"   - Indexes created for searchable fields")
            print(f"{'='*60}\n")
            
            return True
            
        except Exception as e:
            print(f"\n❌ Error during migration: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    print("="*60)
    print("🔄 ExamSlicer Database Migration")
    print("="*60)
    success = migrate_database()
    sys.exit(0 if success else 1)
