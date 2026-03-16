#!/bin/bash

# Quick Start Script for AI JSON API Integration
# This script helps test the complete AI data flow

echo "======================================"
echo "  AI JSON API Quick Start"
echo "======================================"
echo ""

# Check if services are running
check_service() {
    local url=$1
    local name=$2
    
    if curl -s -f -o /dev/null "$url"; then
        echo "✓ $name is running"
        return 0
    else
        echo "✗ $name is NOT running"
        return 1
    fi
}

echo "Checking services..."
ai_running=0
backend_running=0

if check_service "http://localhost:8001/health" "AI Engine"; then
    ai_running=1
fi

if check_service "http://localhost:5000/health" "Backend"; then
    backend_running=1
fi

echo ""

# If services not running, show instructions
if [ $ai_running -eq 0 ]; then
    echo "⚠ AI Engine is not running. Start it with:"
    echo "   cd ai-engine"
    echo "   conda activate queue-ai"
    echo "   python api/flask_server.py"
    echo ""
fi

if [ $backend_running -eq 0 ]; then
    echo "⚠ Backend is not running. Start it with:"
    echo "   cd backend"
    echo "   npm run dev"
    echo ""
fi

# Run tests if services are running
if [ $ai_running -eq 1 ] && [ $backend_running -eq 1 ]; then
    echo "======================================"
    echo "  Running Integration Tests"
    echo "======================================"
    echo ""
    
    node test-ai-json-api.js
    
    echo ""
    echo "======================================"
    echo "  Test Frontend API Calls"
    echo "======================================"
    echo ""
    
    echo "1. Test AI Health:"
    curl -s http://localhost:5000/api/ai/health | jq '.' || echo "Install jq for pretty JSON"
    
    echo ""
    echo "2. Sample AI Analysis:"
    echo "(This may take a few seconds...)"
    curl -s http://localhost:5000/api/ai/analyze?minutesAhead=15 | jq '.analysis' || echo ""
    
    echo ""
    echo "======================================"
    echo "  Next Steps"
    echo "======================================"
    echo ""
    echo "1. Open Frontend: http://localhost:3000"
    echo "2. Check AI Dashboard component"
    echo "3. Monitor real-time predictions"
    echo ""
    echo "Documentation: AI_JSON_API_GUIDE.md"
    echo ""
else
    echo "Please start the required services first."
    echo ""
    echo "Quick start commands:"
    echo ""
    echo "Terminal 1 (AI Engine):"
    echo "  cd ai-engine && conda activate queue-ai && python api/flask_server.py"
    echo ""
    echo "Terminal 2 (Backend):"
    echo "  cd backend && npm run dev"
    echo ""
    echo "Terminal 3 (Frontend):"
    echo "  cd frontend && npm run dev"
    echo ""
fi
