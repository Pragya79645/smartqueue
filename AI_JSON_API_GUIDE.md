# AI JSON API Integration Guide

## Overview
This guide explains how AI data flows from the AI Engine through the Backend to the Frontend via JSON APIs.

## Architecture Flow

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   AI Engine     │─────▶│    Backend      │─────▶│    Frontend     │
│  (Flask/Python) │ JSON │  (Node/Express) │ JSON │   (Next.js)     │
└─────────────────┘      └─────────────────┘      └─────────────────┘
     Port 8000                Port 5000                Port 3000
```

## AI Engine Endpoints (Port 8000)

### 1. Health Check
**GET** `/health`
```json
Response:
{
  "status": "healthy",
  "message": "AI Engine API is running",
  "models_loaded": true
}
```

### 2. Queue Prediction
**POST** `/predict`
```json
Request:
{
  "data": [12, 15, 18, ...],  // Last 60 queue values
  "minutes_ahead": 15
}

Response:
{
  "success": true,
  "predicted_queue": 18.5,
  "predictions": [{
    "counterId": "aggregate",
    "currentSize": 15,
    "predictedSize": 18.5,
    "confidence": 0.85,
    "minutesAhead": 15
  }],
  "confidence": 0.85,
  "minutes_ahead": 15,
  "timestamp": "2025-12-28T10:30:00Z"
}
```

### 3. Queue Detection (NEW)
**POST** `/queue/detection`
```json
Request:
{
  "counters": [
    {"counterId": "1", "queueSize": 10, "averageWaitTime": 30},
    {"counterId": "2", "queueSize": 5, "averageWaitTime": 15}
  ],
  "timestamp": "2025-12-28T10:30:00Z",
  "camera_id": "cam_01"
}

Response:
{
  "success": true,
  "data": {
    "counters": [
      {
        "counterId": "1",
        "queueSize": 10,
        "averageWaitTime": 30,
        "status": "busy",
        "statusColor": "orange",
        "capacity": 20,
        "utilization": 50.0
      }
    ],
    "summary": {
      "totalQueue": 15,
      "totalCounters": 2,
      "averageQueueSize": 7.5,
      "criticalCounters": 0,
      "busyCounters": 1
    },
    "timestamp": "2025-12-28T10:30:00Z",
    "camera_id": "cam_01"
  },
  "metadata": {
    "processed_at": "2025-12-28T10:30:01Z",
    "api_version": "1.0",
    "model": "YOLOv8"
  }
}
```

### 4. Comprehensive AI Analysis (NEW)
**POST** `/ai/analyze`
```json
Request:
{
  "historical_data": [...],     // Last 60 queue records
  "current_counters": [...],    // Current counter states
  "minutes_ahead": 15
}

Response:
{
  "success": true,
  "analysis": {
    "prediction": {
      "predicted_queue": 18.5,
      "current_queue": 15,
      "change": 3.5,
      "confidence": 85.0,
      "rush_level": "medium",
      "recommendation": "Moderate rush expected. Ensure adequate staff coverage.",
      "minutes_ahead": 15,
      "trend": "increasing"
    },
    "current_state": {
      "total_queue": 15,
      "counter_count": 2,
      "average_queue": 7.5,
      "max_queue": 10,
      "min_queue": 5,
      "counters": [
        {
          "id": "1",
          "queue": 10,
          "wait_time": 30,
          "status": "busy"
        }
      ]
    }
  },
  "timestamp": "2025-12-28T10:30:00Z"
}
```

### 5. Staff Optimization
**POST** `/optimize`
```json
Request:
{
  "current_queue_load": {"registration": 10, "billing": 5},
  "predicted_queue_load": {"registration": 15, "billing": 8},
  "staff": [...],
  "counters": [...],
  "time_slots": [0, 1, 2, 3, 4, 5, 6, 7],
  "budget": 5000.0
}

Response:
{
  "recommended_staff": [
    {
      "counter": 1,
      "staff_id": "S12",
      "staff_name": "Staff 1",
      "counter_type": "registration",
      "start_time": "09:00",
      "end_time": "17:00",
      "duration_hours": 8.0,
      "cost": 160.0
    }
  ],
  "total_cost": 320.0,
  "status": "optimal",
  "solve_time": 0.45
}
```

## Backend Endpoints (Port 5000)

### 1. AI Health Check
**GET** `/api/ai/health`
```json
Response:
{
  "success": true,
  "ai_engine_status": "online",
  "status": "healthy",
  "models_loaded": true
}
```

### 2. Comprehensive AI Analysis
**GET** `/api/ai/analyze?minutesAhead=15`
```json
Response:
{
  "success": true,
  "analysis": {
    "prediction": { ... },
    "current_state": { ... }
  },
  "timestamp": "2025-12-28T10:30:00Z"
}
```

### 3. Enhanced Prediction
**POST** `/api/ai/predict-enhanced`
```json
Request:
{
  "counterId": "1",
  "minutesAhead": 15
}

