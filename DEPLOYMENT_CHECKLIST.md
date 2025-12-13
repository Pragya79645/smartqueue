# 🚀 Deployment Checklist - Queue Intelligence System

## Pre-Deployment Setup

### 1. Environment Verification
- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed
- [ ] MongoDB running (local or Atlas)
- [ ] pnpm installed (`npm install -g pnpm`)
- [ ] conda/miniconda installed

### 2. Dependencies Installation

#### AI Engine
```bash
cd ai-engine
conda create -n queue-ai python=3.9
conda activate queue-ai
pip install -r requirements.txt
```
- [ ] TensorFlow installed
- [ ] PyTorch installed
- [ ] OR-Tools installed
- [ ] Flask + dependencies installed
- [ ] Test: `python -c "import tensorflow; import torch; import ortools"`

#### Backend
```bash
cd backend
pnpm install
```
- [ ] All npm packages installed
- [ ] MongoDB connection string configured
- [ ] Test: `pnpm run dev` starts without errors

#### Frontend
```bash
cd frontend
pnpm install
```
- [ ] All npm packages installed
- [ ] Test: `pnpm run dev` starts without errors

---

## Configuration

### 1. Backend Environment (.env)
```env
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/queue-intelligence

# AI Engine
PYTHON_API_URL=http://localhost:8000

# WhatsApp (Optional)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_PHONE_ID=your_phone_id_here
WHATSAPP_TOKEN=your_access_token_here

# Security (Optional)
JWT_SECRET=your_jwt_secret_here
```

**Checklist:**
- [ ] `.env` file created in `backend/`
- [ ] MongoDB URI configured correctly
- [ ] PYTHON_API_URL points to AI Engine
- [ ] WhatsApp credentials added (if using)

### 2. Frontend Environment (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_AI_ENGINE_URL=http://localhost:8000
```

**Checklist:**
- [ ] `.env.local` file created in `frontend/`
- [ ] Backend URL configured
- [ ] AI Engine URL configured

### 3. Camera Configuration

Edit `ai-engine/queue_detection/detect_queue.py`:

```python
# Line ~80: Configure counter zones for your camera setup
self.counter_zones = {
    "1": (0, 0, 426, 720),      # Adjust coordinates
    "2": (427, 0, 853, 720),    # Based on camera view
    "3": (854, 0, 1280, 720)    # And counter layout
}
```

**Checklist:**
- [ ] Counter zones match physical layout
- [ ] Camera feed URL configured (if using IP camera)
- [ ] Test detection with `--display` flag

---

## Model Files Verification

### Required Model Files

```
ai-engine/models/
├── lstm_model.h5          # LSTM trained model
├── scaler.pkl             # Data scaler for LSTM
└── yolo_weights.pt        # YOLO weights (or yolov8n.pt)
```

**Checklist:**
- [ ] LSTM model exists (`lstm_model.h5`)
- [ ] Scaler exists (`scaler.pkl`)
- [ ] YOLO weights exist (`.pt` file)
- [ ] All models load without errors

**If models missing:**
```bash
# Train LSTM (requires historical data)
cd ai-engine/prediction
python train_lstm.py

# Download YOLO
# YOLOv8 will auto-download on first run
```

---

## Database Setup

### MongoDB Collections

Required collections:
1. `queuerecords` - Queue history
2. `allocations` - Staff allocations
3. `staff` - Staff information

**Checklist:**
- [ ] MongoDB service running
- [ ] Database `queue-intelligence` created
- [ ] Collections auto-created on first insert
- [ ] Test connection: `mongosh mongodb://localhost:27017/queue-intelligence`

### Seed Data (Optional)

```bash
cd backend
node scripts/seed-staff.js  # If you have this script
```

Or manually insert test staff via API:
```bash
curl -X POST http://localhost:3001/api/staff \
  -H "Content-Type: application/json" \
  -d '{
    "staffId": "S001",
    "name": "John Doe",
    "skills": ["registration", "billing"],
    "availability": "available",
    "phone": "+1234567890"
  }'
```

---

## Startup Sequence

### Option 1: Automated (Recommended)
```bash
# Windows
start-all.bat

# Linux/Mac
chmod +x start-all.sh
./start-all.sh
```

**Checklist:**
- [ ] All 3 services start
- [ ] No error messages in terminals
- [ ] All ports accessible

### Option 2: Manual

**Terminal 1 - AI Engine:**
```bash
cd ai-engine
conda activate queue-ai
python api/flask_server.py
```
- [ ] Server starts on port 8000
- [ ] "Models loaded successfully" message appears
- [ ] Health check responds: `curl http://localhost:8000/health`

**Terminal 2 - Backend:**
```bash
cd backend
pnpm run dev
```
- [ ] Server starts on port 3001
- [ ] MongoDB connected successfully
- [ ] API responds: `curl http://localhost:3001/api/queue/live`

**Terminal 3 - Frontend:**
```bash
cd frontend
pnpm run dev
```
- [ ] Server starts on port 3000
- [ ] Opens in browser automatically
- [ ] No console errors

**Terminal 4 - Queue Detection (Optional):**
```bash
cd ai-engine
conda activate queue-ai
python queue_detection/detect_queue.py --backend http://localhost:3001 --display
```
- [ ] Camera feed opens
- [ ] Detections visible
- [ ] Data sent to backend every 5s

---

## Integration Testing

### 1. Health Checks
```bash
# AI Engine
curl http://localhost:8000/health
# Expected: {"status": "healthy", ...}

# Backend
curl http://localhost:3001/api/queue/live
# Expected: {"success": true, ...}

# Frontend
curl http://localhost:3000
# Expected: HTML response
```

