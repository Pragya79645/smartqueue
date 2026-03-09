@echo off
REM Quick Start Script for AI JSON API Integration (Windows)

echo ======================================
echo   AI JSON API Quick Start
echo ======================================
echo.

echo Checking services...

REM Check AI Engine
curl -s -f -o NUL http://localhost:8000/health 2>NUL
if %errorlevel% == 0 (
    echo [32m✓ AI Engine is running[0m
    set AI_RUNNING=1
) else (
    echo [31m✗ AI Engine is NOT running[0m
    set AI_RUNNING=0
)

REM Check Backend
curl -s -f -o NUL http://localhost:5000/health 2>NUL
if %errorlevel% == 0 (
    echo [32m✓ Backend is running[0m
    set BACKEND_RUNNING=1
) else (
    echo [31m✗ Backend is NOT running[0m
    set BACKEND_RUNNING=0
)

echo.

REM Show instructions if services not running
if %AI_RUNNING% == 0 (
    echo [33m⚠ AI Engine is not running. Start it with:[0m
    echo    cd ai-engine
    echo    conda activate queue-ai
    echo    python api/flask_server.py
    echo.
)

if %BACKEND_RUNNING% == 0 (
    echo [33m⚠ Backend is not running. Start it with:[0m
    echo    cd backend
    echo    npm run dev
    echo.
)

REM Run tests if services are running
if %AI_RUNNING% == 1 if %BACKEND_RUNNING% == 1 (
    echo ======================================
    echo   Running Integration Tests
    echo ======================================
    echo.
    
    node test-ai-json-api.js
    
    echo.
    echo ======================================
    echo   Test API Endpoints
    echo ======================================
    echo.
    
    echo 1. Test AI Health:
    curl -s http://localhost:5000/api/ai/health
    echo.
    echo.
    
    echo 2. Get AI Analysis:
    echo (This may take a few seconds...)
    curl -s http://localhost:5000/api/ai/analyze?minutesAhead=15
    echo.
    echo.
    
    echo ======================================
    echo   Next Steps
    echo ======================================
    echo.
    echo 1. Open Frontend: http://localhost:3000
    echo 2. Check AI Dashboard component
    echo 3. Monitor real-time predictions
    echo.
    echo Documentation: AI_JSON_API_GUIDE.md
    echo.
) else (
    echo Please start the required services first.
    echo.
    echo Quick start commands:
    echo.
    echo Terminal 1 (AI Engine):
    echo   cd ai-engine
    echo   conda activate queue-ai
    echo   python api/flask_server.py
    echo.
    echo Terminal 2 (Backend):
    echo   cd backend
    echo   npm run dev
    echo.
    echo Terminal 3 (Frontend):
    echo   cd frontend
    echo   npm run dev
    echo.
    echo Or use: start-all.bat
    echo.
)

pause
