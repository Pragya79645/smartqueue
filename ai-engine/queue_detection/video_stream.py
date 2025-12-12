"""
Video stream management for queue detection
Handles camera connection, frame capture, and streaming
"""

import cv2
import threading
import time
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class VideoStream:
    """
    Thread-safe video stream handler for camera feed
    """
    
    def __init__(
        self, 
        source: str = "0", 
        width: int = 1280, 
        height: int = 720,
        fps: int = 30
    ):
        """
        Initialize video stream
        
        Args:
            source: Camera source (URL, device index as string, or path)
            width: Frame width
            height: Frame height
            fps: Target frames per second
        """
        self.source = source
        self.width = width
        self.height = height
        self.fps = fps
        
        # Try to convert source to int for device index
        try:
            self.source = int(source)
        except ValueError:
            pass  # Keep as string (URL or path)
        
        self.cap = None
        self.frame = None
        self.running = False
        self.thread = None
        self.lock = threading.Lock()
        self.last_frame_time = 0
        
        logger.info(f"VideoStream initialized with source: {self.source}")
    
    def start(self) -> bool:
        """
        Start video capture in separate thread
        
        Returns:
            True if started successfully, False otherwise
        """
        if self.running:
            logger.warning("VideoStream already running")
            return True
        
        # Open video capture
        self.cap = cv2.VideoCapture(self.source)
        
        if not self.cap.isOpened():
            logger.error(f"Failed to open video source: {self.source}")
            return False
        
        # Set camera properties
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, self.fps)
        
        # Get actual properties
        actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = int(self.cap.get(cv2.CAP_PROP_FPS))
        
        logger.info(f"Camera opened: {actual_width}x{actual_height} @ {actual_fps}fps")
        
        # Start capture thread
        self.running = True
        self.thread = threading.Thread(target=self._update_frame, daemon=True)
        self.thread.start()
        
        # Wait for first frame
        time.sleep(0.5)
        
        return True
    
    def _update_frame(self):
        """
        Internal method to continuously capture frames
        """
        logger.info("Frame capture thread started")
        
        while self.running:
            ret, frame = self.cap.read()
            
            if ret:
                with self.lock:
                    self.frame = frame
                    self.last_frame_time = time.time()
            else:
                logger.warning("Failed to read frame from camera")
                time.sleep(0.1)
                
                # Try to reconnect
                if not self._reconnect():
                    break
        
        logger.info("Frame capture thread stopped")
    
    def _reconnect(self, max_attempts: int = 3) -> bool:
        """
        Attempt to reconnect to video source
        
        Args:
            max_attempts: Maximum reconnection attempts
        
        Returns:
            True if reconnected successfully
        """
        logger.info("Attempting to reconnect to camera...")
        
        for attempt in range(max_attempts):
            if self.cap:
                self.cap.release()
            
            time.sleep(1)
            self.cap = cv2.VideoCapture(self.source)
            
            if self.cap.isOpened():
                logger.info("Reconnected successfully")
                return True
            
            logger.warning(f"Reconnection attempt {attempt + 1} failed")
        
        logger.error("Failed to reconnect after multiple attempts")
        return False
    
    def read(self) -> Optional[Tuple[bool, any]]:
        """
        Read the latest frame
        
        Returns:
            Tuple of (success, frame) or None if no frame available
        """
        with self.lock:
            if self.frame is None:
                return False, None
            return True, self.frame.copy()
    
    def get_frame(self) -> Optional[any]:
        """
        Get the latest frame (convenience method)
        
        Returns:
            Frame or None if no frame available
        """
        ret, frame = self.read()
        return frame if ret else None
    
    def is_active(self) -> bool:
        """
        Check if stream is active and receiving frames
        
        Returns:
            True if active
        """
        if not self.running:
            return False
        
        # Check if we received a frame recently (within 5 seconds)
        return (time.time() - self.last_frame_time) < 5.0
    
    def get_fps(self) -> float:
        """
        Get actual capture FPS
        
        Returns:
            Frames per second
        """
        if self.cap and self.cap.isOpened():
            return self.cap.get(cv2.CAP_PROP_FPS)
        return 0.0
    
    def get_resolution(self) -> Tuple[int, int]:
        """
        Get current frame resolution
        
        Returns:
            Tuple of (width, height)
        """
        if self.cap and self.cap.isOpened():
            width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            return width, height
        return 0, 0
    
    def stop(self):
        """
        Stop video capture and release resources
        """
        logger.info("Stopping video stream...")
        
        self.running = False
        
        if self.thread:
            self.thread.join(timeout=2.0)
        
        if self.cap:
            self.cap.release()
        
        logger.info("Video stream stopped")
    
    def __enter__(self):
        """Context manager entry"""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.stop()


class MultiCameraStream:
    """
    Manager for multiple camera streams
    """
    
    def __init__(self):
        """Initialize multi-camera manager"""
        self.streams = {}
        logger.info("MultiCameraStream initialized")
    
    def add_camera(
        self, 
        camera_id: str, 
        source: str, 
        width: int = 1280, 
        height: int = 720
    ) -> bool:
        """
        Add a camera stream
        
        Args:
            camera_id: Unique identifier for the camera
            source: Camera source
            width: Frame width
            height: Frame height
        
        Returns:
            True if added successfully
        """
        if camera_id in self.streams:
            logger.warning(f"Camera {camera_id} already exists")
            return False
        
        stream = VideoStream(source, width, height)
        if stream.start():
            self.streams[camera_id] = stream
            logger.info(f"Camera {camera_id} added successfully")
            return True
        
        logger.error(f"Failed to add camera {camera_id}")
        return False
    
    def get_frame(self, camera_id: str) -> Optional[any]:
        """
        Get frame from specific camera
        
        Args:
            camera_id: Camera identifier
        
        Returns:
            Frame or None
        """
        if camera_id in self.streams:
            return self.streams[camera_id].get_frame()
        return None
    
    def get_all_frames(self) -> dict:
        """
        Get frames from all cameras
        
        Returns:
            Dict mapping camera IDs to frames
        """
        return {
            cam_id: stream.get_frame() 
            for cam_id, stream in self.streams.items()
        }
    
    def remove_camera(self, camera_id: str) -> bool:
        """
        Remove a camera stream
        
        Args:
            camera_id: Camera identifier
        
        Returns:
            True if removed successfully
        """
        if camera_id in self.streams:
            self.streams[camera_id].stop()
            del self.streams[camera_id]
            logger.info(f"Camera {camera_id} removed")
            return True
        return False
    
    def stop_all(self):
        """Stop all camera streams"""
        logger.info("Stopping all camera streams...")
        for stream in self.streams.values():
            stream.stop()
        self.streams.clear()
        logger.info("All camera streams stopped")
    
    def __del__(self):
        """Cleanup on deletion"""
        self.stop_all()
