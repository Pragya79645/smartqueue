"""
Flask API Server for AI Queue Prediction and Staff Optimization
Exposes AI logic as HTTP APIs for backend/frontend consumption
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import sys
import os
import time
import logging
import numpy as np
import cv2
import base64
from io import BytesIO
from PIL import Image

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prediction.predict import predict_next_queue_length, model, scaler
from optimization.staff_optimizer import (
    StaffOptimizer, OptimizationInput, StaffMember, Counter
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==========================================
#   INITIALIZE FLASK APP
# ==========================================
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# ==========================================
#   LOAD MODELS ONCE (Global)
# ==========================================
# Models are already loaded in predict.py:
# - LSTM model
# - Scaler
print("✓ Models loaded successfully")

# Initialize optimizer
optimizer = StaffOptimizer()
print("✓ Staff optimizer initialized")

# Load YOLO model for frame detection
try:
    from ultralytics import YOLO
    yolo_model = YOLO('yolov8n.pt')
    print("✓ YOLO model loaded for frame detection")
except Exception as e:
    logger.warning(f"YOLO model not loaded: {e}")
    yolo_model = None


# ==========================================
#   HEALTH CHECK ENDPOINT
# ==========================================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify API is running"""
    return jsonify({
        "status": "healthy",
        "message": "AI Engine API is running",
        "models_loaded": True
    }), 200


