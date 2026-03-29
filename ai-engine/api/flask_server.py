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

# Prevent TensorFlow GPU initialization issues on machines without stable CUDA.
os.environ.setdefault('CUDA_VISIBLE_DEVICES', '-1')

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from optimization.staff_optimizer import (
    StaffOptimizer, OptimizationInput, StaffMember, Counter,
    optimize_staff as rule_based_optimize_staff,
    dynamic_staff_allocation
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _truthy_env(value):
    """Interpret common env var truthy values."""
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}

# ==========================================
#   INITIALIZE FLASK APP
# ==========================================
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend
AI_ENGINE_PORT = int(os.getenv('AI_ENGINE_PORT', os.getenv('PORT', '8001')))

# ==========================================
#   LOAD MODELS ONCE (Global)
# ==========================================
# Keep prediction imports lazy so frame detection can run even when
# TensorFlow/prediction dependencies are unstable on a given machine.
_prediction_module = None


def _get_prediction_module():
    global _prediction_module
    if _prediction_module is None:
        from prediction import predict as predict_module
        _prediction_module = predict_module
    return _prediction_module


print("✓ AI Engine initialized (prediction loads on demand)")

# Initialize optimizer
optimizer = StaffOptimizer()
print("✓ Staff optimizer initialized")

# Load YOLO model for frame detection
yolo_model = None
yolo_model_path = None
yolo_init_error = None


def _get_yolo_candidates():
    """Build an ordered list of candidate model paths."""
    api_dir = os.path.dirname(os.path.abspath(__file__))
    engine_dir = os.path.dirname(api_dir)
    env_model_path = os.getenv('AI_YOLO_MODEL_PATH')

    candidates = []
    if env_model_path:
        candidates.append(os.path.abspath(env_model_path))

    candidates.extend([
        os.path.join(api_dir, 'yolov8n.pt'),
        os.path.join(engine_dir, 'yolov8n.pt'),
        os.path.join(engine_dir, 'models', 'yolo_weights.pt'),
    ])
    return candidates


def load_yolo_model(force=False):
    """Load YOLO once; optionally force a reload."""
    global yolo_model, yolo_model_path, yolo_init_error

    if yolo_model is not None and not force:
        return True

    try:
        from ultralytics import YOLO

        model_candidates = _get_yolo_candidates()
        selected_path = next((path for path in model_candidates if os.path.exists(path)), None)
        if not selected_path:
            raise FileNotFoundError(
                f"No YOLO weights found. Checked: {', '.join(model_candidates)}"
            )

        yolo_model = YOLO(selected_path)
        yolo_model_path = selected_path
        yolo_init_error = None
        logger.info(f"YOLO model loaded for frame detection: {selected_path}")
        return True
    except Exception as e:
        yolo_model = None
        yolo_model_path = None
        yolo_init_error = str(e)
        logger.warning(f"YOLO model not loaded: {yolo_init_error}")
        return False


# Try loading on startup but allow lazy retry later.
load_yolo_model()

# Per-counter colours for OpenCV annotation (BGR format)
COUNTER_COLORS_BGR = {
    "1": (58,  199,  71),   # green
    "2": (255, 128,   0),   # blue
    "3": (0,   128, 255),   # orange
}
_DEFAULT_COLOR_BGR = (180, 180, 180)


