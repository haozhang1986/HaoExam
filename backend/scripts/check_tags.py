from sqlalchemy import create_engine, text

engine = create_engine('sqlite:///sql_app.db')
with engine.connect() as conn:
    result = conn.execute(text("SELECT * FROM tags LIMIT 10")).fetchall()
    count = conn.execute(text("SELECT COUNT(*) FROM tags")).scalar()
    print(f"Total tags: {count}")
    print("Sample tags:")
    for row in result:
        print(row)
        
    qt_count = conn.execute(text("SELECT COUNT(*) FROM question_tags")).scalar()
    print(f"Total question_tags: {qt_count}")
    qt_sample = conn.execute(text("SELECT * FROM question_tags LIMIT 5")).fetchall()
    print("Sample question_tags:")
    for row in qt_sample:
        print(row)
