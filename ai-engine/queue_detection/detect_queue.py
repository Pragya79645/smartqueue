"""
Main queue detection system using YOLO
Detects people, counts per counter, and sends data to backend
"""

import os
import sys
import time
import logging
import requests
import json
from pathlib import Path
from typing import Dict, List, Optional
import argparse

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

try:
    import cv2
    import torch
    from ultralytics import YOLO
except ImportError as e:
    print(f"Error: Required package not installed: {e}")
    print("Install with: pip install opencv-python torch ultralytics")
    sys.exit(1)

from queue_detection.video_stream import VideoStream
from queue_detection.utils import (
    preprocess_frame,
    enhance_frame,
    draw_detection_boxes,
    assign_to_counter,
    calculate_queue_metrics,
    filter_low_confidence
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class QueueDetector:
    """
    YOLO-based queue detection system
    """
    
    def __init__(
        self,
        model_path: str = "../models/yolo_weights.pt",
        backend_url: str = "http://localhost:5000",
        camera_source: str = "0",
        confidence_threshold: float = 0.5,
        display: bool = False
    ):
        """
        Initialize queue detector
        
        Args:
            model_path: Path to YOLO model weights
            backend_url: Backend API URL
            camera_source: Camera source (URL or device index)
            confidence_threshold: Minimum confidence for detections
            display: Whether to display video feed
        """
        self.model_path = model_path
        self.backend_url = backend_url.rstrip('/')
        self.camera_source = camera_source
        self.confidence_threshold = confidence_threshold
        self.display = display
        
        # Counter zones (x1, y1, x2, y2) - these should be configured for your setup
        # Example: 3 counters dividing frame into vertical sections
        self.counter_zones = {
            "1": (0, 0, 426, 720),      # Left third
            "2": (427, 0, 853, 720),    # Middle third
            "3": (854, 0, 1280, 720)    # Right third
        }
        
        self.model = None
        self.video_stream = None
        self.running = False
        self.previous_counts = {}
        
        logger.info("QueueDetector initialized")
    
    def load_model(self) -> bool:
        """
        Load YOLO model
        
        Returns:
            True if loaded successfully
        """
        try:
            # Use standard YOLOv8n model which will auto-download if needed
            logger.info("Loading YOLOv8n model...")
            self.model = YOLO('yolov8n.pt')
            
            # Test model
            logger.info("Model loaded successfully")
            logger.info(f"Model device: {self.model.device}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def start_camera(self) -> bool:
        """
        Start video stream
        
        Returns:
            True if started successfully
        """
        try:
            self.video_stream = VideoStream(self.camera_source)
            if not self.video_stream.start():
                logger.error("Failed to start video stream")
                return False
            
            logger.info("Camera started successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start camera: {e}")
            return False
    
    def detect_people(self, frame) -> List[Dict]:
        """
        Detect people in frame using YOLO
        
        Args:
            frame: Input frame
        
        Returns:
            List of detection dictionaries
        """
        try:
            # Run YOLO detection
            results = self.model(frame, verbose=False)
            
            detections = []
            
            for result in results:
                boxes = result.boxes
                
                for box in boxes:
                    # Get class (0 = person in COCO dataset)
                    cls = int(box.cls[0])
                    if cls != 0:  # Only detect persons
                        continue
                    
                    # Get confidence
                    conf = float(box.conf[0])
                    if conf < self.confidence_threshold:
                        continue
                    
                    # Get bounding box
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    
                    detections.append({
                        'bbox': (int(x1), int(y1), int(x2), int(y2)),
                        'confidence': conf,
                        'class': 'person'
                    })
            
            return detections
            
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return []
    
    def count_per_counter(self, detections: List[Dict]) -> Dict[str, int]:
        """
        Count people per counter zone
        
        Args:
            detections: List of detections
        
        Returns:
            Dict mapping counter IDs to counts
        """
        # Assign detections to counters
        assignments = assign_to_counter(detections, self.counter_zones)
        
        # Count per counter
        counts = {
            counter_id: len(dets) 
            for counter_id, dets in assignments.items()
        }
        
        return counts
    
    def send_to_backend(self, counter_counts: Dict[str, int]) -> bool:
        """
        Send queue data to backend API
        
        Args:
            counter_counts: Dict mapping counter IDs to counts
        
        Returns:
            True if sent successfully
        """
        try:
            # Calculate metrics
            metrics = calculate_queue_metrics(counter_counts, self.previous_counts)
            
            # Prepare batch payload
            queues = []
            for counter_id, count in counter_counts.items():
                queue_data = {
                    'counterId': counter_id,
                    'queueSize': count,
                    'averageWaitTime': metrics[counter_id]['averageWaitTime']
                }
                queues.append(queue_data)
            
            # Send to backend
            url = f"{self.backend_url}/api/queue/update/batch"
            response = requests.post(
                url,
                json={'queues': queues},
                headers={'Content-Type': 'application/json'},
                timeout=5
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Data sent to backend: {counter_counts}")
                self.previous_counts = counter_counts.copy()
                return True
            else:
                logger.warning(f"Backend returned status {response.status_code}: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to send data to backend: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending data: {e}")
            return False
    
    def process_frame(self, frame):
        """
        Process single frame: detect, count, and optionally display
        
        Args:
            frame: Input frame
        
        Returns:
            Counter counts dict
        """
        # Enhance frame
        enhanced = enhance_frame(frame, apply_clahe=True)
        
        # Detect people
        detections = self.detect_people(enhanced)
        
        # Filter low confidence
        detections = filter_low_confidence(detections, self.confidence_threshold)
        
        # Count per counter
        counter_counts = self.count_per_counter(detections)
        
        # Display if enabled
        if self.display:
            # Draw detections and zones
            assignments = assign_to_counter(detections, self.counter_zones)
            all_dets = []
            for dets in assignments.values():
                all_dets.extend(dets)
            
            display_frame = draw_detection_boxes(
                frame, 
                all_dets, 
                self.counter_zones
            )
            
            # Add count overlay
            y_offset = 30
            for counter_id, count in counter_counts.items():
                text = f"Counter {counter_id}: {count} people"
                cv2.putText(
                    display_frame,
                    text,
                    (10, y_offset),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )
                y_offset += 30
            
            cv2.imshow('Queue Detection', display_frame)
            
            # Exit on 'q' key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                self.running = False
        
        return counter_counts
    
    def run(self, update_interval: float = 5.0):
        """
        Main detection loop
        
        Args:
            update_interval: Seconds between backend updates
        """
        logger.info("Starting queue detection system...")
        
        # Load model
        if not self.load_model():
            logger.error("Failed to load model. Exiting.")
            return
        
        # Start camera
        if not self.start_camera():
            logger.error("Failed to start camera. Exiting.")
            return
        
        self.running = True
        last_update_time = 0
        frame_count = 0
        start_time = time.time()
        
        logger.info("Detection loop started. Press 'q' to quit (if display enabled).")
        
        try:
            while self.running:
                # Get frame
                ret, frame = self.video_stream.read()
                if not ret or frame is None:
                    logger.warning("No frame received")
                    time.sleep(0.1)
                    continue
                
                # Process frame
                counter_counts = self.process_frame(frame)
                
                # Send to backend at regular intervals
                current_time = time.time()
                if current_time - last_update_time >= update_interval:
                    self.send_to_backend(counter_counts)
                    last_update_time = current_time
                
                # Calculate FPS
                frame_count += 1
                if frame_count % 30 == 0:
                    elapsed = time.time() - start_time
                    fps = frame_count / elapsed
                    logger.info(f"Processing at {fps:.1f} FPS")
                
                # Small delay to prevent CPU overload
                time.sleep(0.01)
                
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception as e:
            logger.error(f"Error in detection loop: {e}", exc_info=True)
        finally:
            self.stop()
    
    def stop(self):
        """Stop detection system and cleanup"""
        logger.info("Stopping detection system...")
        
        self.running = False
        
        if self.video_stream:
            self.video_stream.stop()
        
        if self.display:
            cv2.destroyAllWindows()
        
        logger.info("Detection system stopped")


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Queue Detection System')
    parser.add_argument(
        '--model', 
        type=str, 
        default='../models/yolo_weights.pt',
        help='Path to YOLO model weights'
    )
    parser.add_argument(
        '--backend', 
        type=str, 
        default='http://localhost:5000',
        help='Backend API URL'
    )
    parser.add_argument(
        '--camera', 
        type=str, 
        default='0',
        help='Camera source (URL or device index)'
    )
    parser.add_argument(
        '--confidence', 
        type=float, 
        default=0.5,
        help='Detection confidence threshold'
    )
    parser.add_argument(
        '--interval', 
        type=float, 
        default=5.0,
        help='Backend update interval in seconds'
    )
    parser.add_argument(
        '--display', 
        action='store_true',
        help='Display video feed with detections'
    )
    
    args = parser.parse_args()
    
    # Create detector
    detector = QueueDetector(
        model_path=args.model,
        backend_url=args.backend,
        camera_source=args.camera,
        confidence_threshold=args.confidence,
        display=args.display
    )
    
    # Run detection
    detector.run(update_interval=args.interval)


if __name__ == '__main__':
    main()
