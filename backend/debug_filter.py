from app.database import SessionLocal
from app import crud, models

db = SessionLocal()
try:
    # Mimic crud.py logic exactly
    tag_category = "函数"
    tag_name = None

    query = db.query(models.Question)
    if tag_category or tag_name:
        query = query.join(models.Question.tags)
        if tag_category:
            query = query.filter(models.Tag.category == tag_category)
        if tag_name:
            query = query.filter(models.Tag.name == tag_name)
    
    questions = query.all()
    print(f"Query result count: {len(questions)}")
    for q in questions:
        tags = [(t.category, t.name) for t in q.tags]
        print(f"ID: {q.id}, Tags: {tags}")

    # Also check if there are questions that SHOULD match but don't, or vice versa
    print("\n--- All Questions and Tags ---")
    all_qs = crud.get_questions(db)
    for q in all_qs:
        tags = [(t.category, t.name) for t in q.tags]
        print(f"ID: {q.id}, Tags: {tags}")

finally:
    db.close()
