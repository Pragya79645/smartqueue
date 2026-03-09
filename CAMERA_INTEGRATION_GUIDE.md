# Live Camera Integration Guide

## Overview

Your system now supports **real-time camera feed processing** with AI-powered queue detection! The camera feed from your browser will be captured, processed by YOLO for person detection, and displayed with bounding boxes showing detected people and queue counts.

## Features Implemented

✅ **Live Webcam Capture** - Access your computer's camera directly from the browser
✅ **Real-time AI Processing** - Frames are sent to backend → AI engine → YOLO detection
✅ **Visual Bounding Boxes** - See detected people with confidence scores overlaid on video
✅ **Counter Assignment** - People are automatically assigned to counters based on their position
✅ **Queue Status** - Real-time counter status (Normal/Busy/Critical) based on queue size
✅ **Database Recording** - Detection results are automatically saved to MongoDB

## How It Works

```
Frontend (Browser Camera) 
    ↓ Captures frame every 1 second
    ↓ Converts to base64 image
Backend API (/api/ai/process-frame)
    ↓ Forwards frame
AI Engine (/detect-frame)
    ↓ YOLO Detection
    ↓ Person detection & counter assignment
    ↑ Returns detections with bounding boxes
Backend
    ↑ Saves to database
    ↑ Returns results
Frontend
    ↑ Displays bounding boxes and stats
```

## Setup Instructions

### 1. Install AI Engine Dependencies

Navigate to the AI engine directory and install dependencies:

```bash
cd ai-engine
conda activate queue-ai  # Or your Python environment
pip install -r api/requirements.txt
```

This will install:
- `opencv-python` - For image processing
- `ultralytics` - For YOLOv8 model
- `Pillow` - For image handling

### 2. Start All Services

You can use the existing start script:

```bash
# Windows
start-all.bat

# Or start services individually:
# Terminal 1 - MongoDB (should already be running)
# Terminal 2 - AI Engine
cd ai-engine
python api/flask_server.py

# Terminal 3 - Backend
cd backend
pnpm run dev

# Terminal 4 - Frontend
cd frontend
pnpm dev
```

### 3. Configure Camera in Settings

1. Open the application: http://localhost:3000
2. Go to **Settings** page
3. Set Camera URL to one of:
   - `webcam` or `0` - Use your computer's webcam
   - `http://camera-url/stream` - For IP cameras (if available)
4. Save settings

### 4. View Live Detection

1. Go to the **Dashboard** page
2. You should see the camera feed card
3. Click **"Start Camera"** if prompted to allow camera access
4. Grant camera permissions when browser asks
5. The feed will start and you'll see:
   - 🟢 Green bounding boxes around detected people
   - Confidence scores (e.g., "Person 92%")
   - Total people count at the bottom
   - Counter-wise breakdown with status colors:
     - 🟢 Green = Normal (0-4 people)
     - 🟡 Yellow = Busy (5-8 people)
     - 🔴 Red = Critical (9+ people)

## Counter Zones

By default, the frame is divided into 3 vertical zones representing 3 counters:

- **Counter 1**: Left third of the screen
- **Counter 2**: Middle third
- **Counter 3**: Right third

People are assigned to counters based on where their center point falls.

## Customization Options

### Adjust Processing Interval

In `camera-feed.tsx`, line ~90:
```typescript
// Currently processes 1 frame per second
processingIntervalRef.current = setInterval(async () => {
    // ... processing code
}, 1000)  // Change this value (in milliseconds)
```

- Lower value = More frequent updates, higher CPU/bandwidth usage
- Higher value = Less frequent updates, lower resource usage
- Recommended: 500-2000ms (0.5-2 seconds)

### Configure Counter Zones

You can customize counter positions by modifying the default zones in the backend request or AI engine endpoint. Currently defined in `flask_server.py`:

```python
counter_zones = {
    "1": [0, 0, width // 3, height],        # x1, y1, x2, y2
    "2": [width // 3, 0, 2 * width // 3, height],
    "3": [2 * width // 3, 0, width, height]
}
```

### Adjust Detection Confidence

In `flask_server.py`, line ~570:
```python
if cls_id == 0 and conf > 0.5:  # Change 0.5 to adjust threshold
```

- Lower threshold (e.g., 0.3) = More detections, more false positives
- Higher threshold (e.g., 0.7) = Fewer detections, more accurate

## Technical Details

### API Endpoints

**POST /api/ai/process-frame** (Backend)
```json
Request:
{
  "frame": "base64_encoded_image",
  "camera_id": "webcam",
  "counter_zones": {...}  // Optional
}

Response:
{
  "success": true,
  "detections": [
    {
      "class": "person",
      "confidence": 0.92,
      "bbox": [100, 150, 200, 400],
      "counter": "1"
    }
  ],
  "counters": {
    "1": {"count": 2, "status": "normal"},
    "2": {"count": 5, "status": "busy"},
    "3": {"count": 1, "status": "normal"}
  },
  "total_people": 8,
  "frame_size": [1280, 720],
  "timestamp": "2026-03-10T10:30:00Z"
}
```

### Database Schema

Detection results are saved to the `QueueRecord` collection:
```javascript
{
  counterId: Number,
  queueSize: Number,
  averageWaitTime: Number,  // Estimated as count * 3 minutes
  timestamp: Date
}
```

## Troubleshooting

### Camera Not Starting
- **Check permissions**: Browser must have camera access
- **Check if camera is in use**: Close other apps using the camera
- **Try a different browser**: Chrome/Edge work best

### Detection Not Working
- **Check logs**: Look at AI engine terminal for errors
- **Verify YOLO model**: Should auto-download on first run
- **Check internet**: Model download requires internet

### High CPU/Memory Usage
- **Increase interval**: Set to 2000ms or higher
- **Lower video resolution**: Modify camera constraints in `camera-feed.tsx`
- **Check other processes**: Close unnecessary applications

### No Detections Appearing
- **Ensure good lighting**: Camera needs adequate light
- **Check distance**: People should be clearly visible
- **Verify AI engine is running**: Check http://localhost:8000/health

## Performance Tips

1. **Optimal Lighting**: Ensure the area is well-lit for best detection accuracy
2. **Camera Position**: Mount camera at an angle to see faces and full bodies
3. **Processing Interval**: Balance between real-time updates and system resources
4. **Network**: Keep all services on localhost for fastest processing
5. **Hardware**: GPU acceleration for YOLO will significantly improve performance

## Next Steps

- Configure camera position for optimal counter coverage
- Adjust counter zones to match your physical setup
- Fine-tune detection confidence threshold
- Monitor database growth and set up cleanup routines
- Consider adding GPU support for faster processing

## Support

If you encounter issues:
1. Check that all services are running (MongoDB, AI Engine, Backend, Frontend)
2. Verify camera permissions in browser
3. Check console logs in browser developer tools
4. Check terminal logs for AI engine and backend
5. Ensure all dependencies are installed correctly

Enjoy your live AI-powered queue detection system! 🎥🤖📊