def _annotate_frame(frame, detections, counter_zones, counter_counts):
    """
    Draw counter regions, bounding boxes, labels and counts on frame.
    Returns a new annotated copy (does not modify the input).
    """
    annotated = frame.copy()
    height, width = annotated.shape[:2]
    font = cv2.FONT_HERSHEY_SIMPLEX

    # 1. Semi-transparent counter zone fill
    overlay = annotated.copy()
    for cid, zone in counter_zones.items():
        zx1, zy1, zx2, zy2 = [int(v) for v in zone]
        color = COUNTER_COLORS_BGR.get(str(cid), _DEFAULT_COLOR_BGR)
        cv2.rectangle(overlay, (zx1, zy1), (zx2, zy2), color, -1)
    cv2.addWeighted(overlay, 0.10, annotated, 0.90, 0, annotated)

    # 2. Vertical divider lines + counter label with count
    for cid in sorted(counter_zones.keys()):
        zx1, zy1, zx2, zy2 = [int(v) for v in counter_zones[cid]]
        color = COUNTER_COLORS_BGR.get(str(cid), _DEFAULT_COLOR_BGR)
        if zx1 > 1:
            cv2.line(annotated, (zx1, 0), (zx1, height), color, 2)
        count = counter_counts.get(str(cid), {}).get("count", 0)
        label = f"C{cid}: {count}"
        (tw, th), _ = cv2.getTextSize(label, font, 0.8, 2)
        tx, ty = zx1 + 10, 44
        cv2.rectangle(annotated, (tx - 4, ty - th - 6), (tx + tw + 4, ty + 4), color, -1)
        cv2.putText(annotated, label, (tx, ty), font, 0.8, (0, 0, 0), 2)

    # 3. Bounding boxes and per-person labels
    for det in detections:
        x1, y1, x2, y2 = [int(v) for v in det['bbox']]
        conf = det['confidence']
        cid = str(det.get('counter') or '')
        color = COUNTER_COLORS_BGR.get(cid, _DEFAULT_COLOR_BGR)
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        txt = f"p {int(conf * 100)}% C{cid}" if cid else f"p {int(conf * 100)}%"
        (tw, th), _ = cv2.getTextSize(txt, font, 0.45, 1)
        label_y = max(y1 - 4, th + 6)
        cv2.rectangle(annotated, (x1, label_y - th - 6), (x1 + tw + 6, label_y + 2), color, -1)
        cv2.putText(annotated, txt, (x1 + 2, label_y - 2), font, 0.45, (0, 0, 0), 1)

    # 4. Footer: total person count
    total = sum(info.get("count", 0) for info in counter_counts.values())
    footer = f"Total: {total} person(s)"
    cv2.putText(annotated, footer, (10, height - 12), font, 0.65, (0, 0, 0), 3)
    cv2.putText(annotated, footer, (10, height - 12), font, 0.65, (255, 255, 255), 1)

    return annotated


