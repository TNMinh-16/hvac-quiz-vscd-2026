@echo off
title HVAC Quiz - ASHRAE VSCD 2026
chcp 65001 >nul
echo.
echo ============================================================
echo   HVAC Quiz - ASHRAE VSCD 2026
echo ============================================================
echo.

REM Kiểm tra Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Node.js chua duoc cai. Tai tai: https://nodejs.org/
    pause
    exit /b 1
)

REM Kiểm tra questions.json
if not exist "data\questions.json" (
    echo [CANH BAO] Chua co du lieu. Dang chay import...
    echo.
    python scripts\import_docx.py
    if %errorlevel% neq 0 (
        echo [LOI] Import that bai. Kiem tra Python va file Word.
        pause
        exit /b 1
    )
)

REM Kiểm tra server dependencies
if not exist "server\node_modules" (
    echo [INFO] Cai server dependencies...
    cd server && npm install && cd ..
)

REM Kiểm tra client build
if not exist "client\dist" (
    echo [INFO] Build frontend...
    cd client && npm install && npm run build && cd ..
)

echo.
echo [OK] Dang khoi dong server tai http://localhost:3000
echo      Nhan Ctrl+C de dung server
echo.

REM Mở trình duyệt sau 2 giây
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:3000"

REM Chạy server
node server\index.js
