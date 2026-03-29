/**
 * Queue API - HTTP requests for queue data and predictions
 * Talks to: Backend /api/queue and Flask AI Engine
 */

import {
  appendLocalQueueRecord,
  getLocalLiveQueue,
  getLocalQueueHistory,
  getLocalQueuePrediction,
} from '@/lib/localDataStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:8001';

/**
 * Get current live queue data for all counters
 */
export async function getCurrentQueue() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/live`);
    if (!response.ok) throw new Error('Failed to fetch current queue');
    return response.json();
  } catch {
    const data = getLocalLiveQueue();
    return {
      success: true,
      count: data.length,
      data,
      timestamp: new Date().toISOString(),
      source: 'local-fallback',
    };
  }
}

/**
 * Update queue data for a single counter
 */
export async function updateQueue(counterId: string, queueLength: number) {
  appendLocalQueueRecord(Number(counterId), Number(queueLength));

  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterId, queueSize: queueLength }),
    });
    if (!response.ok) throw new Error('Failed to update queue');
    return response.json();
  } catch {
    return {
      success: true,
      message: 'Queue updated locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Batch update queue data for multiple counters
 */
export async function batchUpdateQueue(updates: Array<{ counterId: string; queueLength: number }>) {
  for (const update of updates) {
    appendLocalQueueRecord(Number(update.counterId), Number(update.queueLength));
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/update/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queues: updates.map((u) => ({
          counterId: Number(u.counterId),
          queueSize: Number(u.queueLength),
        })),
      }),
    });
    if (!response.ok) throw new Error('Failed to batch update queue');
    return response.json();
  } catch {
    return {
      success: true,
      count: updates.length,
      message: 'Batch queue updated locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Get historical queue data
 */
export async function getQueueHistory(params?: {
  counterId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.counterId) searchParams.append('counterId', params.counterId);
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/history?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch queue history');
    return response.json();
  } catch {
    const data = getLocalQueueHistory(params?.limit || 100, params?.counterId);
    return {
      success: true,
      count: data.length,
      data,
      source: 'local-fallback',
    };
  }
}

/**
 * Get queue statistics
 */
export async function getQueueStats(period?: string) {
  const searchParams = period ? new URLSearchParams({ period }) : '';
  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/stats?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch queue stats');
    return response.json();
  } catch {
    const live = getLocalLiveQueue();
    return {
      success: true,
      period: period || 'local',
      data: live.map((q) => ({
        _id: q.counterId,
        avgQueueSize: q.queueSize,
        maxQueueSize: q.queueSize,
        minQueueSize: q.queueSize,
        totalRecords: 1,
      })),
      source: 'local-fallback',
    };
  }
}

/**
 * Get queue prediction from Backend (which calls AI Engine)
 */
export async function getQueuePrediction(counterId?: string, minutesAhead: number = 15) {
  const searchParams = new URLSearchParams();
  if (counterId) searchParams.append('counterId', counterId);
  searchParams.append('minutesAhead', minutesAhead.toString());
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/predict?${searchParams}`);
    if (!response.ok) throw new Error('Failed to get queue prediction');
    return response.json();
  } catch {
    return {
      success: true,
      prediction: getLocalQueuePrediction(counterId, minutesAhead),
      timestamp: new Date().toISOString(),
      source: 'local-fallback',
    };
  }
}

/**
 * Get queue prediction directly from AI Engine (alternative)
 */
export async function getQueuePredictionDirect(last60Values: number[], minutesAhead: number = 15) {
  const response = await fetch(`${AI_ENGINE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: last60Values, minutes_ahead: minutesAhead }),
  });
  if (!response.ok) throw new Error('Failed to get queue prediction from AI engine');
  return response.json();
}

/**
 * Clean old queue data
 */
export async function cleanOldQueueData(daysToKeep?: number) {
  const searchParams = daysToKeep ? new URLSearchParams({ daysToKeep: daysToKeep.toString() }) : '';
  try {
    const response = await fetch(`${BACKEND_URL}/api/queue/history?${searchParams}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to clean old data');
    return response.json();
  } catch {
    return {
      success: true,
      message: 'Cleanup skipped in local mode',
      source: 'local-fallback',
    };
  }
}