# ==========================================
#   PREDICT QUEUE LENGTH
# ==========================================
@app.route('/predict', methods=['POST'])
@app.route('/predict-queue', methods=['POST'])  # Backward compatibility
def predict_queue():
    """
    Predict next queue length based on historical data
    
    Request body:
    {
        "data": [...] or "last_60_values": [...],  # Historical queue data
        "minutes_ahead": 15  # Optional, default 15
    }
    
    Returns:
    {
        "success": true,
        "predicted_queue": 12,
        "predictions": [...],  # Per-counter predictions
        "confidence": 0.85,
        "minutes_ahead": 15,
        "timestamp": "..."
    }
    """
    try:
        data = request.get_json()
        
        # Handle both 'data' and 'last_60_values' keys for compatibility
        historical_data = data.get('data') or data.get('last_60_values')
        minutes_ahead = data.get('minutes_ahead', 15)
        
        # Validate input
        if not historical_data:
            return jsonify({
                "success": False,
                "error": "Missing required field: data or last_60_values"
            }), 400
        
        # Handle array of queue objects or simple array of values
        if isinstance(historical_data, list) and len(historical_data) > 0:
            if isinstance(historical_data[0], dict):
                # Extract queue sizes from objects
                queue_values = [item.get('queueSize', 0) for item in historical_data[-60:]]
            else:
                # Simple array of values
                queue_values = historical_data[-60:]
            
            # Pad with zeros if less than 60 values
            while len(queue_values) < 60:
                queue_values.insert(0, 0)
            
            # Truncate if more than 60 values
            queue_values = queue_values[-60:]
            
            # Make prediction
            from prediction.predict import predict_future_queue_length
            predicted_queue = predict_future_queue_length(queue_values, minutes_ahead)
            
            # Calculate confidence based on data variance
            # NOTE: LSTM doesn't provide native confidence scores
            # This is a heuristic based on rolling error/variance:
            # - Stable data (low variance) → High confidence
            # - Volatile data (high variance) → Low confidence
            variance = np.var(queue_values)
            confidence = min(0.95, max(0.6, 1.0 - (variance / 100)))
            
            return jsonify({
                "success": True,
                "predicted_queue": round(predicted_queue, 2),
                "predictions": [{
                    "counterId": "aggregate",
                    "currentSize": int(queue_values[-1]),
                    "predictedSize": round(predicted_queue, 2),
                    "confidence": round(confidence, 2),
                    "minutesAhead": minutes_ahead
                }],
                "confidence": round(confidence, 2),
                "minutes_ahead": minutes_ahead,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Invalid historical data format"
            }), 400
        
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==========================================
#   OPTIMIZE STAFF ALLOCATION
# ==========================================
@app.route('/optimize', methods=['POST'])
@app.route('/optimize-staff', methods=['POST'])  # Backward compatibility
def optimize_staff():
    """
    Optimize staff allocation based on queue load and constraints
    
    Request body:
    {
        "current_queue_load": {"registration": 10, "billing": 5},
        "predicted_queue_load": {"registration": 15, "billing": 8},
        "staff": [
            {
                "id": 1,
                "name": "Staff 1",
                "skill_level": "advanced",
                "skills": ["registration", "billing"],
                "available_slots": [0, 1, 2, 3, 4, 5, 6, 7],
                "max_hours": 8.0,
                "hourly_rate": 20.0
            }
        ],
        "counters": [
            {
                "id": 1,
                "counter_type": "registration",
                "max_capacity": 2,
                "priority": 1
            }
        ],
        "time_slots": [0, 1, 2, 3, 4, 5, 6, 7],
        "budget": 5000.0
    }
    
    Returns:
    {
        "predicted_queue": 12,
        "recommended_staff": [
            {
                "counter": 1,
                "staff_id": "S12",
                "staff_name": "Staff 1",
                "counter_type": "registration",
                "start_time": "09:00",
                "end_time": "17:00"
            }
        ],
        "total_cost": 160.0,
        "status": "optimal"
    }
    """
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['staff', 'counters', 'current_queue_load', 'time_slots']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "error": f"Missing required field: {field}"
                }), 400
        
        # Parse staff members
        staff_list = []
        for s in data['staff']:
            staff_member = StaffMember(
                id=s['id'],
                name=s['name'],
                skill_level=s.get('skill_level', 'basic'),
                skills=s.get('skills', []),
                available_slots=s.get('available_slots', []),
                max_hours=s.get('max_hours', 8.0),
                hourly_rate=s.get('hourly_rate', 15.0)
            )
            staff_list.append(staff_member)
        
        # Parse counters
        counter_list = []
        for c in data['counters']:
            counter = Counter(
                id=c['id'],
                counter_type=c['counter_type'],
                max_capacity=c.get('max_capacity', 2),
                priority=c.get('priority', 1)
            )
            counter_list.append(counter)
        
        # Create optimization input
        opt_input = OptimizationInput(
            staff=staff_list,
            counters=counter_list,
            current_queue_load=data['current_queue_load'],
            predicted_queue_load=data.get('predicted_queue_load', data['current_queue_load']),
            time_slots=data['time_slots'],
            budget=data.get('budget', 5000.0)
        )
        
        # Run optimization
        result = optimizer.optimize(opt_input)
        
        # Format response
        recommended_staff = []
        for assignment in result.assignments:
            recommended_staff.append({
                "counter": assignment.counter_id,
                "staff_id": f"S{assignment.staff_id}",
                "staff_name": assignment.staff_name,
                "counter_type": assignment.counter_type,
                "start_time": assignment.start_time,
                "end_time": assignment.end_time,
                "duration_hours": assignment.duration_hours,
                "cost": assignment.cost
            })
        
        # Calculate average predicted queue if available
        predicted_queue = None
        if 'predicted_queue_load' in data:
            predicted_queue = round(
                np.mean(list(data['predicted_queue_load'].values())), 2
            )
        
        response = {
            "recommended_staff": recommended_staff,
            "total_cost": round(result.total_cost, 2),
            "status": result.status,
            "solve_time": round(result.solve_time, 2)
        }
        
        if predicted_queue is not None:
            response["predicted_queue"] = predicted_queue
        
        return jsonify(response), 200
        
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


