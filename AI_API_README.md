# AI JSON API Integration - Quick Reference

## 🎯 What This Does
This implementation enables the AI engine to send predictions, analysis, and detection data to the frontend as structured JSON responses through a well-defined API layer.

## 🏗️ Architecture
```
AI Engine (Python) → Backend (Node.js) → Frontend (Next.js)
     JSON APIs          Proxy Layer        React Components
```

## 🚀 Quick Start

### 1. Start All Services
```bash
# Use the all-in-one script
start-all.bat  # Windows

# Or start manually:
# Terminal 1: AI Engine
cd ai-engine
conda activate queue-ai
python api/flask_server.py

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: Frontend
cd frontend
npm run dev
```

### 2. Test the Integration
```bash
# Run comprehensive tests
node test-ai-json-api.js

# Or use quick test script
test-ai-integration.bat  # Windows
```

### 3. View the Dashboard
Open: http://localhost:3000
- AI predictions display automatically
- Health status shows in top-right
- Auto-refreshes every 30 seconds

## 📡 New API Endpoints

### AI Engine (Port 8000)
- `POST /queue/detection` - Process detection data
- `POST /ai/analyze` - Comprehensive analysis
- `POST /predict` - Queue prediction (enhanced)
- `POST /optimize` - Staff optimization

### Backend (Port 5000)
- `GET /api/ai/health` - Check AI status
- `GET /api/ai/analyze` - Get AI analysis
- `POST /api/ai/predict-enhanced` - Enhanced prediction
- `POST /api/ai/detection` - Process detection

### Frontend Usage
```typescript
import { getAiAnalysis, checkAiHealth } from '@/api/aiApi'

// Get AI analysis
const data = await getAiAnalysis(15)
console.log(data.analysis.prediction)

// Check health
const health = await checkAiHealth()
console.log(health.ai_engine_status) // 'online' or 'offline'
```

## 🎨 New Components

### AI Dashboard
```tsx
import { AiDashboard } from '@/components/ai-dashboard'

<AiDashboard />
```

Features:
- Real-time predictions
- Rush level indicators
- Counter status breakdown
- Health monitoring
- Auto-refresh

## 📄 Files Created/Modified

### New Files:
1. `backend/src/controllers/aiController.js` - API handlers
2. `backend/src/routes/aiRoutes.js` - Route definitions
3. `frontend/src/api/aiApi.ts` - API client
4. `frontend/src/components/ai-dashboard.tsx` - Dashboard UI
5. `test-ai-json-api.js` - Test suite
6. `AI_JSON_API_GUIDE.md` - Full documentation
7. `AI_INTEGRATION_SUMMARY.md` - Implementation details

### Modified Files:
1. `ai-engine/api/flask_server.py` - Added new endpoints
2. `backend/src/app.js` - Registered AI routes

## 📊 Example Response

```json
{
  "success": true,
  "analysis": {
    "prediction": {
      "predicted_queue": 18.5,
      "confidence": 85.0,
      "rush_level": "medium",
      "recommendation": "Moderate rush expected. Ensure adequate staff coverage.",
      "trend": "increasing"
    },
    "current_state": {
      "total_queue": 15,
      "counters": [
        {
          "id": "1",
          "queue": 10,
          "status": "busy"
        }
      ]
    }
  }
}
```

## ✅ Testing Checklist

Run these to verify everything works:

1. **AI Engine Health:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Backend Proxy:**
   ```bash
   curl http://localhost:5000/api/ai/health
   ```

3. **Full Integration:**
   ```bash
   node test-ai-json-api.js
   ```

4. **Frontend:**
   - Open http://localhost:3000
   - Check dashboard loads
   - Verify AI predictions show

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "AI Engine Offline" | Start Flask server: `python api/flask_server.py` |
| "Insufficient Data" | Add queue records or wait for detection |
| No predictions show | Check browser console, verify backend running |
| Timeout errors | Check server logs, AI may be processing |

## 📚 Documentation

- **Quick Start:** This file
- **API Reference:** `AI_JSON_API_GUIDE.md`
- **Implementation:** `AI_INTEGRATION_SUMMARY.md`
- **Architecture:** See diagrams in summary

## 🎯 Next Steps

1. ✅ Integration complete
2. Test with real queue data
3. Monitor prediction accuracy
4. Tune confidence thresholds
5. Add historical charts (optional)

## 💡 Key Features

- ✅ Structured JSON responses
- ✅ TypeScript type safety
- ✅ Error handling & fallbacks
- ✅ Real-time dashboard
- ✅ Health monitoring
- ✅ Rush level detection
- ✅ Actionable recommendations
- ✅ Auto-refresh
- ✅ Comprehensive testing

## 📞 Need Help?

1. Check [AI_JSON_API_GUIDE.md](AI_JSON_API_GUIDE.md)
2. Run test script: `node test-ai-json-api.js`
3. Check server logs
4. Verify all services running

---

**Status:** ✅ Ready to Use
**Last Updated:** December 28, 2025
