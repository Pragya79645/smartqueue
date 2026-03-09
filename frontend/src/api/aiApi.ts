/**
 * AI API - HTTP requests for AI Engine services
 * Provides prediction, detection, and analysis data as JSON
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:8000';

/**
 * Get comprehensive AI analysis (prediction + current state)
 * Returns: { success, analysis: { prediction, current_state }, timestamp }
 */
export async function getAiAnalysis(minutesAhead: number = 15) {
  const response = await fetch(
    `${BACKEND_URL}/api/ai/analyze?minutesAhead=${minutesAhead}`
  );
  if (!response.ok) throw new Error('Failed to fetch AI analysis');
  return response.json();
}

/**
 * Get enhanced prediction with rush level analysis
 * Returns: { success, prediction: { predicted_queue, confidence, rush_level, recommendation } }
 */
export async function getEnhancedPrediction(
  counterId?: string,
  minutesAhead: number = 15
) {
  const response = await fetch(`${BACKEND_URL}/api/ai/predict-enhanced`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ counterId, minutesAhead }),
  });
  if (!response.ok) throw new Error('Failed to get enhanced prediction');
  return response.json();
}

/**
 * Process queue detection data
 * Returns: { success, data: { counters, summary }, metadata }
 */
export async function processDetectionData(data: {
  counters: Array<{ counterId: string; queueSize: number; averageWaitTime?: number }>;
  timestamp?: string;
  camera_id?: string;
}) {
  const response = await fetch(`${BACKEND_URL}/api/ai/detection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to process detection data');
  return response.json();
}

/**
 * Check AI Engine health status
 * Returns: { success, ai_engine_status, models_loaded }
 */
export async function checkAiHealth() {
  const response = await fetch(`${BACKEND_URL}/api/ai/health`);
  return response.json();
}

/**
 * Direct call to AI Engine for prediction (bypassing backend)
 * Use this for real-time predictions when backend is slow
 */
export async function predictQueueDirect(
  historicalData: number[],
  minutesAhead: number = 15
) {
  const response = await fetch(`${AI_ENGINE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: historicalData,
      minutes_ahead: minutesAhead,
    }),
  });
  if (!response.ok) throw new Error('Failed to predict queue');
  return response.json();
}

/**
 * Direct call to AI Engine for staff optimization (bypassing backend)
 */
export async function optimizeStaffDirect(optimizationData: {
  current_queue_load: Record<string, number>;
  predicted_queue_load?: Record<string, number>;
  staff: Array<{
    id: number;
    name: string;
    skill_level: string;
    skills: string[];
    available_slots: number[];
    max_hours: number;
    hourly_rate: number;
  }>;
  counters: Array<{
    id: number;
    counter_type: string;
    max_capacity: number;
    priority: number;
  }>;
  time_slots: number[];
  budget?: number;
}) {
  const response = await fetch(`${AI_ENGINE_URL}/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(optimizationData),
  });
  if (!response.ok) throw new Error('Failed to optimize staff');
  return response.json();
}

/**
 * Get comprehensive AI analysis directly from AI Engine
 * Includes prediction and current state analysis
 */
export async function getComprehensiveAnalysisDirect(data: {
  historical_data: any[];
  current_counters?: any[];
  minutes_ahead?: number;
}) {
  const response = await fetch(`${AI_ENGINE_URL}/ai/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to get AI analysis');
  return response.json();
}

// Type definitions for AI responses
export interface AiAnalysisResponse {
  success: boolean;
  analysis: {
    prediction?: {
      predicted_queue: number;
      current_queue: number;
      change: number;
      confidence: number;
      rush_level: 'low' | 'medium' | 'high';
      recommendation: string;
      minutes_ahead: number;
      trend: 'increasing' | 'decreasing';
    };
    current_state?: {
      total_queue: number;
      counter_count: number;
      average_queue: number;
      max_queue: number;
      min_queue: number;
      counters: Array<{
        id: string;
        queue: number;
        wait_time: number;
        status: 'normal' | 'busy' | 'critical';
      }>;
    };
  };
  timestamp: string;
}

export interface EnhancedPredictionResponse {
  success: boolean;
  prediction: {
    predicted_queue: number;
    confidence: number;
    rush_level: 'low' | 'medium' | 'high';
    recommendation: string;
    timeframe: string;
    predictions?: Array<{
      counterId: string;
      currentSize: number;
      predictedSize: number;
      confidence: number;
      minutesAhead: number;
    }>;
  };
}

export interface DetectionDataResponse {
  success: boolean;
  data: {
    counters: Array<{
      counterId: string;
      queueSize: number;
      averageWaitTime: number;
      status: 'normal' | 'busy' | 'critical';
      statusColor: string;
      capacity: number;
      utilization: number;
    }>;
    summary: {
      totalQueue: number;
      totalCounters: number;
      averageQueueSize: number;
      criticalCounters: number;
      busyCounters: number;
    };
    timestamp: string;
    camera_id: string;
  };
  metadata: {
    processed_at: string;
    api_version: string;
    model: string;
  };
}

export interface FrameDetectionResponse {
  success: boolean;
  detections: Array<{
    class: string;
    confidence: number;
    bbox: [number, number, number, number];
    counter: string;
  }>;
  counters: Record<string, {
    count: number;
    status: 'normal' | 'busy' | 'critical';
  }>;
  total_people: number;
  frame_size: [number, number];
  camera_id: string;
  timestamp: string;
  processing_time_ms?: number;
}

/**
 * Process video frame for real-time detection
 * Returns: { success, detections, counters, total_people, ... }
 */
export async function processVideoFrame(
  frameData: string, 
  cameraId: string = 'webcam',
  counterZones?: Record<string, [number, number, number, number]>
): Promise<FrameDetectionResponse> {
  const response = await fetch(`${BACKEND_URL}/api/ai/process-frame`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      frame: frameData,
      camera_id: cameraId,
      counter_zones: counterZones,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to process video frame');
  }
  return response.json();
}
