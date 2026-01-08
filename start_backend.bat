@echo off
chcp 65001 >nul
cd /d d:\HaoExam\backend
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
