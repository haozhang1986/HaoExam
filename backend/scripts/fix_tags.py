from sqlalchemy import create_engine, text
import os

db_path = "sql_app.db"
if not os.path.exists(db_path):
    print("DB not found")
    exit(1)

engine = create_engine(f'sqlite:///{db_path}')

# Use engine.begin() for automatic transaction management
with engine.begin() as conn:
    print("Beginning Tag Table Migration...")
    
    # Enable foreign keys to ensure we do this safely (or disable if we want to bypass)
    conn.execute(text("PRAGMA foreign_keys=OFF"))
    
    try:
        # Pre-cleanup: drop tags_old if exists from failed runs
        conn.execute(text("DROP TABLE IF EXISTS tags_old"))

        # 1. Rename old table
        print("Renaming old table...")
        conn.execute(text("ALTER TABLE tags RENAME TO tags_old"))
        
        # 2. Create new table
        # We assume the schema: id, name, category, plus indexes and constraints
        print("Creating new table...")
        conn.execute(text("""
            CREATE TABLE tags (
                id INTEGER PRIMARY KEY,
                name VARCHAR,
                category VARCHAR,
                CONSTRAINT uq_tag_name_category UNIQUE (name, category)
            )
        """))
        
        # 3. Drop conflicting indices from old table
        conn.execute(text("DROP INDEX IF EXISTS ix_tags_id"))
        conn.execute(text("DROP INDEX IF EXISTS ix_tags_name"))

        # 4. Create new indices
        conn.execute(text("CREATE INDEX ix_tags_id ON tags (id)"))
        conn.execute(text("CREATE INDEX ix_tags_name ON tags (name)"))
        
        # 4. Copy Data
        print("Copying data...")
        conn.execute(text("INSERT INTO tags (id, name, category) SELECT id, name, category FROM tags_old"))
        
        # 5. Drop old table
        print("Dropping old table...")
        conn.execute(text("DROP TABLE tags_old"))
        
        print("Migration successful!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        # Transaction will auto-rollback on exception due to context manager
        raise e

    # Re-enable FK
    conn.execute(text("PRAGMA foreign_keys=ON"))