Response:
{
  "success": true,
  "prediction": {
    "predicted_queue": 18.5,
    "confidence": 85.0,
    "rush_level": "medium",
    "recommendation": "Moderate rush expected...",
    "timeframe": "Next 15 minutes"
  }
}
```

### 4. Process Detection Data
**POST** `/api/ai/detection`
```json
Request:
{
  "counters": [...],
  "timestamp": "2025-12-28T10:30:00Z",
  "camera_id": "cam_01"
}

Response:
{
  "success": true,
  "data": { ... },
  "metadata": { ... }
}
```

## Frontend API Client

### Import and Use
```typescript
import { 
  getAiAnalysis, 
  getEnhancedPrediction, 
  checkAiHealth 
} from '@/api/aiApi'

// Get comprehensive analysis
const analysis = await getAiAnalysis(15)
console.log(analysis.analysis.prediction)

// Get enhanced prediction
const prediction = await getEnhancedPrediction('1', 15)
console.log(prediction.prediction.rush_level)

// Check AI health
const health = await checkAiHealth()
console.log(health.ai_engine_status)
```

## Using the AI Dashboard Component

```tsx
import { AiDashboard } from '@/components/ai-dashboard'

export default function DashboardPage() {
  return (
    <div>
      <h1>Queue Management</h1>
      <AiDashboard />
    </div>
  )
}
```

## Testing the Integration

### 1. Start All Services
```bash
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

### 2. Run Test Script
```bash
node test-ai-json-api.js
```

### 3. Manual Testing

**Test AI Engine directly:**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"data": [5,6,7,8,9,10,11,12], "minutes_ahead": 15}'
```

**Test Backend proxy:**
```bash
curl http://localhost:5000/api/ai/health
```

**Test Frontend:**
- Open http://localhost:3000
- Navigate to dashboard
- Check AI predictions display

## Data Flow Example

### 1. Queue Detection Sends Data
```python
# ai-engine/queue_detection/detect_queue.py
counter_data = {
    'counters': [
        {'counterId': '1', 'queueSize': 10}
    ]
}
requests.post('http://localhost:5000/api/queue/update/batch', json=counter_data)
```

### 2. Backend Receives and Stores
```javascript
// Backend saves to MongoDB
await QueueRecord.insertMany(queues)
```

### 3. Frontend Requests AI Analysis
```typescript
// Frontend calls backend
const analysis = await getAiAnalysis(15)
```

### 4. Backend Forwards to AI Engine
```javascript
// Backend forwards historical data to AI
const aiResponse = await axios.post('http://localhost:8000/ai/analyze', {
  historical_data: historicalData,
  current_counters: currentCounters
})
```

### 5. AI Engine Returns Prediction
```python
# AI Engine processes and returns JSON
return jsonify({
  "success": True,
  "analysis": {
    "prediction": {...}
  }
})
```

### 6. Frontend Displays Results
```tsx
// Frontend renders AI data
<AiDashboard />
```

## Response Status Levels

### Rush Levels
- **low**: < 8 people in queue
- **medium**: 8-15 people in queue  
- **high**: > 15 people in queue

### Counter Status
- **normal**: < 8 people
- **busy**: 8-15 people
- **critical**: > 15 people

### Confidence Levels
- **High**: > 80%
- **Medium**: 60-80%
- **Low**: < 60%

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Optional details"
}
```

### Common Issues

**AI Engine Offline:**
- Backend returns fallback response with `fallback: true`
- Frontend shows "AI Engine Offline" badge

**Insufficient Data:**
- Returns 400 error with clear message
- Requires minimum 10 historical records

**Timeout:**
- Backend timeout: 10 seconds for analysis, 5 seconds for predictions
- Returns error after timeout

## Environment Variables

### Backend (.env)
```
PYTHON_API_URL=http://localhost:8000
```

### Frontend (.env.local)
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_AI_ENGINE_URL=http://localhost:8000
```

## TypeScript Types

All response types are defined in `frontend/src/api/aiApi.ts`:
- `AiAnalysisResponse`
- `EnhancedPredictionResponse`
- `DetectionDataResponse`

## Performance Considerations

- **Caching**: Backend caches recent predictions (5 minutes)
- **Batching**: Detection data sent in batches every 2 seconds
- **Polling**: Frontend polls every 30 seconds for updates
- **Timeouts**: Configured to prevent hanging requests

## Next Steps

1. ✅ AI Engine returns JSON responses
2. ✅ Backend proxies AI requests
3. ✅ Frontend consumes JSON data
4. ✅ Dashboard displays AI insights
5. 🔄 Add real-time WebSocket updates
6. 🔄 Implement caching layer
7. 🔄 Add historical analysis charts

## Support

For issues or questions:
1. Check server logs
2. Run test script: `node test-ai-json-api.js`
3. Verify all services are running
4. Check network connectivity
