@echo off
chcp 65001 >nul
title HaoExam Frontend Manager

:menu
cls
echo ========================================
echo       HaoExam Frontend Manager
echo ========================================
echo.
echo   [1] 启动前端开发服务器
echo   [2] 停止前端服务
echo   [3] 重启前端服务
echo   [4] 构建生产版本
echo   [5] 退出
echo.
set /p choice=请选择操作 (1-5):

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto build
if "%choice%"=="5" goto exit
echo 无效选择，请重新输入
timeout /t 2 >nul
goto menu

:start
echo.
echo 正在启动前端开发服务器...

REM 检查是否已在运行
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo 前端服务已在运行 (PID: %%a)
    echo.
    pause
    goto menu
)

REM 启动服务
start "HaoExam Frontend" d:\HaoExam\start_frontend.bat
echo 前端开发服务器已启动！
echo 访问地址: http://localhost:3000
echo.
pause
goto menu

:stop
echo.
echo 正在停止前端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo 已停止进程 PID: %%a
)
echo 前端服务已停止！
echo.
pause
goto menu

:restart
echo.
echo 正在重启前端服务...

REM 先停止
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

timeout /t 2 >nul

REM 再启动
start "HaoExam Frontend" d:\HaoExam\start_frontend.bat
echo 前端服务已重启！
echo.
pause
goto menu

:build
echo.
echo 正在构建生产版本...
cd /d d:\HaoExam\frontend
"C:\Program Files\nodejs\npm.cmd" run build
echo.
echo 构建完成！输出目录: d:\HaoExam\frontend\dist
echo.
pause
goto menu

:exit
echo 再见！
exit
