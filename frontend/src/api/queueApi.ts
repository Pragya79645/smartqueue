/**
 * Queue API - HTTP requests for queue data and predictions
 * Talks to: Backend /api/queue and Flask AI Engine
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:8000';

/**
 * Get current live queue data for all counters
 */
export async function getCurrentQueue() {
  const response = await fetch(`${BACKEND_URL}/api/queue/live`);
  if (!response.ok) throw new Error('Failed to fetch current queue');
  return response.json();
}

/**
 * Update queue data for a single counter
 */
export async function updateQueue(counterId: string, queueLength: number) {
  const response = await fetch(`${BACKEND_URL}/api/queue/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ counterId, queueLength }),
  });
  if (!response.ok) throw new Error('Failed to update queue');
  return response.json();
}

/**
 * Batch update queue data for multiple counters
 */
export async function batchUpdateQueue(updates: Array<{ counterId: string; queueLength: number }>) {
  const response = await fetch(`${BACKEND_URL}/api/queue/update/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!response.ok) throw new Error('Failed to batch update queue');
  return response.json();
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

  const response = await fetch(`${BACKEND_URL}/api/queue/history?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch queue history');
  return response.json();
}

/**
 * Get queue statistics
 */
export async function getQueueStats(period?: string) {
  const searchParams = period ? new URLSearchParams({ period }) : '';
  const response = await fetch(`${BACKEND_URL}/api/queue/stats?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch queue stats');
  return response.json();
}

/**
 * Get queue prediction from Backend (which calls AI Engine)
 */
export async function getQueuePrediction(counterId?: string, minutesAhead: number = 15) {
  const searchParams = new URLSearchParams();
  if (counterId) searchParams.append('counterId', counterId);
  searchParams.append('minutesAhead', minutesAhead.toString());
  
  const response = await fetch(`${BACKEND_URL}/api/queue/predict?${searchParams}`);
  if (!response.ok) throw new Error('Failed to get queue prediction');
  return response.json();
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
  const response = await fetch(`${BACKEND_URL}/api/queue/history?${searchParams}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to clean old data');
  return response.json();
}