**Checklist:**
- [ ] AI Engine health check passes
- [ ] Backend API responds
- [ ] Frontend loads

### 2. Data Flow Tests

**Test Queue Update:**
```bash
curl -X POST http://localhost:3001/api/queue/update/batch \
  -H "Content-Type: application/json" \
  -d '{"queues":[
    {"counterId":"1","queueSize":12,"averageWaitTime":36},
    {"counterId":"2","queueSize":8,"averageWaitTime":24}
  ]}'
```
- [ ] Returns success
- [ ] Data saved to MongoDB
- [ ] Visible on dashboard

**Test Prediction:**
```bash
curl http://localhost:3001/api/queue/predict?minutesAhead=15
```
- [ ] Returns prediction (or error if insufficient data)
- [ ] Confidence score included

**Test Optimization:**
```bash
curl -X POST http://localhost:3001/api/allocate/now
```
- [ ] Returns allocation recommendation
- [ ] Shows staff assignments

### 3. Run Automated Tests
```bash
python test-integration.py
```

**Expected Results:**
- [ ] ✓ All 6 tests pass
- [ ] Services respond correctly
- [ ] Data flows end-to-end

---

## Frontend Verification

Open http://localhost:3000/dashboard

**Visual Checklist:**
- [ ] Dashboard loads without errors
- [ ] Counter cards visible
- [ ] Live queue data displays (if detection running)
- [ ] Prediction card shows (after some data collected)
- [ ] Navigation works (Dashboard, Staff, Settings)
- [ ] No console errors in browser DevTools

---

## Common Issues & Solutions

### Issue: AI Engine fails to start
**Symptoms:** Import errors, model not found
**Solutions:**
```bash
# Verify conda environment
conda activate queue-ai
pip list | grep tensorflow

# Reinstall if needed
pip install -r requirements.txt --force-reinstall
```

### Issue: Backend can't connect to MongoDB
**Symptoms:** "MongoServerError: connect ECONNREFUSED"
**Solutions:**
```bash
# Check MongoDB is running
mongosh

# Start MongoDB (varies by OS)
# Windows: net start MongoDB
# Linux: sudo systemctl start mongod
# Mac: brew services start mongodb-community
```

### Issue: Backend can't reach AI Engine
**Symptoms:** "ECONNREFUSED" in backend logs
**Solutions:**
- [ ] Check AI Engine is running: `curl http://localhost:8000/health`
- [ ] Verify `PYTHON_API_URL` in backend/.env
- [ ] Check firewall isn't blocking port 8000

### Issue: Frontend shows no data
**Symptoms:** Empty counter cards, "Loading..."
**Solutions:**
- [ ] Check backend is running
- [ ] Insert test data (see Data Flow Tests)
- [ ] Check browser console for errors
- [ ] Verify `NEXT_PUBLIC_BACKEND_URL` in frontend/.env.local

### Issue: Queue detection not sending data
**Symptoms:** No updates on dashboard
**Solutions:**
- [ ] Check `--backend` URL in detection command
- [ ] Verify camera feed working (use `--display`)
- [ ] Check backend logs for incoming requests
- [ ] Test with manual curl (see Data Flow Tests)

### Issue: WhatsApp not sending
**Symptoms:** "WhatsApp credentials not configured" in logs
**Solutions:**
- [ ] Add credentials to backend/.env
- [ ] Or accept mock mode (messages logged only)
- [ ] Verify Meta Business API token valid

---

## Production Deployment (Future)

### Additional Requirements for Production:

**Security:**
- [ ] Use environment variables (not .env files)
- [ ] Enable HTTPS/SSL
- [ ] Add JWT authentication
- [ ] Restrict CORS origins
- [ ] Use MongoDB Atlas (not local)

**Scaling:**
- [ ] Deploy AI Engine with load balancer
- [ ] Use PM2 for backend process management
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Add Redis for caching
- [ ] Set up monitoring (e.g., Prometheus + Grafana)

**Models:**
- [ ] Retrain LSTM with production data
- [ ] Fine-tune YOLO for your specific environment
- [ ] Implement model versioning
- [ ] Set up automated retraining pipeline

---

## Final Verification Checklist

- [ ] All services start without errors
- [ ] Health checks pass
- [ ] Queue detection sends data to backend
- [ ] Backend saves to MongoDB
- [ ] Frontend displays live data
- [ ] Predictions generated (after collecting data)
- [ ] Optimization generates allocations
- [ ] WhatsApp integration works (or mock mode)
- [ ] No console errors anywhere
- [ ] Integration tests pass

---

## Success Criteria ✅

**System is ready when:**

1. ✅ **All services running**
   - AI Engine on port 8000
   - Backend on port 3001
   - Frontend on port 3000

2. ✅ **Data flowing**
   - YOLO → Backend → Frontend
   - Historical data → LSTM → Predictions
   - Queue + Staff → OR-Tools → Allocations

3. ✅ **Dashboard functional**
   - Live counter cards updating
   - Prediction card showing forecast
   - Staff management working

4. ✅ **Integration tests passing**
   - Run `python test-integration.py`
   - All 6 tests show ✓

---

## Support & Documentation

- **Quick Start:** [INTEGRATION_QUICKSTART.md](./INTEGRATION_QUICKSTART.md)
- **Full Guide:** [README_INTEGRATION.md](./README_INTEGRATION.md)
- **Architecture:** [ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)
- **Main README:** [README.md](./README.md)

---

**Deployment Status:** Ready for Development Environment ✅
**Next Steps:** Run tests, collect data, train models with real data
