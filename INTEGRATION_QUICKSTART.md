# 🎯 PHASE 4: Integration - Quick Reference

## 🚀 Start System (Choose One)

### Option A: All at Once
```bash
# Windows
start-all.bat

# Linux/Mac
chmod +x start-all.sh
./start-all.sh
```

### Option B: Step by Step
```bash
# 1. AI Engine
cd ai-engine
conda activate queue-ai
python api/flask_server.py

# 2. Backend (new terminal)
cd backend
pnpm run dev

# 3. Frontend (new terminal)
cd frontend
pnpm run dev

# 4. Queue Detection (optional, new terminal)
cd ai-engine
conda activate queue-ai
python queue_detection/detect_queue.py --backend http://localhost:5000 --display
```

---

## 🔗 Integration Flows

### 1️⃣ YOLO → Queue Count → Backend → Frontend
```
Camera Feed
  ↓ (YOLO Detection)
Queue Counts {"1": 12, "2": 8, "3": 15}
  ↓ (POST /api/queue/update/batch)
MongoDB (QueueRecord collection)
  ↓ (GET /api/queue/live - every 5s)
Dashboard (CounterCard components)
```

**What You'll See:**
- Live counter cards updating every 5 seconds
- Status colors: green (normal), yellow (busy), red (critical)
- Real-time queue sizes from camera feed

---

### 2️⃣ LSTM → Predictions → Backend → PredictionCard
```
Historical Data (last 60 records)
  ↓ (Backend fetches from MongoDB)
LSTM Model (Flask /predict)
  ↓ (Returns predicted queue size)
Backend (/api/queue/predict)
  ↓ (GET every 30s)
PredictionCard (shows prediction + rush level)
```

**What You'll See:**
- "Next 15 mins" prediction
- Expected queue size
- Rush level: Low/Medium/High
- Confidence percentage
- AI recommendation

---

### 3️⃣ OR-Tools → Staff Optimization → Backend → Dashboard
```
Queue Data + Staff Availability
  ↓ (Backend collects)
OR-Tools Optimizer (Flask /optimize)
  ↓ (Returns optimal assignments)
Backend (/api/allocate/now)
  ↓ (Saves allocation)
Manager Reviews on Dashboard
  ↓ (Clicks "Apply")
Staff Assignments + WhatsApp Notifications
```

**What You'll See:**
- Optimization recommendations
- Staff-to-counter assignments
- Priority levels
- Cost calculations
- Application success/failure

---

### 4️⃣ Backend → WhatsApp Service → Staff Notifications
```
Allocation Applied (/api/allocate/:id/apply)
  ↓ (For each staff member)
WhatsApp Service (Meta Business API)
  ↓ (Sends message)
Staff Phone
```

**Message Format:**
```
Hi [Name]! You've been assigned to Counter [X].
Please proceed there immediately.
Priority: [High/Normal]
Reason: [Queue overload / Optimized allocation]
```

---

## 🧪 Test Integration

### Quick Test
```bash
# Run automated integration tests
python test-integration.py
```

### Manual Tests

#### Test 1: Queue Update
```bash
curl -X POST http://localhost:5000/api/queue/update/batch \
  -H "Content-Type: application/json" \
  -d '{"queues":[{"counterId":"1","queueSize":12,"averageWaitTime":36}]}'
```

#### Test 2: Get Live Data
```bash
curl http://localhost:5000/api/queue/live
```

#### Test 3: Get Prediction
```bash
curl http://localhost:5000/api/queue/predict?minutesAhead=15
```

#### Test 4: Generate Allocation
```bash
curl -X POST http://localhost:5000/api/allocate/now
```

---

## 📊 Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Main dashboard |
| Backend | http://localhost:5000 | REST API |
| AI Engine | http://localhost:8000 | Flask ML APIs |

---

## 🔧 Environment Setup

### Backend (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/queue-intelligence
PYTHON_API_URL=http://localhost:8000

# Optional: WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_TOKEN=your_access_token
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
NEXT_PUBLIC_AI_ENGINE_URL=http://localhost:8000
```

---

## 🐛 Common Issues

### "AI Engine not responding"
```bash
# Check if Flask is running
curl http://localhost:8000/health

# Restart
cd ai-engine
conda activate queue-ai
python api/flask_server.py
```

### "Backend can't reach AI Engine"
- Check `PYTHON_API_URL` in backend/.env
- Should be: `http://localhost:8000`
- Verify Flask is running on port 8000

### "No queue data showing"
- Start queue detection: `python queue_detection/detect_queue.py --backend http://localhost:5000`
- Or manually insert test data (see Test 1 above)

### "Predictions not working"
- Need at least 10 historical records
- Run queue detection for 2-3 minutes first
- Check backend logs for errors

---

## ✅ Integration Checklist

- [ ] All services start successfully
- [ ] AI Engine responds to health check
- [ ] Backend connects to AI Engine
- [ ] Frontend displays live queue data
- [ ] Queue detection sends data to backend
- [ ] Predictions show in PredictionCard
- [ ] Optimization generates recommendations
- [ ] WhatsApp sends (or mock mode works)
- [ ] Dashboard updates in real-time

---

## 📈 Performance Expectations

- **Queue Detection:** ~30 FPS
- **Backend Updates:** Every 5 seconds
- **Frontend Refresh:** 5s (queue), 30s (predictions)
- **Prediction Time:** ~200ms
- **Optimization Time:** ~500ms
- **Total Latency:** < 1 second (detection → display)

---

## 📚 Full Documentation

See [README_INTEGRATION.md](./README_INTEGRATION.md) for complete details.

---

## 🎉 Success Criteria

✅ Live queue data from YOLO displayed on dashboard  
✅ AI predictions updating every 30 seconds  
✅ Staff optimization recommendations generated  
✅ WhatsApp notifications sent on allocation  

**PHASE 4 COMPLETE!** 🚀