# ==========================================
#   COMBINED ENDPOINT (Predict + Optimize)
# ==========================================
@app.route('/predict-and-optimize', methods=['POST'])
def predict_and_optimize():
    """
    Combined endpoint: Predict queue and optimize staff allocation
    
    Request body:
    {
        "last_60_values": [12, 15, 18, ...],
        "staff": [...],
        "counters": [...],
        "current_queue_load": {...},
        "time_slots": [...]
    }
    
    Returns:
    {
        "predicted_queue": 12,
        "recommended_staff": [...]
    }
    """
    try:
        data = request.get_json()
        
        # Step 1: Predict queue
        predicted_queue = None
        if 'last_60_values' in data and len(data['last_60_values']) == 60:
            predicted_queue = predict_next_queue_length(data['last_60_values'])
        
        # Step 2: Optimize staff
        if all(field in data for field in ['staff', 'counters', 'current_queue_load', 'time_slots']):
            # Parse staff members
            staff_list = []
            for s in data['staff']:
                staff_member = StaffMember(
                    id=s['id'],
                    name=s['name'],
                    skill_level=s.get('skill_level', 'basic'),
                    skills=s.get('skills', []),
                    available_slots=s.get('available_slots', []),
                    max_hours=s.get('max_hours', 8.0),
                    hourly_rate=s.get('hourly_rate', 15.0)
                )
                staff_list.append(staff_member)
            
            # Parse counters
            counter_list = []
            for c in data['counters']:
                counter = Counter(
                    id=c['id'],
                    counter_type=c['counter_type'],
                    max_capacity=c.get('max_capacity', 2),
                    priority=c.get('priority', 1)
                )
                counter_list.append(counter)
            
            # Create optimization input
            opt_input = OptimizationInput(
                staff=staff_list,
                counters=counter_list,
                current_queue_load=data['current_queue_load'],
                predicted_queue_load=data.get('predicted_queue_load', data['current_queue_load']),
                time_slots=data['time_slots'],
                budget=data.get('budget', 5000.0)
            )
            
            # Run optimization
            result = optimizer.optimize(opt_input)
            
            # Format response
            recommended_staff = []
            for assignment in result.assignments:
                recommended_staff.append({
                    "counter": assignment.counter_id,
                    "staff_id": f"S{assignment.staff_id}",
                    "staff_name": assignment.staff_name,
                    "counter_type": assignment.counter_type,
                    "start_time": assignment.start_time,
                    "end_time": assignment.end_time
                })
            
            response = {
                "recommended_staff": recommended_staff,
                "total_cost": round(result.total_cost, 2),
                "status": result.status
            }
            
            if predicted_queue is not None:
                response["predicted_queue"] = round(predicted_queue, 2)
            
            return jsonify(response), 200
        else:
            return jsonify({
                "error": "Missing required fields for optimization"
            }), 400
            
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500


