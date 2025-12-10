import os

# Simulate main.py location
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "../frontend")

print(f"File: {os.path.abspath(__file__)}")
print(f"BASE_DIR: {BASE_DIR}")
print(f"FRONTEND_DIR: {FRONTEND_DIR}")
print(f"FRONTEND_DIR (abs): {os.path.abspath(FRONTEND_DIR)}")
print(f"Exists: {os.path.exists(FRONTEND_DIR)}")
