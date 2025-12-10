import requests

url = "http://127.0.0.1:8000/questions/"

# Prepare files
files = [
    ('question_images', ('q1.png', open('test_q.png', 'rb'), 'image/png')),
    ('question_images', ('q2.png', open('test_q.png', 'rb'), 'image/png')), # Test multi-image
    ('answer_images', ('a1.png', open('test_a.png', 'rb'), 'image/png'))
]

# Prepare data
data = {
    "curriculum": "A-Level",
    "subject": "Math",
    "year": "2023",
    "difficulty": "Medium",
    "tag_category": "Topic",
    "tag_name": "Algebra"
}

try:
    print("Sending request...")
    response = requests.post(url, files=files, data=data)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
