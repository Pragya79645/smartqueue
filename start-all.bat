@echo off
echo ========================================
echo Starting Queue Intelligence System
echo ========================================
echo.

:: Start AI Engine (Flask Server)
echo [1/4] Starting AI Engine (Flask)...
start "AI Engine" cmd /k "cd ai-engine && conda activate queue-ai && set AI_ENGINE_PORT=8001 && python api/flask_server.py"
timeout /t 3 /nobreak >nul

:: Start Backend (Node.js/Express)
echo [2/4] Starting Backend Server...
start "Backend" cmd /k "cd backend && pnpm run dev"
timeout /t 3 /nobreak >nul

:: Start Frontend (Next.js)
echo [3/4] Starting Frontend...
start "Frontend" cmd /k "cd frontend && pnpm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Services:
echo   - AI Engine:  http://localhost:8001
echo   - Backend:    http://localhost:3001
echo   - Frontend:   http://localhost:3000
echo.
echo [4/4] You can start Queue Detection with:
echo   cd ai-engine
echo   conda activate queue-ai
echo   python queue_detection/detect_queue.py --display
echo.
echo Press any key to exit...
pause >nul
