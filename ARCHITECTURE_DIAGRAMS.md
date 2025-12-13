# System Architecture & Data Flow Diagrams

## 1. High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAMERA FEED                               │
│                    (Queue Monitoring)                            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI ENGINE (Python)                            │
│                    Port: 8000                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │     YOLO     │  │     LSTM     │  │   OR-Tools   │          │
│  │Queue Detection│  │  Prediction  │  │ Optimization │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Flask REST API                                                  │
│  • /health                                                       │
│  • /predict     (LSTM predictions)                              │
│  • /optimize    (Staff allocation)                              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND (Node.js/Express)                      │
│                    Port: 3001                                    │
├─────────────────────────────────────────────────────────────────┤
│  Controllers:                Services:                           │
│  • queueController          • predictionService                  │
│  • allocationController     • optimizeService                    │
│  • staffController          • whatsappService                    │
│                                                                  │
│  REST API Endpoints:                                             │
│  • /api/queue/*    (Queue data management)                      │
│  • /api/allocate/* (Staff allocation)                           │
│  • /api/staff/*    (Staff management)                           │
└─────────┬──────────────────────────────┬────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│    MongoDB       │          │  WhatsApp Business   │
│                  │          │       API            │
│  Collections:    │          │                      │
│  • queuerecords  │          │  Staff Notifications │
│  • allocations   │          └──────────────────────┘
│  • staff         │
└──────────────────┘
          │
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js/React)                       │
│                    Port: 3000                                    │
├─────────────────────────────────────────────────────────────────┤
│  Pages:                       Components:                        │
│  • /dashboard                 • CounterCard                      │
│  • /staff                     • PredictionCard                   │
│  • /settings                  • QueueGraph                       │
│                               • StaffTable                       │
│                                                                  │
│  API Clients:                                                    │
│  • queueApi.ts                                                   │
│  • allocationApi.ts                                              │
│  • staffApi.ts                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Integration Flow 1: YOLO → Backend → Frontend

```
┌──────────────┐
│ Camera Feed  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  YOLO Detection (detect_queue.py)        │
│                                          │
│  1. Detect people with YOLO              │
│  2. Assign to counter zones              │
│  3. Count per counter                    │
│                                          │
│  Output: {"1": 12, "2": 8, "3": 15}     │
└──────┬───────────────────────────────────┘
       │ POST /api/queue/update/batch
       │ Every 5 seconds
       ▼
┌──────────────────────────────────────────┐
│  Backend Queue Controller                │
│                                          │
│  1. Receive queue counts                 │
│  2. Determine status (normal/busy/critical)│
│  3. Save to MongoDB                      │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│    MongoDB       │
│  QueueRecord     │
│  Collection      │
└──────┬───────────┘
       │
       │ GET /api/queue/live
       │ Poll every 5 seconds
       ▼
┌──────────────────────────────────────────┐
│  Frontend Dashboard                      │
│                                          │
│  1. Fetch live queue data                │
│  2. Update CounterCard components        │
│  3. Display with status colors           │
│                                          │
│  🟢 Normal  🟡 Busy  🔴 Critical        │
└──────────────────────────────────────────┘
```

---

## 3. Integration Flow 2: LSTM → Backend → PredictionCard

```
┌──────────────────┐
│    MongoDB       │
│  Historical      │
│  Queue Data      │
│  (Last 60 pts)   │
└──────┬───────────┘
       │
       │ Backend fetches
       ▼
┌──────────────────────────────────────────┐
│  Backend Prediction Service              │
│                                          │
│  1. Get historical data (last 60)        │
│  2. Format for LSTM                      │
│  3. Call Flask API                       │
└──────┬───────────────────────────────────┘
       │ POST /predict
       │ {"data": [...], "minutes_ahead": 15}
       ▼
┌──────────────────────────────────────────┐
│  Flask AI Engine - LSTM                  │
│                                          │
│  1. Load trained LSTM model              │
│  2. Scale input data                     │
│  3. Predict future queue length          │
│  4. Calculate confidence                 │
│                                          │
│  Output: {                               │
│    "predicted_queue": 28.5,              │
│    "confidence": 0.85,                   │
│    "minutes_ahead": 15                   │
│  }                                       │
└──────┬───────────────────────────────────┘
       │
       │ Return prediction
       ▼
┌──────────────────────────────────────────┐
│  Backend Queue Controller                │
│                                          │
│  1. Receive prediction                   │
│  2. Detect rush trend                    │
│  3. Return to frontend                   │
└──────┬───────────────────────────────────┘
       │
       │ GET /api/queue/predict
       │ Poll every 30 seconds
       ▼
┌──────────────────────────────────────────┐
│  Frontend PredictionCard                 │
│                                          │
│  Display:                                │
│  • Expected queue size                   │
│  • Rush level (low/medium/high)          │
│  • AI recommendation                     │
│  • Confidence percentage                 │
│                                          │
│  "Next 15 mins: 28 customers"           │
│  "High rush - Open 2 more counters"     │
│  "89% confident"                         │
└──────────────────────────────────────────┘
```

---

## 4. Integration Flow 3: OR-Tools → Backend → WhatsApp

```
┌──────────────────┐     ┌──────────────────┐
│  Queue Data      │     │  Staff Data      │
│  (Current Load)  │     │  (Available)     │
└──────┬───────────┘     └──────┬───────────┘
       │                        │
       └────────┬───────────────┘
                │
                ▼
┌──────────────────────────────────────────┐
│  Backend Allocation Controller           │
│                                          │
│  POST /api/allocate/now                  │
│                                          │
│  1. Fetch current queue data             │
│  2. Fetch available staff                │
│  3. Format for optimization              │
└──────┬───────────────────────────────────┘
       │ POST /optimize
       │ {staff: [...], counters: [...], queue_load: {...}}
       ▼
┌──────────────────────────────────────────┐
│  Flask AI Engine - OR-Tools              │
│                                          │
│  1. Define decision variables            │
│  2. Apply constraints:                   │
│     • Skill matching                     │
│     • Working hours                      │
│     • Budget limits                      │
│     • Counter capacity                   │
│  3. Optimize using CP-SAT solver         │
│                                          │
│  Output: {                               │
│    "allocations": [                      │
│      {staff: "S1", counter: 1, ...},     │
│      {staff: "S2", counter: 3, ...}      │
│    ],                                    │
│    "total_cost": 240.0,                  │
│    "status": "optimal"                   │
│  }                                       │
└──────┬───────────────────────────────────┘
       │
       │ Return optimization
       ▼
┌──────────────────────────────────────────┐
│  Backend Allocation Controller           │
│                                          │
│  1. Save allocation to MongoDB           │
│  2. Status: "pending"                    │
│  3. Return to frontend                   │
└──────┬───────────────────────────────────┘
       │
       │ Display on Dashboard
       ▼
┌──────────────────────────────────────────┐
│  Frontend Dashboard                      │
│                                          │
│  Manager reviews:                        │
│  • Staff assignments                     │
│  • Priority levels                       │
│  • Cost breakdown                        │
│                                          │
│  [Apply Allocation] button               │
└──────┬───────────────────────────────────┘
       │
       │ POST /api/allocate/:id/apply
       ▼
┌──────────────────────────────────────────┐
│  Backend Allocation Controller           │
│                                          │
│  For each staff assignment:              │
│  1. Update staff record                  │
│  2. Set currentCounter                   │
│  3. Set availability = "busy"            │
│  4. Send WhatsApp notification           │
└──────┬───────────────────────────────────┘
       │
       │ For each staff with phone
       ▼
┌──────────────────────────────────────────┐
│  WhatsApp Service                        │
│                                          │
│  1. Format message:                      │
│     "Hi [Name]! You've been assigned     │
│      to Counter [X]. Please proceed      │
│      there immediately."                 │
│                                          │
│  2. Call Meta Business API               │
│  3. Send via WhatsApp                    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────┐
│  Staff Phone     │
│  📱 WhatsApp     │
│  Notification    │
└──────────────────┘
```

---

## 5. Complete System State Flow

```
Time: T+0s
  Camera → YOLO Detection
  ↓
  Queue Counts: {1: 12, 2: 8, 3: 15}
  ↓
  Backend saves to MongoDB

Time: T+5s
  Frontend polls backend
  ↓
  Dashboard updates:
  Counter 1: 12 🟢
  Counter 2: 8 🟢
  Counter 3: 15 🟡

Time: T+30s
  Backend requests prediction
  ↓
  LSTM predicts: 28 people in 15 mins
  ↓
  PredictionCard shows:
  "High rush expected! 🔴"

Time: T+35s
  Backend generates allocation
  ↓
  OR-Tools optimizes:
  S1 → Counter 3 (busy)
  S2 → Counter 1 (backup)
  ↓
  Dashboard shows recommendation

Time: T+40s
  Manager clicks "Apply"
  ↓
  Backend assigns staff
  ↓
  WhatsApp sends 2 messages
  ↓
  Staff receives notifications

Time: T+45s
  Staff moves to assigned counters
  ↓
  Queue starts decreasing
  ↓
  System continues monitoring...
```

---

## 6. Technology Stack Layers

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│                                         │
│  Next.js 14 + React + TypeScript        │
│  Tailwind CSS + shadcn/ui               │
│  Real-time polling (5s/30s intervals)   │
└─────────────────┬───────────────────────┘
                  │ HTTP REST API
                  ▼
┌─────────────────────────────────────────┐
│         APPLICATION LAYER               │
│                                         │
│  Node.js + Express                      │
│  Controllers + Services + Routes        │
│  JWT Authentication (optional)          │
└─────────────┬──────────┬────────────────┘
              │          │
              ▼          ▼
┌──────────────────┐  ┌──────────────────┐
│   DATA LAYER     │  │   AI/ML LAYER    │
│                  │  │                  │
│  MongoDB         │  │  Python + Flask  │
│  Mongoose ODM    │  │  TensorFlow/Keras│
│  3 Collections:  │  │  YOLO (PyTorch)  │
│  • queuerecords  │  │  OR-Tools        │
│  • allocations   │  │                  │
│  • staff         │  └──────────────────┘
└──────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│      EXTERNAL INTEGRATIONS              │
│                                         │
│  • WhatsApp Business API (Meta)         │
│  • IP Cameras / Video Streams           │
│  • SMS Gateway (optional)               │
└─────────────────────────────────────────┘
```

---

## 7. Request/Response Flow Example

### Example: Get Live Queue Data with Prediction

```
User opens Dashboard
  │
  ├─→ Request 1: GET /api/queue/live
  │     │
  │     ├─→ Backend queries MongoDB
  │     │     ↓
  │     │   Finds latest records per counter
  │     │     ↓
  │     └─→ Response: {
  │           success: true,
  │           data: [
  │             {counterId: 1, queueSize: 12, status: "normal"},
  │             {counterId: 2, queueSize: 8, status: "normal"},
  │             {counterId: 3, queueSize: 16, status: "busy"}
  │           ]
  │         }
  │
  └─→ Request 2: GET /api/queue/predict?minutesAhead=15
        │
        ├─→ Backend queries MongoDB for history
        │     ↓
        │   Gets last 60 records
        │     ↓
        ├─→ Backend calls Flask: POST /predict
        │     │
        │     ├─→ Flask loads LSTM model
        │     │     ↓
        │     │   Predicts: 28.5
        │     │     ↓
        │     └─→ Response: {
        │           predicted_queue: 28.5,
        │           confidence: 0.85
        │         }
        │
        └─→ Response: {
              success: true,
              prediction: {
                predicted_queue: 28.5,
                confidence: 0.85,
                minutes_ahead: 15
              },
              rushTrend: {
                isRush: true,
                confidence: 0.75
              }
            }

Dashboard renders:
  ✅ 3 CounterCards with live data
  ✅ PredictionCard showing "High rush - 28 customers expected"
```

---

## 8. Error Handling & Fallback

```
Frontend Request
  ↓
Backend receives
  ↓
├─→ Try: Call Flask AI Engine
│   ├─→ Success: Return AI result
│   └─→ Fail (ECONNREFUSED):
│       ↓
│       Use Mock/Fallback:
│       • Simple moving average
│       • Greedy allocation
│       • Return with algorithm: "mock"
│       ↓
│       Log warning
│       ↓
│       Return to frontend
│
Frontend displays
  ├─→ If success: Show data
  └─→ If error: Show error alert
```

This ensures system continues working even if AI Engine is down!

---

**All diagrams represent the INTEGRATED Phase 4 system!** ✅
