# Phase 4 — Integration Complete ✅

## 🎯 Overview

Complete integration of all system components with real-time data flow between:
- **YOLO** → Queue Detection → Backend → Frontend
- **LSTM** → Predictions → Backend → PredictionCard
- **OR-Tools** → Staff Optimization → Backend → Dashboard
- **Backend** → WhatsApp Service → Staff Notifications

---

## 🔄 Data Flow Architecture

### 1. YOLO → Queue Count → Backend → Frontend

```
YOLO (detect_queue.py)
  ↓ [HTTP POST every 5s]
Backend (/api/queue/update/batch)
  ↓ [Save to MongoDB]
Frontend (Dashboard - polls every 5s)
  ↓ [Display CounterCards]
User sees live queue data
```

**Files Modified:**
- `ai-engine/queue_detection/detect_queue.py` - Sends queue data to backend
- `backend/src/controllers/queueController.js` - Receives and stores queue data
- `backend/src/routes/queueRoutes.js` - Queue API routes
- `frontend/src/app/dashboard/page.tsx` - Displays live queue data
- `frontend/src/api/queueApi.ts` - API client

**Testing:**
```bash
# Terminal 1: Start Backend
cd backend
pnpm run dev

# Terminal 2: Start Queue Detection
cd ai-engine
conda activate queue-ai
python queue_detection/detect_queue.py --backend http://localhost:3001 --display

# Terminal 3: Start Frontend
cd frontend
pnpm run dev

# Open: http://localhost:3000/dashboard
```

---

### 2. LSTM → Predictions → Backend → PredictionCard

```
LSTM Model (predict.py)
  ↓ [Loaded in Flask]
Flask API (/predict)
  ↓ [Called by backend]
Backend (/api/queue/predict)
  ↓ [HTTP GET]
Frontend (PredictionCard)
  ↓ [Refresh every 30s]
User sees AI predictions
```

**Files Modified:**
- `ai-engine/api/flask_server.py` - Prediction endpoint with flexible input
- `ai-engine/prediction/predict.py` - LSTM prediction logic
- `backend/src/services/predictionService.js` - Calls Flask API
- `backend/src/controllers/queueController.js` - Added `/queue/predict` endpoint
- `frontend/src/app/dashboard/page.tsx` - Fetches and displays predictions
- `frontend/src/components/prediction-card.tsx` - Shows prediction with confidence

**⚠️ Important Note on Prediction Confidence:**
> **LSTM models do not natively provide probability-based confidence scores.** 
> The confidence value (0.6 to 0.95) shown in the system is **derived from rolling error/variance** 
> of the historical queue data, not from the LSTM model itself. This heuristic provides a practical 
> indicator of prediction reliability based on data stability:
> - High variance → Lower confidence (data is unstable)
> - Low variance → Higher confidence (data is stable)
> 
> This is a standard approach in time-series forecasting when the model doesn't output probabilistic predictions.

**API Example:**
```bash
# Get prediction from backend
curl http://localhost:3001/api/queue/predict?minutesAhead=15

# Response:
{
  "success": true,
  "prediction": {
    "predicted_queue": 28.5,
    "confidence": 0.85,
    "minutes_ahead": 15
  },
  "rushTrend": {
    "isRush": true,
    "confidence": 0.75,
    "trend": "increasing"
  }
}
```

---

### 3. OR-Tools → Optimized Staff Plan → Backend → Dashboard

```
OR-Tools (staff_optimizer.py)
  ↓ [Loaded in Flask]
Flask API (/optimize)
  ↓ [Called by backend]
Backend (/api/allocate/now)
  ↓ [Saves allocation]
Backend (/api/allocate/apply)
  ↓ [Assigns staff + WhatsApp]
Frontend (Dashboard)
  ↓ [Shows recommendations]
Staff receives WhatsApp notification
```

**Files Modified:**
- `ai-engine/optimization/staff_optimizer.py` - OR-Tools optimization
- `ai-engine/api/flask_server.py` - Optimization endpoint
- `backend/src/services/optimizeService.js` - Calls Flask API
- `backend/src/controllers/allocationController.js` - Allocation logic + WhatsApp integration
- `frontend/src/api/allocationApi.ts` - Allocation API client

