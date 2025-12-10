from sqlalchemy import create_engine, text
import os

# Try to find the DB
db_path = "d:/FirstWebsite/sql_app.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    # Try backend folder
    db_path = "d:/FirstWebsite/backend/sql_app.db"
    if not os.path.exists(db_path):
        print(f"DB not found at {db_path}")
        exit(1)

print(f"Found DB at {db_path}")
engine = create_engine(f'sqlite:///{db_path}')

with engine.connect() as conn:
    try:
        result = conn.execute(text('SELECT count(*) FROM questions')).scalar()
        print(f'Question count: {result}')
        
        subjects = conn.execute(text('SELECT DISTINCT subject FROM questions')).fetchall()
        print(f'Subjects: {[s[0] for s in subjects]}')
    except Exception as e:
        print(f"Error querying DB: {e}")