# ==========================================
#   QUEUE DETECTION DATA ENDPOINT
# ==========================================
@app.route('/queue/detection', methods=['POST'])
def queue_detection_data():
    """
    Process queue detection data and return enhanced JSON response
    
    Request body:
    {
        "counters": [
            {"counterId": "1", "queueSize": 10, "averageWaitTime": 30},
            {"counterId": "2", "queueSize": 5, "averageWaitTime": 15}
        ],
        "timestamp": "2025-12-28T10:30:00Z",
        "camera_id": "cam_01"
    }
    
    Returns enhanced detection data with status and metadata
    """
    try:
        data = request.get_json()
        
        if 'counters' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'counters' field"
            }), 400
        
        counters = data['counters']
        total_queue = sum(c.get('queueSize', 0) for c in counters)
        
        # Calculate status levels
        enhanced_counters = []
        for counter in counters:
            queue_size = counter.get('queueSize', 0)
            
            # Determine status
            if queue_size > 15:
                status = 'critical'
                status_color = 'red'
            elif queue_size > 8:
                status = 'busy'
                status_color = 'orange'
            else:
                status = 'normal'
                status_color = 'green'
            
            enhanced_counters.append({
                "counterId": counter['counterId'],
                "queueSize": queue_size,
                "averageWaitTime": counter.get('averageWaitTime', queue_size * 3),
                "status": status,
                "statusColor": status_color,
                "capacity": counter.get('capacity', 20),
                "utilization": round((queue_size / 20) * 100, 1)
            })
        
        response = {
            "success": True,
            "data": {
                "counters": enhanced_counters,
                "summary": {
                    "totalQueue": total_queue,
                    "totalCounters": len(counters),
                    "averageQueueSize": round(total_queue / len(counters), 1) if counters else 0,
                    "criticalCounters": sum(1 for c in enhanced_counters if c['status'] == 'critical'),
                    "busyCounters": sum(1 for c in enhanced_counters if c['status'] == 'busy')
                },
                "timestamp": data.get('timestamp', time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
                "camera_id": data.get('camera_id', 'unknown')
            },
            "metadata": {
                "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "api_version": "1.0",
                "model": "YOLOv8"
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Queue detection error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==========================================
#   COMPREHENSIVE AI ANALYSIS ENDPOINT
# ==========================================
@app.route('/ai/analyze', methods=['POST'])
def comprehensive_analysis():
    """
    Comprehensive AI analysis: detection + prediction + optimization
    
    Request body:
    {
        "historical_data": [...],  # Last 60 queue values
        "current_counters": [...], # Current counter states
        "staff_available": [...],  # Available staff
        "minutes_ahead": 15
    }
    
    Returns complete AI analysis as JSON
    """
    try:
        data = request.get_json()
        result = {
            "success": True,
            "analysis": {},
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        
        # 1. Prediction (if historical data provided)
        if 'historical_data' in data and data['historical_data']:
            historical = data['historical_data']
            minutes_ahead = data.get('minutes_ahead', 15)
            
            # Prepare data for prediction
            queue_values = [item.get('queueSize', 0) if isinstance(item, dict) else item 
                          for item in historical[-60:]]
            
            while len(queue_values) < 60:
                queue_values.insert(0, 0)
            queue_values = queue_values[-60:]
            
            # Make prediction
            from prediction.predict import predict_future_queue_length
            predicted_queue = predict_future_queue_length(queue_values, minutes_ahead)
            
            variance = np.var(queue_values)
            confidence = min(0.95, max(0.6, 1.0 - (variance / 100)))
            
            # Determine rush level
            if predicted_queue > 15:
                rush_level = "high"
                recommendation = "High demand expected. Allocate maximum staff."
            elif predicted_queue > 8:
                rush_level = "medium"
                recommendation = "Moderate rush expected. Ensure adequate staff coverage."
            else:
                rush_level = "low"
                recommendation = "Low demand expected. Normal staffing sufficient."
            
            result["analysis"]["prediction"] = {
                "predicted_queue": round(predicted_queue, 2),
                "current_queue": int(queue_values[-1]),
                "change": round(predicted_queue - queue_values[-1], 2),
                "confidence": round(confidence * 100, 1),
                "rush_level": rush_level,
                "recommendation": recommendation,
                "minutes_ahead": minutes_ahead,
                "trend": "increasing" if predicted_queue > queue_values[-1] else "decreasing"
            }
        
        # 2. Current state analysis (if current counters provided)
        if 'current_counters' in data and data['current_counters']:
            counters = data['current_counters']
            total_queue = sum(c.get('queueSize', 0) for c in counters)
            
            result["analysis"]["current_state"] = {
                "total_queue": total_queue,
                "counter_count": len(counters),
                "average_queue": round(total_queue / len(counters), 1) if counters else 0,
                "max_queue": max((c.get('queueSize', 0) for c in counters), default=0),
                "min_queue": min((c.get('queueSize', 0) for c in counters), default=0),
                "counters": [
                    {
                        "id": c['counterId'],
                        "queue": c.get('queueSize', 0),
                        "wait_time": c.get('averageWaitTime', 0),
                        "status": "critical" if c.get('queueSize', 0) > 15 else 
                                 "busy" if c.get('queueSize', 0) > 8 else "normal"
                    }
                    for c in counters
                ]
            }
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Comprehensive analysis error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==========================================
#   LIVE FRAME DETECTION ENDPOINT
# ==========================================
@app.route('/detect-frame', methods=['POST'])
def detect_frame():
    """
    Process a single video frame for real-time queue detection
    
    Request body:
    {
        "frame": "base64_encoded_image_data",
        "camera_id": "webcam",
        "counter_zones": {
            "1": [0, 0, 426, 720],
            "2": [427, 0, 853, 720],
            "3": [854, 0, 1280, 720]
        }
    }
    
    Returns:
    {
        "success": true,
        "detections": [
            {
                "class": "person",
                "confidence": 0.92,
                "bbox": [x1, y1, x2, y2],
                "counter": "1"
            }
        ],
        "counters": {
            "1": {"count": 2, "status": "normal"},
            "2": {"count": 5, "status": "busy"},
            "3": {"count": 1, "status": "normal"}
        },
        "total_people": 8,
        "frame_size": [width, height],
        "timestamp": "..."
    }
    """
    try:
        if not yolo_model:
            return jsonify({
                "success": False,
                "error": "YOLO model not loaded"
            }), 503
        
        data = request.get_json()
        
        if 'frame' not in data:
            return jsonify({
                "success": False,
                "error": "Missing 'frame' field"
            }), 400
        
        # Decode base64 image
        try:
            # Remove data URL prefix if present
            image_data = data['frame']
            if 'base64,' in image_data:
                image_data = image_data.split('base64,')[1]
            
            # Decode base64 to image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(BytesIO(image_bytes))
            frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
        except Exception as e:
            logger.error(f"Image decode error: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"Failed to decode image: {str(e)}"
            }), 400
        
        # Get frame dimensions
        height, width = frame.shape[:2]
        
        # Default counter zones if not provided (divide into 3 vertical sections)
        counter_zones = data.get('counter_zones', {
            "1": [0, 0, width // 3, height],
            "2": [width // 3, 0, 2 * width // 3, height],
            "3": [2 * width // 3, 0, width, height]
        })
        
        # Run YOLO detection
        results = yolo_model(frame, verbose=False)
        
        detections = []
        counter_counts = {str(k): {"count": 0, "status": "normal"} for k in counter_zones.keys()}
        
        # Process detections
        for result in results:
            boxes = result.boxes
            
            for box in boxes:
                # Get class ID and confidence
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                
                # Only process 'person' class (class 0 in COCO dataset)
                if cls_id == 0 and conf > 0.5:
                    # Get bounding box coordinates
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    
                    # Calculate center point
                    center_x = (x1 + x2) / 2
                    center_y = (y1 + y2) / 2
                    
                    # Assign to counter based on position
                    assigned_counter = None
                    for counter_id, zone in counter_zones.items():
                        zone_x1, zone_y1, zone_x2, zone_y2 = zone
                        if zone_x1 <= center_x <= zone_x2 and zone_y1 <= center_y <= zone_y2:
                            assigned_counter = counter_id
                            counter_counts[counter_id]["count"] += 1
                            break
                    
                    # If not assigned to any zone, assign to closest one
                    if not assigned_counter:
                        min_dist = float('inf')
                        for counter_id, zone in counter_zones.items():
                            zone_center_x = (zone[0] + zone[2]) / 2
                            zone_center_y = (zone[1] + zone[3]) / 2
                            dist = ((center_x - zone_center_x) ** 2 + (center_y - zone_center_y) ** 2) ** 0.5
                            if dist < min_dist:
                                min_dist = dist
                                assigned_counter = counter_id
                        if assigned_counter:
                            counter_counts[assigned_counter]["count"] += 1
                    
                    detections.append({
                        "class": "person",
                        "confidence": round(conf, 2),
                        "bbox": [round(x1), round(y1), round(x2), round(y2)],
                        "counter": assigned_counter
                    })
        
        # Determine status for each counter
        for counter_id, info in counter_counts.items():
            count = info["count"]
            if count > 8:
                info["status"] = "critical"
            elif count > 4:
                info["status"] = "busy"
            else:
                info["status"] = "normal"
        
        total_people = sum(info["count"] for info in counter_counts.values())
        
        response = {
            "success": True,
            "detections": detections,
            "counters": counter_counts,
            "total_people": total_people,
            "frame_size": [width, height],
            "camera_id": data.get('camera_id', 'unknown'),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processing_time_ms": 0  # Can be calculated if needed
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        logger.error(f"Frame detection error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ==========================================
#   RUN SERVER
# ==========================================
if __name__ == '__main__':
    print("=" * 50)
    print("🚀 Starting AI Engine API Server")
    print("=" * 50)
    print("📍 Health Check: http://localhost:8000/health")
    print("📍 Predict Queue: http://localhost:8000/predict")
    print("📍 Optimize Staff: http://localhost:8000/optimize")
    print("📍 Queue Detection: http://localhost:8000/queue/detection")
    print("📍 AI Analysis: http://localhost:8000/ai/analyze")
    print("📍 Detect Frame: http://localhost:8000/detect-frame")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=8000, debug=False)