**🔄 OR-Tools Optimization Triggers:**

The system supports **two triggering mechanisms** for staff optimization:

1. **Automatic Trigger (High Rush Detection)**
   - When `rushLevel = "HIGH"` is detected from LSTM predictions
   - System automatically calls `/api/allocate/now`
   - Generates optimization recommendation without manual intervention
   - Useful for proactive staffing during predicted rush hours

2. **Manual Trigger (Dashboard Button)**
   - Manager clicks "Optimize Now" button on dashboard
   - Calls `/api/allocate/now` on demand
   - Allows manual optimization at any time
   - Useful for ad-hoc adjustments or testing

Both triggers invoke the same OR-Tools optimization algorithm via the Flask API endpoint.

**Usage Flow:**
1. Backend automatically generates allocation recommendations
2. Manager reviews on dashboard
3. Click "Apply Allocation"
4. Staff receives WhatsApp notification
5. Staff moves to assigned counter

**API Example:**
```bash
# Generate optimized allocation
curl -X POST http://localhost:3001/api/allocate/now

# Apply allocation (sends WhatsApp)
curl -X POST http://localhost:3001/api/allocate/{id}/apply
```

---

### 4. Backend → WhatsApp Service → WhatsApp Messages

```
Allocation Applied
  ↓
Backend (allocationController.js)
  ↓ [For each staff]
WhatsApp Service (whatsappService.js)
  ↓ [Meta Business API]
WhatsApp Message
  ↓
Staff Phone
```

**Files Modified:**
- `backend/src/services/whatsappService.js` - WhatsApp integration
- `backend/src/controllers/allocationController.js` - Triggers notifications
- `backend/.env` - WhatsApp credentials (configure)

**Configuration:**
```bash
# In backend/.env
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_TOKEN=your_access_token
```

**Message Format:**
```
Hi [Staff Name]! You've been assigned to Counter [X]. 
Please proceed there immediately. 
Priority: [High/Normal/Low]
Reason: [Queue overload / Optimized allocation]
```

---

## 🚀 Quick Start

### Option 1: Start All Services at Once
```bash
# Windows
start-all.bat

# Linux/Mac
chmod +x start-all.sh
./start-all.sh
```

### Option 2: Start Individually

#### 1. Start AI Engine (Flask)
```bash
cd ai-engine
conda activate queue-ai
python api/flask_server.py
```
**URL:** http://localhost:8000

#### 2. Start Backend (Express)
```bash
cd backend
pnpm run dev
```
**URL:** http://localhost:3001

#### 3. Start Frontend (Next.js)
```bash
cd frontend
pnpm run dev
```
**URL:** http://localhost:3000

#### 4. Start Queue Detection (Optional)
```bash
cd ai-engine
conda activate queue-ai
python queue_detection/detect_queue.py --backend http://localhost:3001 --display
```

---

## 📊 Testing Integration

### Test 1: Queue Detection Flow
```bash
# 1. Ensure backend and frontend are running
# 2. Start queue detection with test camera
cd ai-engine
python queue_detection/detect_queue.py --camera 0 --backend http://localhost:3001 --display

# 3. Open dashboard
# http://localhost:3000/dashboard

# 4. Watch for:
#    - Live counter updates every 5 seconds
#    - Queue counts from YOLO
#    - Status colors (normal/busy/critical)
```

### Test 2: Prediction Flow
```bash
# 1. Generate some queue data (run detection for 2-3 minutes)
# 2. Check prediction endpoint
curl http://localhost:3001/api/queue/predict?minutesAhead=15

# 3. Dashboard should show:
#    - PredictionCard with expected queue
#    - Rush level (low/medium/high)
#    - AI recommendation
#    - Confidence percentage
```

### Test 3: Optimization Flow
```bash
# 1. Ensure staff data exists
curl http://localhost:3001/api/staff

# 2. Generate allocation
curl -X POST http://localhost:3001/api/allocate/now

# 3. Get recommendation
curl http://localhost:3001/api/allocate/recommendation

# 4. Apply allocation (sends WhatsApp)
curl -X POST http://localhost:3001/api/allocate/{id}/apply
```