# ==========================================
#   HEALTH CHECK ENDPOINT
# ==========================================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify API is running"""
    yolo_loaded = yolo_model is not None
    include_debug = _truthy_env(os.getenv('AI_HEALTH_DEBUG'))

    response = {
        "status": "healthy",
        "message": "AI Engine API is running",
        "models_loaded": True,
        "yolo_loaded": yolo_loaded
    }

    if include_debug:
        response["yolo_model_path"] = yolo_model_path
        response["yolo_init_error"] = yolo_init_error

    return jsonify({
        **response
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
            prediction_module = _get_prediction_module()
            predicted_queue = prediction_module.predict_future_queue_length(queue_values, minutes_ahead)
            
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
        
    except ValueError as e:
        logger.error(f"Validation error in optimize: {str(e)}")
        return jsonify({
            "error": f"Input validation error: {str(e)}"
        }), 400
    except Exception as e:
        logger.error(f"Optimization error: {str(e)}", exc_info=True)
        return jsonify({
            "error": f"Optimization failed: {str(e)}",
            "type": type(e).__name__
        }), 500


# ==========================================
#   SIMPLE STAFF OPTIMIZATION (RULE-BASED)
# ==========================================
@app.route('/api/staff/optimize', methods=['POST'])
def optimize_staff_simple():
    """
    Rule-based staff optimization endpoint.

    Request body:
    {
        "counts": {"counter_1": 12, "counter_2": 4},
        "current_staff": {"counter_1": 2, "counter_2": 3},
        "predicted_counts": {"counter_1": 15, "counter_2": 6}  # optional
    }
    """
    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Invalid JSON body"
            }), 400

        counts = data.get('counts')
        staff = data.get('staff')
        current_staff = data.get('current_staff')
        predicted_counts = data.get('predicted_counts')
        cooldown_counters = data.get('cooldown_counters')

        if not isinstance(counts, dict):
            return jsonify({
                "success": False,
                "error": "Field 'counts' is required and must be an object"
            }), 400

        if predicted_counts is not None and not isinstance(predicted_counts, dict):
            return jsonify({
                "success": False,
                "error": "Field 'predicted_counts' must be an object when provided"
            }), 400

        # New contract: detailed staff list with cooldown per staff.
        if isinstance(staff, list):
            last_moved_at = data.get('last_moved_at')
            if last_moved_at is not None and not isinstance(last_moved_at, dict):
                return jsonify({
                    "success": False,
                    "error": "Field 'last_moved_at' must be an object when provided"
                }), 400

            optimization = dynamic_staff_allocation(
                counts=counts,
                staff=staff,
                predicted_counts=predicted_counts,
                people_per_staff=int(data.get('people_per_staff', 5)),
                min_staff_per_counter=int(data.get('min_staff_per_counter', 1)),
                cooldown_seconds=int(data.get('cooldown_seconds', 120)),
                last_moved_at=last_moved_at,
                debug=bool(data.get('debug', True)),
            )
        else:
            # Legacy contract: aggregate current staff per counter.
            if not isinstance(current_staff, dict):
                return jsonify({
                    "success": False,
                    "error": "Provide either 'staff' list or 'current_staff' object"
                }), 400

            if cooldown_counters is not None and not isinstance(cooldown_counters, dict):
                return jsonify({
                    "success": False,
                    "error": "Field 'cooldown_counters' must be an object when provided"
                }), 400

            optimization = rule_based_optimize_staff(
                counts=counts,
                current_staff=current_staff,
                predicted_counts=predicted_counts,
                cooldown_counters=cooldown_counters,
            )

        return jsonify({
            "success": True,
            "data": optimization
        }), 200

    except Exception as e:
        logger.error(f"Simple optimize endpoint error: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Failed to optimize staff",
            "details": str(e)
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
            prediction_module = _get_prediction_module()
            predicted_queue = prediction_module.predict_next_queue_length(data['last_60_values'])
        
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
            prediction_module = _get_prediction_module()
            predicted_queue = prediction_module.predict_future_queue_length(queue_values, minutes_ahead)
            
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
        start_time = time.perf_counter()

        if yolo_model is None:
            load_yolo_model()

        if yolo_model is None:
            details = yolo_init_error or "Unknown model initialization error"
            return jsonify({
                "success": False,
                "error": f"YOLO model not loaded: {details}"
            }), 503
        
        data = request.get_json()
        include_annotated = bool(data.get('include_annotated', False))
        
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
                # Lower threshold to 0.25 so distant/small people are detected
                if cls_id == 0 and conf > 0.25:
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

        # Annotate frame only when explicitly requested (expensive).
        annotated_b64 = None
        if include_annotated:
            try:
                ann = _annotate_frame(frame, detections, counter_zones, counter_counts)
                _, buf = cv2.imencode('.jpg', ann, [cv2.IMWRITE_JPEG_QUALITY, 70])
                annotated_b64 = base64.b64encode(buf).decode('utf-8')
            except Exception as ann_err:
                logger.warning(f"Frame annotation failed: {ann_err}")

        processing_time_ms = int((time.perf_counter() - start_time) * 1000)

        response = {
            "success": True,
            "detections": detections,
            "counters": counter_counts,
            "total_people": total_people,
            "frame_size": [width, height],
            "camera_id": data.get('camera_id', 'unknown'),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "processing_time_ms": processing_time_ms
        }
        if annotated_b64:
            response["annotated_frame"] = annotated_b64

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
    print(f"📍 Health Check: http://localhost:{AI_ENGINE_PORT}/health")
    print(f"📍 Predict Queue: http://localhost:{AI_ENGINE_PORT}/predict")
    print(f"📍 Optimize Staff: http://localhost:{AI_ENGINE_PORT}/optimize")
    print(f"📍 Queue Detection: http://localhost:{AI_ENGINE_PORT}/queue/detection")
    print(f"📍 AI Analysis: http://localhost:{AI_ENGINE_PORT}/ai/analyze")
    print(f"📍 Detect Frame: http://localhost:{AI_ENGINE_PORT}/detect-frame")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=AI_ENGINE_PORT, debug=False)
