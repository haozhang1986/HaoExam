from sqlalchemy import create_engine, text
import os

# Try to find the DB
db_path = "d:/FirstWebsite/backend/sql_app.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

print(f"Found DB at {db_path}")
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as conn:
    try:
        # Check if column exists
        result = conn.execute(text("PRAGMA table_info(questions)")).fetchall()
        columns = [row[1] for row in result]
        if 'month' in columns:
            print("Column 'month' already exists.")
        else:
            print("Adding column 'month'...")
            conn.execute(text("ALTER TABLE questions ADD COLUMN month VARCHAR"))
            print("Column 'month' added successfully.")
    except Exception as e:
        print(f"Error migrating DB: {e}")
