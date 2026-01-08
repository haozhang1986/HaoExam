@echo off
chcp 65001 >nul
title HaoExam Backend Manager

:menu
cls
echo ========================================
echo       HaoExam Backend Manager
echo ========================================
echo.
echo   [1] 启动后端服务
echo   [2] 停止后端服务
echo   [3] 重启后端服务
echo   [4] 查看运行状态
echo   [5] 退出
echo.
set /p choice=请选择操作 (1-5):

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto status
if "%choice%"=="5" goto exit
echo 无效选择，请重新输入
timeout /t 2 >nul
goto menu

:start
echo.
echo 正在启动后端服务...

REM 检查是否已在运行
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo 后端服务已在运行 (PID: %%a)
    echo.
    pause
    goto menu
)

REM 启动服务
start "HaoExam Backend" d:\HaoExam\start_backend.bat
echo 后端服务已启动！
echo 访问地址: http://localhost:8000
echo API 文档: http://localhost:8000/docs
echo.
pause
goto menu

:stop
echo.
echo 正在停止后端服务...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo 已停止进程 PID: %%a
)
echo 后端服务已停止！
echo.
pause
goto menu

:restart
echo.
echo 正在重启后端服务...

REM 先停止
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo 已停止旧进程 PID: %%a
)

REM 等待端口释放
timeout /t 2 >nul

REM 再启动
start "HaoExam Backend" d:\HaoExam\start_backend.bat
echo 后端服务已重启！
echo.
pause
goto menu

:status
echo.
echo 检查后端服务状态...
echo.
set found=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    set found=1
    echo [运行中] 后端服务正在监听端口 8000 (PID: %%a)
)
if %found%==0 (
    echo [已停止] 后端服务未运行
)
echo.
pause
goto menu

:exit
echo 再见！
exit
