@echo off
echo ========================================
echo Starting Queue Detection System
echo ========================================
echo.

cd ai-engine

echo Activating conda environment...
call conda activate queue-ai

echo.
echo Starting YOLO Queue Detection...
echo Backend URL: http://localhost:3001
echo.
echo Press Ctrl+C to stop
echo.

python queue_detection/detect_queue.py --backend http://localhost:3001 --display --interval 5

pause
