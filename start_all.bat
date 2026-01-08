@echo off
chcp 65001 >nul
title HaoExam - 一键启动

echo ========================================
echo       HaoExam 一键启动
echo ========================================
echo.

REM 启动后端
echo [1/2] 启动后端服务...
start "HaoExam Backend" d:\HaoExam\start_backend.bat
timeout /t 3 >nul

REM 启动前端
echo [2/2] 启动前端服务...
start "HaoExam Frontend" d:\HaoExam\start_frontend.bat

echo.
echo ========================================
echo 服务已启动！
echo.
echo 后端 API:  http://localhost:8000
echo API 文档:  http://localhost:8000/docs
echo 前端界面: http://localhost:3000
echo ========================================
echo.
echo 按任意键打开浏览器...
pause >nul

start http://localhost:3000
