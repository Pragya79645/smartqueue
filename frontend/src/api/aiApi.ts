/**
 * AI API - HTTP requests for AI Engine services
 * Provides prediction, detection, and analysis data as JSON
 */

import {
  appendLocalQueueFromCounters,
  getLocalLiveQueue,
  getLocalQueuePrediction,
} from '@/lib/localDataStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:8001';

/**
 * Get comprehensive AI analysis (prediction + current state)
 * Returns: { success, analysis: { prediction, current_state }, timestamp }
 */
export async function getAiAnalysis(minutesAhead: number = 15) {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/ai/analyze?minutesAhead=${minutesAhead}`
    );
    if (!response.ok) throw new Error('Failed to fetch AI analysis');
    return response.json();
  } catch {
    const counters = getLocalLiveQueue();
    const prediction = getLocalQueuePrediction(undefined, minutesAhead);
    const totalQueue = counters.reduce((sum, item) => sum + Number(item.queueSize || 0), 0);

    return {
      success: true,
      fallback: true,
      source: 'local-fallback',
      analysis: {
        prediction,
        current_state: {
          total_queue: totalQueue,
          counter_count: counters.length,
          average_queue: counters.length > 0 ? Number((totalQueue / counters.length).toFixed(2)) : 0,
          max_queue: counters.length > 0 ? Math.max(...counters.map((c) => Number(c.queueSize || 0))) : 0,
          min_queue: counters.length > 0 ? Math.min(...counters.map((c) => Number(c.queueSize || 0))) : 0,
          counters: counters.map((c) => ({
            id: String(c.counterId),
            queue: Number(c.queueSize || 0),
            wait_time: Number(c.averageWaitTime || 0),
            status: c.status,
          })),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get enhanced prediction with rush level analysis
 * Returns: { success, prediction: { predicted_queue, confidence, rush_level, recommendation } }
 */
export async function getEnhancedPrediction(
  counterId?: string,
  minutesAhead: number = 15
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/predict-enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterId, minutesAhead }),
    });
    if (!response.ok) throw new Error('Failed to get enhanced prediction');
    return response.json();
  } catch {
    return {
      success: true,
      prediction: {
        ...getLocalQueuePrediction(counterId, minutesAhead),
        timeframe: `Next ${minutesAhead} minutes`,
      },
      source: 'local-fallback',
    };
  }
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

/**
 * Rule-based staff optimization by counter.
 * Returns: { success, data: { [counterId]: { status, required_staff, action, recommendation, mode } } }
 */
export async function optimizeStaffByCounter(data: {
  counts: Record<string, number>;
  staff?: Array<{
    id: string;
    current_counter: string | null;
    status: 'active' | 'available' | 'break';
  }>;
  last_moved_at?: Record<string, string>;
  people_per_staff?: number;
  min_staff_per_counter?: number;
  cooldown_seconds?: number;
  current_staff?: Record<string, number>;
  predicted_counts?: Record<string, number>;
}) {
  const response = await fetch(`${AI_ENGINE_URL}/api/staff/optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    let message = 'Failed to optimize staff by counter';
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.error;
      }
    } catch {
      // Keep fallback message for non-JSON error responses
    }
    throw new Error(message);
  }

  const json = await response.json();

  // Dynamic allocator returns { allocation, status, recommendations, mode, required_staff, last_moved_at }.
  // Normalize to existing per-counter card structure to avoid breaking UI consumers.
  const payload = json?.data;
  if (payload?.status && payload?.required_staff && payload?.mode) {
    const statusMap = payload.status as Record<string, string>;
    const requiredMap = payload.required_staff as Record<string, number>;
    const recommendationList = Array.isArray(payload.recommendations) ? payload.recommendations : [];
    const counterIds = Array.from(new Set([
      ...Object.keys(data.counts || {}),
      ...Object.keys(statusMap),
      ...Object.keys(requiredMap),
    ])).sort();

    const byCounter: Record<string, string[]> = {};
    for (const rec of recommendationList) {
      if (typeof rec !== 'string') continue;
      const matches = rec.match(/Counter\s+(\w+)/gi) || [];
      if (matches.length === 0) continue;
      for (const match of matches) {
        const id = match.replace(/Counter\s+/i, '').trim();
        byCounter[id] = byCounter[id] || [];
        byCounter[id].push(rec);
      }
    }

    const normalized: Record<string, any> = {};
    for (const counterId of counterIds) {
      const status = statusMap[counterId] || 'OK';
      const action = status === 'OVERLOADED'
        ? 'Add'
        : (status === 'OVERSTAFFED' || status === 'UNDERUTILIZED')
          ? 'Remove'
          : 'No Change';
      normalized[counterId] = {
        mode: payload.mode,
        status,
        required_staff: Number(requiredMap[counterId] || 0),
        action,
        recommendation: byCounter[counterId]?.join('; ') || 'No movement suggested',
      };
    }

    return {
      ...json,
      data: normalized,
      last_moved_at: payload.last_moved_at || {},
      raw: payload,
    };
  }

  return json;
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
    /** Base64-encoded JPEG with OpenCV counter regions and bounding boxes drawn */
    annotated_frame?: string;
}

/**
 * Process video frame for real-time detection
 * Returns: { success, detections, counters, total_people, ... }
 */
export async function processVideoFrame(
  frameData: string, 
  cameraId: string = 'webcam',
  counterZones?: Record<string, [number, number, number, number]>,
  options?: { includeAnnotated?: boolean }
): Promise<FrameDetectionResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/ai/process-frame`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frame: frameData,
        camera_id: cameraId,
        counter_zones: counterZones,
        include_annotated: options?.includeAnnotated === true,
      }),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to process video frame';
      try {
        const errorBody = await response.json();
        if (errorBody?.message) {
          errorMessage = `Failed to process video frame: ${errorBody.message}`;
        } else if (errorBody?.error) {
          errorMessage = `Failed to process video frame: ${errorBody.error}`;
        }
      } catch {
        // Keep default message if response body isn't JSON
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    if (result?.success && result?.counters && typeof result.counters === 'object') {
      appendLocalQueueFromCounters(result.counters, result.timestamp);
    }
    return result;
  } catch {
    const fallbackCounters = Object.fromEntries(
      Object.keys(counterZones || { '1': true, '2': true, '3': true }).map((key) => [
        key,
        { count: 0, status: 'normal' },
      ])
    ) as Record<string, { count: number; status: 'normal' | 'busy' | 'critical' }>;

    const fallback: FrameDetectionResponse = {
      success: true,
      detections: [],
      counters: fallbackCounters,
      total_people: 0,
      frame_size: [0, 0],
      camera_id: cameraId,
      timestamp: new Date().toISOString(),
      processing_time_ms: 0,
    };

    appendLocalQueueFromCounters(fallback.counters, fallback.timestamp);
    return fallback;
  }
}
