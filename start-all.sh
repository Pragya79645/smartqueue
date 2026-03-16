#!/bin/bash

echo "========================================"
echo "Starting Queue Intelligence System"
echo "========================================"
echo ""

# Start AI Engine (Flask Server)
echo "[1/4] Starting AI Engine (Flask)..."
cd ai-engine
conda activate queue-ai
AI_ENGINE_PORT=8001 python api/flask_server.py &
AI_PID=$!
cd ..
sleep 3

# Start Backend (Node.js/Express)
echo "[2/4] Starting Backend Server..."
cd backend
pnpm run dev &
BACKEND_PID=$!
cd ..
sleep 3

# Start Frontend (Next.js)
echo "[3/4] Starting Frontend..."
cd frontend
pnpm run dev &
FRONTEND_PID=$!
cd ..
sleep 3

echo ""
echo "========================================"
echo "All services started!"
echo "========================================"
echo ""
echo "Services:"
echo "  - AI Engine:  http://localhost:8001"
echo "  - Backend:    http://localhost:3001"
echo "  - Frontend:   http://localhost:3000"
echo ""
echo "[4/4] You can start Queue Detection with:"
echo "  cd ai-engine"
echo "  conda activate queue-ai"
echo "  python queue_detection/detect_queue.py --display"
echo ""
echo "Process IDs:"
echo "  AI Engine: $AI_PID"
echo "  Backend: $BACKEND_PID"
echo "  Frontend: $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user interrupt
trap "kill $AI_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
