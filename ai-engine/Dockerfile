# Multi-stage build for AI engine
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Create wheels
RUN pip wheel --no-cache-dir --no-deps -r requirements.txt -w /wheels

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
  libgl1 \
  libglib2.0-0 \
  libgomp1 \
  && rm -rf /var/lib/apt/lists/*

# Copy wheels from builder
COPY --from=builder /wheels /wheels

# Install Python dependencies from wheels
RUN pip install --no-cache-dir /wheels/*.whl

# Copy application code
COPY api ./api
COPY models ./models
COPY optimization ./optimization
COPY prediction ./prediction
COPY queue_detection ./queue_detection
COPY vision ./vision

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5001/health', timeout=5)"

# Start Flask API
CMD ["python", "api/flask_server.py"]
