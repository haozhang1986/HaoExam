from sqlalchemy import create_engine, text
import os

db_path = "backend/sql_app.db"
if not os.path.exists(db_path):
    print("DB not found at backend/sql_app.db, looking in current dir...")
    db_path = "sql_app.db"

engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as conn:
    print("--- Checking Indexes ---")
    result = conn.execute(text("PRAGMA index_list('tags')"))
    for row in result:
        print(f"Index: {row}")
        # row: (seq, name, unique, origin, partial)
        # unique=1 means unique.

    print("\n--- Testing Insertion ---")
    # Try to insert two tags with SAME name but DIFFERENT category.
    # This checks if Name is Unique.
    
    # Clean up test data first
    conn.execute(text("DELETE FROM tags WHERE name = 'TEST_UNIQUE_CHK'"))
    conn.commit()
    
    try:
        print("Inserting Tag 1: 'TEST_UNIQUE_CHK', 'Cat A'")
        conn.execute(text("INSERT INTO tags (name, category) VALUES ('TEST_UNIQUE_CHK', 'Cat A')"))
        
        print("Inserting Tag 2: 'TEST_UNIQUE_CHK', 'Cat B'")
        conn.execute(text("INSERT INTO tags (name, category) VALUES ('TEST_UNIQUE_CHK', 'Cat B')"))
        conn.commit()
        print("SUCCESS! DB accepts duplicate names with different categories.")
    except Exception as e:
        print(f"FAILURE! DB rejected insertion: {e}")
