
"""
Camera Service for AI Engine
Orchestrates video capture, YOLO detection, and backend updates.
Supports RTSP streams and Webcams.
"""

import os
import sys
import time
import logging
import signal
from pathlib import Path

# Add parent directory to path to allow imports from sibling modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from queue_detection.detect_queue import QueueDetector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [CameraService] - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class CameraService:
    def __init__(self):
        self.detector = None
        self.running = False
        self._setup_signal_handlers()

    def _setup_signal_handlers(self):
        signal.signal(signal.SIGINT, self._handle_signal)
        signal.signal(signal.SIGTERM, self._handle_signal)

    def _handle_signal(self, signum, frame):
        logger.info(f"Received signal {signum}. Shutting down...")
        self.stop()

    def load_config(self):
        """Load configuration from environment variables or defaults"""
        self.camera_url = os.environ.get("CAMERA_URL", "0")
        self.backend_url = os.environ.get("BACKEND_URL", "http://localhost:5000")
        self.model_path = os.environ.get("YOLO_MODEL_PATH", "../models/yolo_weights.pt")
        self.update_interval = float(os.environ.get("UPDATE_INTERVAL", "5.0"))
        
        # Display logic needs a GUI environment. 
        # For a service, we usually default to False unless debugging locally.
        self.display = os.environ.get("DISPLAY_VIDEO", "False").lower() == "true"
        
        logger.info("Configuration loaded:")
        logger.info(f"  Camera: {self.camera_url}")
        logger.info(f"  Backend: {self.backend_url}")
        logger.info(f"  Update Interval: {self.update_interval}s")
        logger.info(f"  Display Enabled: {self.display}")

    def start(self):
        """Initialize and start the queue detector"""
        logger.info("Initializing Camera Service...")
        self.load_config()

        try:
            self.detector = QueueDetector(
                model_path=self.model_path,
                backend_url=self.backend_url,
                camera_source=self.camera_url,
                display=self.display
            )

            # verify backend connection before starting?
            # self.detector.check_backend() # Not implemented in QueueDetector yet

            logger.info("Starting detection loop...")
            self.running = True
            self.detector.run(update_interval=self.update_interval)

        except Exception as e:
            logger.error(f"Fatal error in camera service: {e}", exc_info=True)
            self.stop()
            sys.exit(1)

    def stop(self):
        """Stop the service"""
        self.running = False
        if self.detector:
            self.detector.stop()
        logger.info("Camera Service stopped.")

if __name__ == "__main__":
    service = CameraService()
    service.start()
