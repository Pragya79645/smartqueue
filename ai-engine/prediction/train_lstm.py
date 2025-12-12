import pandas as pd
import numpy as np
import pickle
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense

# ---------------------------
# 1. Load dataset
# ---------------------------
df = pd.read_csv("queue_dataset.csv")

# We will predict queue_length_at_arrival
target_col = "queue_length_at_arrival"

# Only one feature for now: queue_length
data = df[target_col].values.reshape(-1, 1)

# ---------------------------
# 2. Scale data
# ---------------------------
scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(data)

# ---------------------------
# 3. Create sequences
# ---------------------------
SEQ_LEN = 60

def create_sequences(data, seq_len):
    X, y = [], []
    for i in range(seq_len, len(data)):
        X.append(data[i-seq_len:i, 0])
        y.append(data[i, 0])
    return np.array(X), np.array(y)

X, y = create_sequences(scaled_data, SEQ_LEN)

# Reshape for LSTM
X = X.reshape(X.shape[0], X.shape[1], 1)

# ---------------------------
# 4. Train-test split
# ---------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, shuffle=False
)

# ---------------------------
# 5. Build LSTM model
# ---------------------------
model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(SEQ_LEN, 1)),
    LSTM(32),
    Dense(1)
])

model.compile(optimizer="adam", loss="mse")

print("Training model...")
history = model.fit(X_train, y_train, epochs=8, batch_size=16, validation_split=0.1)

# ---------------------------
# 6. Save model
# ---------------------------
model.save("../models/lstm_model.h5")
print("✅ Saved LSTM model to models/lstm_model.h5")

# ---------------------------
# 7. Save scaler
# ---------------------------
with open("../models/scaler.pkl", "wb") as f:
    pickle.dump(scaler, f)

print("✅ Saved scaler.pkl to models/")
