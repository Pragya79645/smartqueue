"""
Integration Test Script
Tests the complete data flow from YOLO → Backend → Frontend
"""

import requests
import json
import time
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:5000"
AI_ENGINE_URL = "http://localhost:8001"
FRONTEND_URL = "http://localhost:3000"

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)

def test_health_checks():
    """Test 1: Health checks for all services"""
    print_section("TEST 1: Health Checks")
    
    # Test AI Engine
    try:
        response = requests.get(f"{AI_ENGINE_URL}/health", timeout=5)
        print(f"✓ AI Engine:  {response.json()}")
    except Exception as e:
        print(f"✗ AI Engine:  FAILED - {e}")
    
    # Test Backend
    try:
        response = requests.get(f"{BACKEND_URL}/api/queue/live", timeout=5)
        print(f"✓ Backend:    {response.status_code} OK")
    except Exception as e:
        print(f"✗ Backend:    FAILED - {e}")
    
    # Test Frontend
    try:
        response = requests.get(FRONTEND_URL, timeout=5)
        print(f"✓ Frontend:   {response.status_code} OK")
    except Exception as e:
        print(f"✗ Frontend:   FAILED - {e}")

def test_queue_update():
    """Test 2: Queue data update (YOLO → Backend)"""
    print_section("TEST 2: Queue Data Update")
    
    # Simulate YOLO sending queue data
    test_data = {
        "queues": [
            {"counterId": "1", "queueSize": 12, "averageWaitTime": 36},
            {"counterId": "2", "queueSize": 8, "averageWaitTime": 24},
            {"counterId": "3", "queueSize": 15, "averageWaitTime": 45}
        ]
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/queue/update/batch",
            json=test_data,
            timeout=5
        )
        result = response.json()
        print(f"✓ Queue Update: {result.get('message')}")
        print(f"  Updated {result.get('count')} counters")
    except Exception as e:
        print(f"✗ Queue Update: FAILED - {e}")

def test_get_queue_data():
    """Test 3: Fetch live queue data"""
    print_section("TEST 3: Fetch Live Queue Data")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/queue/live", timeout=5)
        result = response.json()
        
        if result.get('success'):
            print(f"✓ Live Queue Data Retrieved")
            print(f"  Total counters: {result.get('count')}")
            
            for queue in result.get('data', [])[:3]:  # Show first 3
                print(f"  - Counter {queue.get('counterId')}: {queue.get('queueSize')} people ({queue.get('status')})")
        else:
            print(f"✗ Failed to get queue data")
    except Exception as e:
        print(f"✗ Get Queue Data: FAILED - {e}")

def test_predictions():
    """Test 4: LSTM predictions"""
    print_section("TEST 4: LSTM Predictions")
    
    try:
        # Get historical data first
        response = requests.get(f"{BACKEND_URL}/api/queue/predict?minutesAhead=15", timeout=10)
        result = response.json()
        
        if result.get('success'):
            prediction = result.get('prediction', {})
            rush_trend = result.get('rushTrend', {})
            
            print(f"✓ Prediction Retrieved")
            print(f"  Predicted Queue: {prediction.get('predicted_queue', 'N/A')}")
            print(f"  Confidence: {prediction.get('confidence', 'N/A')}")
            print(f"  Rush Detected: {rush_trend.get('isRush', 'N/A')}")
            print(f"  Trend: {rush_trend.get('trend', 'N/A')}")
        else:
            print(f"✗ Prediction failed: {result.get('error')}")
    except Exception as e:
        print(f"✗ Predictions: FAILED - {e}")

def test_optimization():
    """Test 5: OR-Tools staff optimization"""
    print_section("TEST 5: Staff Optimization")
    
    try:
        # Generate allocation
        response = requests.post(
            f"{BACKEND_URL}/api/allocate/now",
            json={},
            timeout=15
        )
        result = response.json()
        
        if result.get('success'):
            optimization = result.get('optimization', {})
            allocations = optimization.get('allocations', [])
            
            print(f"✓ Optimization Completed")
            print(f"  Algorithm: {optimization.get('algorithm', 'N/A')}")
            print(f"  Total Score: {optimization.get('totalScore', 'N/A')}")
            print(f"  Allocations: {len(allocations)}")
            
            for alloc in allocations[:3]:  # Show first 3
                print(f"  - {alloc.get('staffName')} → Counter {alloc.get('counterId')}")
        else:
            print(f"✗ Optimization failed: {result.get('error')}")
    except Exception as e:
        print(f"✗ Optimization: FAILED - {e}")

def test_ai_engine_direct():
    """Test 6: Direct AI Engine calls"""
    print_section("TEST 6: Direct AI Engine Calls")
    
    # Test prediction
    try:
        test_data = [10, 12, 15, 18, 20, 22, 25, 23, 21, 19] * 6  # 60 values
        response = requests.post(
            f"{AI_ENGINE_URL}/predict",
            json={"data": test_data, "minutes_ahead": 15},
            timeout=5
        )
        result = response.json()
        
        if result.get('success'):
            print(f"✓ Direct Prediction: {result.get('predicted_queue')}")
        else:
            print(f"✗ Direct Prediction failed")
    except Exception as e:
        print(f"✗ Direct AI Call: FAILED - {e}")

def run_all_tests():
    """Run all integration tests"""
    print("\n" + "=" * 60)
    print("  PHASE 4 - INTEGRATION TEST SUITE")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 60)
    
    test_health_checks()
    time.sleep(1)
    
    test_queue_update()
    time.sleep(1)
    
    test_get_queue_data()
    time.sleep(1)
    
    test_predictions()
    time.sleep(1)
    
    test_optimization()
    time.sleep(1)
    
    test_ai_engine_direct()
    
    print("\n" + "=" * 60)
    print("  INTEGRATION TESTS COMPLETE")
    print("=" * 60 + "\n")

if __name__ == "__main__":
    run_all_tests()
