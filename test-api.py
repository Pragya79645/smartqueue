"""
Test script for AI Engine API endpoints
"""
import requests
import json

API_BASE = "http://localhost:8000"

def test_predict():
    """Test the /predict endpoint"""
    print("\n" + "="*50)
    print("Testing /predict endpoint")
    print("="*50)
    
    # Test data: 60 historical queue values
    data = {
        "data": [5, 6, 7, 8, 10, 12, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 
                 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 
                 23, 24, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8],
        "minutes_ahead": 15
    }
    
    try:
        response = requests.post(f"{API_BASE}/predict", json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def test_optimize():
    """Test the /optimize endpoint"""
    print("\n" + "="*50)
    print("Testing /optimize endpoint")
    print("="*50)
    
    # Test data for staff optimization
    data = {
        "current_queue_load": {
            "registration": 10,
            "billing": 5,
            "consultation": 8
        },
        "predicted_queue_load": {
            "registration": 15,
            "billing": 8,
            "consultation": 12
        },
        "staff": [
            {
                "id": 1,
                "name": "Alice",
                "skill_level": "advanced",
                "skills": ["registration", "billing"],
                "available_slots": [0, 1, 2, 3, 4, 5, 6, 7],
                "max_hours": 8.0,
                "hourly_rate": 20.0
            },
            {
                "id": 2,
                "name": "Bob",
                "skill_level": "intermediate",
                "skills": ["consultation", "registration"],
                "available_slots": [0, 1, 2, 3, 4],
                "max_hours": 5.0,
                "hourly_rate": 18.0
            },
            {
                "id": 3,
                "name": "Carol",
                "skill_level": "basic",
                "skills": ["billing"],
                "available_slots": [2, 3, 4, 5, 6, 7],
                "max_hours": 6.0,
                "hourly_rate": 15.0
            }
        ],
        "counters": [
            {
                "id": 1,
                "counter_type": "registration",
                "max_capacity": 2,
                "priority": 1
            },
            {
                "id": 2,
                "counter_type": "billing",
                "max_capacity": 2,
                "priority": 2
            },
            {
                "id": 3,
                "counter_type": "consultation",
                "max_capacity": 1,
                "priority": 1
            }
        ],
        "time_slots": [0, 1, 2, 3, 4, 5, 6, 7],
        "budget": 5000.0
    }
    
    try:
        response = requests.post(f"{API_BASE}/optimize", json=data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

def test_health():
    """Test the /health endpoint"""
    print("\n" + "="*50)
    print("Testing /health endpoint")
    print("="*50)
    
    try:
        response = requests.get(f"{API_BASE}/health")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    print("🧪 Starting AI Engine API Tests")
    
    # Test health first
    test_health()
    
    # Test predict
    test_predict()
    
    # Test optimize
    test_optimize()
    
    print("\n" + "="*50)
    print("✅ Tests completed")
    print("="*50)
