# AI-Engine Installation Guide

## Prerequisites
- Miniconda or Anaconda installed
- Python 3.9 or 3.10 recommended

## Installation Steps

### 1. Create Conda Environment
```bash
# Create a new conda environment with Python 3.10
conda create -n queue-ai python=3.10 -y
```

### 2. Activate Environment
```bash
conda activate queue-ai
```

### 3. Install Dependencies

#### Option A: Using pip (Recommended)
```bash
# Navigate to ai-engine directory
cd ai-engine

# Install all packages
pip install -r requirements.txt
```

#### Option B: Using conda + pip
```bash
# Install base packages via conda
conda install numpy pandas scikit-learn -y

# Install deep learning frameworks
pip install tensorflow torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install computer vision and other dependencies
pip install opencv-python ultralytics joblib requests
```

### 4. Verify Installation
```bash
python -c "import tensorflow; import torch; import cv2; import ultralytics; print('All packages installed successfully!')"
```

## Quick Start

### For Queue Detection:
```bash
cd queue_detection
python detect_queue.py --source 0  # Use webcam
# OR
python detect_queue.py --source path/to/video.mp4  # Use video file
```

### For Training LSTM Model:
```bash
cd prediction
python train_lstm.py
```

### For Prediction:
```bash
cd prediction
python predict.py
```

## Troubleshooting

### CUDA/GPU Issues
If you have an NVIDIA GPU and want to use CUDA:
```bash
# For TensorFlow
pip install tensorflow[and-cuda]

# For PyTorch with CUDA 11.8
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Missing Models
Make sure you have:
- `models/lstm_model.h5` - LSTM model (train with train_lstm.py)
- `models/scaler.pkl` - Data scaler (generated during training)
- `models/yolo_weights.pt` - YOLO weights (download from ultralytics)

### Import Errors
If you get import errors, ensure the conda environment is activated:
```bash
conda activate queue-ai
```

## Deactivate Environment
```bash
conda deactivate
```

## Remove Environment (if needed)
```bash
conda env remove -n queue-ai
```
