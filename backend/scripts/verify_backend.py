import requests
import os
import time

BASE_URL = "http://127.0.0.1:8000"

def verify():
    # Wait for server to start
    time.sleep(2)
    
    print("Creating dummy images...")
    # Create dummy images (100x100 white image)
    from PIL import Image
    img = Image.new('RGB', (100, 100), color = 'white')
    img.save('test_q.png')
    img.save('test_a.png')

    try:
        # 1. Upload Question
        print("Uploading question...")
        files = {
            "question_image": open("test_q.png", "rb"),
            "answer_image": open("test_a.png", "rb")
        }
        data = {
            "subject": "Math",
            "difficulty": "Hard",
            "year": 2023
        }
        r = requests.post(f"{BASE_URL}/questions/", files=files, data=data)
        print(f"Upload Status: {r.status_code}")
        if r.status_code != 200:
            print(r.text)
            return
        
        q_data = r.json()
        print(f"Uploaded Question: {q_data}")
        q_id = q_data["id"]

        # 2. List Questions
        print("Listing questions...")
        r = requests.get(f"{BASE_URL}/questions/?subject=Math")
        print(f"List Status: {r.status_code}")
        questions = r.json()
        print(f"Found {len(questions)} questions")

        # 3. Generate Worksheet
        print("Generating worksheet...")
        r = requests.post(f"{BASE_URL}/worksheet/generate", json={"question_ids": [q_id], "include_answers": True})
        print(f"Generate Status: {r.status_code}")
        
        if r.status_code == 200:
            with open("worksheet_test.pdf", "wb") as f:
                f.write(r.content)
            print("PDF saved to worksheet_test.pdf")
        else:
            print(r.text)

    except Exception as e:
        print(f"Verification failed: {e}")
    finally:
        if os.path.exists("test_q.png"):
            os.remove("test_q.png")
        if os.path.exists("test_a.png"):
            os.remove("test_a.png")

if __name__ == "__main__":
    verify()
