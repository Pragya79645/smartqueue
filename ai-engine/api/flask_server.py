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
#   RUN SERVER
# ==========================================
if __name__ == '__main__':
    print("=" * 50)
    print("🚀 Starting AI Engine API Server")
    print("=" * 50)
    print("📍 Health Check: http://localhost:8000/health")
    print("📍 Predict Queue: http://localhost:8000/predict")
    print("📍 Optimize Staff: http://localhost:8000/optimize")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=8000, debug=False)
