"""
Utility functions for queue detection preprocessing and analysis
"""

import cv2
import numpy as np
from typing import Tuple, List, Dict, Optional


def preprocess_frame(
    frame: np.ndarray, 
    target_size: Tuple[int, int] = (640, 640)
) -> np.ndarray:
    """
    Preprocess frame for YOLO detection
    
    Args:
        frame: Input frame from video stream
        target_size: Target size for model input (width, height)
    
    Returns:
        Preprocessed frame
    """
    # Resize frame while maintaining aspect ratio
    h, w = frame.shape[:2]
    scale = min(target_size[0] / w, target_size[1] / h)
    new_w, new_h = int(w * scale), int(h * scale)
    
    resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    
    # Create padded frame
    padded = np.full((target_size[1], target_size[0], 3), 114, dtype=np.uint8)
    padded[:new_h, :new_w] = resized
    
    return padded


def enhance_frame(frame: np.ndarray, apply_clahe: bool = True) -> np.ndarray:
    """
    Enhance frame for better detection in varying lighting conditions
    
    Args:
        frame: Input frame
        apply_clahe: Whether to apply CLAHE for contrast enhancement
    
    Returns:
        Enhanced frame
    """
    if apply_clahe:
        # Convert to LAB color space
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        
        # Merge channels and convert back to BGR
        lab = cv2.merge([l, a, b])
        frame = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
    
    return frame


def draw_detection_boxes(
    frame: np.ndarray,
    detections: List[Dict],
    counter_zones: Optional[Dict[str, Tuple[int, int, int, int]]] = None
) -> np.ndarray:
    """
    Draw bounding boxes and labels on frame
    
    Args:
        frame: Input frame
        detections: List of detection dictionaries with bbox, confidence, class
        counter_zones: Optional dict mapping counter IDs to zones (x1, y1, x2, y2)
    
    Returns:
        Frame with drawn boxes
    """
    output = frame.copy()
    
    # Draw counter zones if provided
    if counter_zones:
        for counter_id, (x1, y1, x2, y2) in counter_zones.items():
            cv2.rectangle(output, (x1, y1), (x2, y2), (255, 255, 0), 2)
            cv2.putText(
                output, 
                f"Counter {counter_id}", 
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 
                0.6, 
                (255, 255, 0), 
                2
            )
    
    # Draw detections
    for det in detections:
        x1, y1, x2, y2 = det['bbox']
        conf = det['confidence']
        counter_id = det.get('counter_id', 'N/A')
        
        # Color based on counter assignment
        color = (0, 255, 0) if counter_id != 'N/A' else (128, 128, 128)
        
        cv2.rectangle(output, (x1, y1), (x2, y2), color, 2)
        label = f"Person {conf:.2f}"
        if counter_id != 'N/A':
            label += f" (C{counter_id})"
        
        cv2.putText(
            output, 
            label, 
            (x1, y1 - 5),
            cv2.FONT_HERSHEY_SIMPLEX, 
            0.5, 
            color, 
            2
        )
    
    return output


def assign_to_counter(
    detections: List[Dict],
    counter_zones: Dict[str, Tuple[int, int, int, int]]
) -> Dict[str, List[Dict]]:
    """
    Assign detected persons to counter zones based on position
    
    Args:
        detections: List of detection dictionaries with bbox
        counter_zones: Dict mapping counter IDs to zones (x1, y1, x2, y2)
    
    Returns:
        Dict mapping counter IDs to list of detections in that zone
    """
    assignments = {counter_id: [] for counter_id in counter_zones.keys()}
    
    for det in detections:
        x1, y1, x2, y2 = det['bbox']
        center_x = (x1 + x2) // 2
        center_y = (y1 + y2) // 2
        
        # Check which counter zone contains this detection
        assigned = False
        for counter_id, (zx1, zy1, zx2, zy2) in counter_zones.items():
            if zx1 <= center_x <= zx2 and zy1 <= center_y <= zy2:
                det['counter_id'] = counter_id
                assignments[counter_id].append(det)
                assigned = True
                break
        
        if not assigned:
            det['counter_id'] = 'unassigned'
    
    return assignments


def calculate_queue_metrics(
    counter_counts: Dict[str, int],
    previous_counts: Optional[Dict[str, int]] = None
) -> Dict[str, Dict]:
    """
    Calculate queue metrics and trends
    
    Args:
        counter_counts: Current count per counter
        previous_counts: Previous count per counter for trend analysis
    
    Returns:
        Dict with metrics per counter
    """
    metrics = {}
    
    for counter_id, count in counter_counts.items():
        # Determine status
        if count > 15:
            status = 'critical'
        elif count > 8:
            status = 'busy'
        else:
            status = 'normal'
        
        # Calculate trend if previous data available
        trend = 'stable'
        if previous_counts and counter_id in previous_counts:
            prev = previous_counts[counter_id]
            if count > prev + 2:
                trend = 'increasing'
            elif count < prev - 2:
                trend = 'decreasing'
        
        # Estimate wait time (3 minutes per person)
        wait_time = count * 3
        
        metrics[counter_id] = {
            'queueSize': count,
            'status': status,
            'trend': trend,
            'averageWaitTime': wait_time
        }
    
    return metrics


def filter_low_confidence(
    detections: List[Dict], 
    min_confidence: float = 0.5
) -> List[Dict]:
    """
    Filter out low confidence detections
    
    Args:
        detections: List of detection dictionaries
        min_confidence: Minimum confidence threshold
    
    Returns:
        Filtered detection list
    """
    return [det for det in detections if det['confidence'] >= min_confidence]


def non_max_suppression_custom(
    detections: List[Dict], 
    iou_threshold: float = 0.45
) -> List[Dict]:
    """
    Apply non-maximum suppression to remove duplicate detections
    
    Args:
        detections: List of detection dictionaries
        iou_threshold: IoU threshold for suppression
    
    Returns:
        Filtered detection list
    """
    if not detections:
        return []
    
    # Sort by confidence
    detections = sorted(detections, key=lambda x: x['confidence'], reverse=True)
    
    keep = []
    while detections:
        best = detections.pop(0)
        keep.append(best)
        
        # Remove overlapping boxes
        detections = [
            det for det in detections
            if calculate_iou(best['bbox'], det['bbox']) < iou_threshold
        ]
    
    return keep


def calculate_iou(box1: Tuple[int, int, int, int], 
                  box2: Tuple[int, int, int, int]) -> float:
    """
    Calculate Intersection over Union of two bounding boxes
    
    Args:
        box1: First box (x1, y1, x2, y2)
        box2: Second box (x1, y1, x2, y2)
    
    Returns:
        IoU value
    """
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    # Calculate intersection
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i < x1_i or y2_i < y1_i:
        return 0.0
    
    intersection = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Calculate union
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0