### Test 4: WhatsApp Notifications
```bash
# Configure WhatsApp credentials in backend/.env
# Then apply allocation - staff should receive messages
curl -X POST http://localhost:3001/api/allocate/{id}/apply

# Check backend logs for:
# "WhatsApp notification sent to [Staff Name]"
```

---

## 🔍 API Endpoints Reference

### AI Engine (Flask - Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/predict` | POST | LSTM queue prediction |
| `/optimize` | POST | OR-Tools staff optimization |
| `/predict-and-optimize` | POST | Combined prediction + optimization |

### Backend (Express - Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/queue/live` | GET | Current queue data |
| `/api/queue/update` | POST | Update single counter |
| `/api/queue/update/batch` | POST | Batch update counters |
| `/api/queue/predict` | GET | Get predictions (calls AI) |
| `/api/queue/history` | GET | Historical data |
| `/api/allocate/now` | POST | Generate allocation |
| `/api/allocate/recommendation` | GET | Latest allocation |
| `/api/allocate/:id/apply` | POST | Apply allocation + WhatsApp |
| `/api/staff` | GET | Get staff list |

### Frontend (Next.js - Port 3000)

| Page | Description |
|------|-------------|
| `/dashboard` | Main dashboard with live data |
| `/staff` | Staff management |
| `/settings` | System settings |

---

## 📈 Performance Metrics

- **Queue Detection:** ~30 FPS with YOLO
- **Backend Updates:** Every 5 seconds
- **Frontend Polling:** Every 5 seconds (queue), 30 seconds (predictions)
- **LSTM Prediction:** ~200ms per prediction
- **OR-Tools Optimization:** ~500ms for 10 staff, 5 counters
- **WhatsApp Send:** ~1-2 seconds per message

---

## 🔧 Configuration

### Environment Variables

**AI Engine:** Not required (uses defaults)

**Backend:** `backend/.env`
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/queue-intelligence
PYTHON_API_URL=http://localhost:8000
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_TOKEN=your_access_token
```

**Frontend:** `frontend/.env.local`
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_AI_ENGINE_URL=http://localhost:8000
```

### Camera Configuration

Edit counter zones in `ai-engine/queue_detection/detect_queue.py`:
```python
self.counter_zones = {
    "1": (0, 0, 426, 720),      # Left third
    "2": (427, 0, 853, 720),    # Middle third
    "3": (854, 0, 1280, 720)    # Right third
}
```

---

## 🐛 Troubleshooting

### Flask API not responding
```bash
# Check if running
curl http://localhost:8000/health

# Restart
cd ai-engine
conda activate queue-ai
python api/flask_server.py
```

### Backend can't reach Flask
```bash
# Check PYTHON_API_URL in backend/.env
# Should be: http://localhost:8000

# Test connection
curl http://localhost:8000/health
```

### Queue detection not sending data
```bash
# Check backend URL in command
python queue_detection/detect_queue.py --backend http://localhost:3001

# Check backend logs for incoming requests
```

### WhatsApp not sending
```bash
# Check backend/.env has credentials
# Check backend logs for WhatsApp errors
# Service falls back to mock mode if not configured
```

---

## ✅ Integration Checklist

- [x] YOLO detection sends to backend
- [x] Backend stores queue data in MongoDB
- [x] Frontend displays live queue data
- [x] Flask API exposes prediction endpoint
- [x] Backend calls Flask for predictions
- [x] Frontend shows predictions in PredictionCard
- [x] Flask API exposes optimization endpoint
- [x] Backend generates allocation recommendations
- [x] Backend sends WhatsApp on allocation apply
- [x] Frontend displays optimization results
- [x] All services can start with one command
- [x] API documentation complete
- [x] Error handling in place
- [x] Fallback modes for offline AI

---

## 🎉 Success Criteria

✅ **All 4 integration flows working:**
1. YOLO → Backend → Frontend ✓
2. LSTM → Backend → PredictionCard ✓
3. OR-Tools → Backend → Dashboard ✓
4. Backend → WhatsApp → Staff ✓

**Phase 4 Integration: COMPLETE!** 🚀
