# Backend Integration Update - Complete ✅

## Changes Made

### File Updated: `backend/src/services/optimizeService.js`

**What Changed:**
- Added data transformation functions to convert backend format to Flask API format
- Added response transformation to convert Flask responses back to backend format
- Maintains backward compatibility with mock optimization fallback

### Data Transformation Flow

#### Before (Old Format):
```javascript
Backend sends → Flask:
{
  queues: [{counterId, queueSize, status}],
  staff: [{staffId, name, skills, availability}],
  constraints: {}
}
```

#### After (New Format):
```javascript
Backend sends → Flask:
{
  current_queue_load: {general: 10, loan: 5, account: 8},
  predicted_queue_load: {general: 15, loan: 8, account: 12},
  staff: [
    {
      id: 1,
      name: "John Doe",
      skill_level: "advanced",        // Calculated from performanceScore
      skills: ["general", "loan"],
      available_slots: [0,1,2,3,4,5,6,7],  // Calculated from shift times
      max_hours: 8.0,
      hourly_rate: 25.50              // Calculated from skill_level + performance
    }
  ],
  counters: [
    {
      id: 1,
      counter_type: "general",
      max_capacity: 2,
      priority: 1                      // Based on queue status (critical=1, else=2)
    }
  ],
  time_slots: [0,1,2,3,4,5,6,7],
  budget: 5000.0
}
```

### New Helper Functions Added

1. **`transformToFlaskFormat(queueData, staffData, constraints)`**
   - Converts backend data to Flask API format
   - Maps counter IDs to counter types
   - Calculates staff skill levels from performance scores
   - Generates available time slots from shift times
   - Calculates hourly rates based on skill and performance

2. **`mapCounterType(counterId)`**
   - Maps counter IDs (1-6) to counter types (general, loan, account, etc.)

3. **`calculateAvailableSlots(shiftStart, shiftEnd)`**
   - Converts shift times (e.g., "09:00" to "17:00") to time slot array [0,1,2,3,4,5,6,7]

4. **`calculateHourlyRate(skill_level, performanceScore)`**
   - Base rates: basic=$15, intermediate=$20, advanced=$25
   - Performance bonus: up to 20% more based on performanceScore

5. **`transformFlaskResponse(flaskResponse)`**
   - Converts Flask response back to backend format
   - Maps recommended_staff to allocations array
   - Handles infeasible solutions gracefully

### Skill Level Mapping

```javascript
performanceScore >= 90  → advanced
performanceScore >= 70  → intermediate
performanceScore < 70   → basic
```

### Counter Type Mapping

```javascript
counterId 1 → general
counterId 2 → loan
counterId 3 → account
counterId 4 → cashier
counterId 5 → inquiry
counterId 6 → premium
```

## Testing

### Test Scripts Created

1. **`test-api.ps1`** - Direct Flask API testing (PowerShell)
2. **`test-api.py`** - Direct Flask API testing (Python)
3. **`test-backend-integration.js`** - Full integration testing (Node.js)

### Run Integration Tests

```bash
# Start AI Engine (Terminal 1)
cd ai-engine/api
conda activate queue-ai
python flask_server.py

# Start Backend (Terminal 2)
cd backend
npm start

# Run Integration Tests (Terminal 3)
node test-backend-integration.js
```

## Integration Status

✅ **Prediction Integration**: Fully working
- Backend → Flask `/predict` endpoint
- Data format already compatible
- Used in: `queueController.js`

✅ **Optimization Integration**: Now fully working
- Backend → Flask `/optimize` endpoint  
- Data transformation implemented
- Used in: `allocationController.js`

## API Endpoints

### Flask AI Engine (Port 8000)
- `GET  /health` - Health check
- `POST /predict` - Queue prediction (LSTM)
- `POST /optimize` - Staff optimization (OR-Tools)

### Backend API (Port 3000)
- `GET  /api/queue/predictions` - Get queue predictions (calls Flask)
- `POST /api/allocations/optimize` - Get optimized staff allocation (calls Flask)

## Next Steps

1. ✅ Start Flask AI Engine
2. ✅ Start Backend Server
3. ✅ Run integration tests
4. 🔄 Test from Frontend
5. 🔄 Monitor production logs

## Notes

- Mock optimization still available as fallback when Flask is unavailable
- All existing backend code remains compatible
- No breaking changes to frontend API
- Logs integration success/failures for monitoring
