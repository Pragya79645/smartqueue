import numpy as np
import joblib
from tensorflow.keras.models import load_model

# ==========================================
#   LOAD MODEL + SCALER
# ==========================================
MODEL_PATH = "models/lstm_model.h5"
SCALER_PATH = "models/scaler.pkl"

model = load_model(MODEL_PATH)
scaler = joblib.load(SCALER_PATH)


# ==========================================
#   PREDICT NEXT QUEUE LENGTH
# ==========================================
def predict_next_queue_length(last_60_values):
    """
    last_60_values: list or array of last 60 queue_length values (UNSCALED)
    
    Returns predicted queue_length (UNSCALED)
    """

    # Convert to numpy array
    last_60_values = np.array(last_60_values).reshape(-1, 1)

    if last_60_values.shape[0] != 60:
        raise ValueError("Error: You must pass exactly 60 values for prediction.")

    # Scale using same scaler used during training
    scaled_input = scaler.transform(last_60_values)

    # Reshape for LSTM → (batch_size, seq_len, features)
    scaled_input = np.expand_dims(scaled_input, axis=0)

    # Predict
    predicted_scaled = model.predict(scaled_input)

    # Inverse-scale to original queue_length
    predicted_value = scaler.inverse_transform(predicted_scaled)

    return float(predicted_value[0][0])


# ==========================================
#   PREDICT FUTURE QUEUE LENGTH (MULTI-STEP)
# ==========================================
def predict_future_queue_length(last_60_values, minutes_ahead=15):
    """
    Predict queue length for future time horizons.
    
    Parameters:
    - last_60_values: list or array of last 60 queue_length values (UNSCALED)
    - minutes_ahead: how many minutes to predict ahead (e.g., 15, 30, 60)
    
    Returns:
    - Predicted queue_length at the specified time (UNSCALED)
    
    Note: Assumes each timestep = 1 minute
    """
    
    # Convert to numpy array
    sequence = np.array(last_60_values).reshape(-1, 1)
    
    if sequence.shape[0] != 60:
        raise ValueError("Error: You must pass exactly 60 values for prediction.")
    
    # Iteratively predict future values
    predictions = []
    current_sequence = sequence.copy()
    
    for _ in range(minutes_ahead):
        # Scale the current sequence
        scaled_input = scaler.transform(current_sequence)
        
        # Reshape for LSTM
        scaled_input = np.expand_dims(scaled_input, axis=0)
        
        # Predict next value
        predicted_scaled = model.predict(scaled_input, verbose=0)
        
        # Inverse-scale
        predicted_value = scaler.inverse_transform(predicted_scaled)
        predictions.append(float(predicted_value[0][0]))
        
        # Update sequence: remove oldest, add newest prediction
        current_sequence = np.vstack([current_sequence[1:], predicted_value])
    
    # Return the final prediction (at minutes_ahead)
    return predictions[-1]


def get_all_predictions(last_60_values):
    """
    Get predictions for 15, 30, and 60 minutes ahead.
    
    Returns:
    - dict with keys: 'next', '15min', '30min', '60min'
    """
    return {
        'next': predict_next_queue_length(last_60_values),
        '15min': predict_future_queue_length(last_60_values, 15),
        '30min': predict_future_queue_length(last_60_values, 30),
        '60min': predict_future_queue_length(last_60_values, 60)
    }


# ==========================================
#   TEST / DEMO USAGE
# ==========================================
if __name__ == "__main__":
    # Example sample (replace with real queue_length history)
    sample_last_60 = [10, 12, 11, 15, 17, 20, 19, 18, 22, 21,
                      24, 26, 28, 30, 33, 31, 29, 27, 30, 32,
                      34, 36, 38, 40, 39, 37, 35, 33, 31, 30,
                      28, 26, 24, 22, 20, 18, 16, 14, 12, 10,
                      15, 17, 19, 21, 23, 25, 27, 29, 31, 33,
                      35, 37, 39, 41, 43, 45, 47, 49, 51, 53]

    # Single prediction
    prediction = predict_next_queue_length(sample_last_60)
    print("Predicted next queue length:", prediction)
    
    # Multi-horizon predictions
    print("\n--- Future Predictions ---")
    all_preds = get_all_predictions(sample_last_60)
    print(f"Next timestep: {all_preds['next']:.2f}")
    print(f"15 minutes ahead: {all_preds['15min']:.2f}")
    print(f"30 minutes ahead: {all_preds['30min']:.2f}")
    print(f"60 minutes ahead: {all_preds['60min']:.2f}")
