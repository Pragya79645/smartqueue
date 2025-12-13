/**
 * Allocation API - HTTP requests for staff allocation and optimization
 * Talks to: Backend /api/allocate and Flask AI Engine
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:8000';

interface AllocationRequest {
  currentQueueLoad: Record<string, number>;
  predictedQueueLoad?: Record<string, number>;
  timeSlots?: number[];
  budget?: number;
}

/**
 * Generate optimized allocation recommendation now
 */
export async function allocateNow(request?: Partial<AllocationRequest>) {
  const response = await fetch(`${BACKEND_URL}/api/allocate/now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request || {}),
  });
  if (!response.ok) throw new Error('Failed to generate allocation');
  return response.json();
}

/**
 * Alias for allocateNow - more intuitive name
 */
export async function getOptimizedAllocation(request?: Partial<AllocationRequest>) {
  return allocateNow(request);
}

/**
 * Get latest allocation recommendation
 */
export async function getRecommendation() {
  const response = await fetch(`${BACKEND_URL}/api/allocate/recommendation`);
  if (!response.ok) throw new Error('Failed to fetch recommendation');
  return response.json();
}

/**
 * Apply allocation (assign staff to counters)
 */
export async function applyAllocation(allocationId: string) {
  const response = await fetch(`${BACKEND_URL}/api/allocate/${allocationId}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Failed to apply allocation');
  return response.json();
}

/**
 * Get allocation history
 */
export async function getAllocationHistory(params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.limit) searchParams.append('limit', params.limit.toString());

  const response = await fetch(`${BACKEND_URL}/api/allocate/history?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch allocation history');
  return response.json();
}

/**
 * Get allocation statistics
 */
export async function getAllocationStats(period?: string) {
  const searchParams = period ? new URLSearchParams({ period }) : '';
  const response = await fetch(`${BACKEND_URL}/api/allocate/stats?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch allocation stats');
  return response.json();
}

/**
 * Calculate staff requirement based on queue load
 */
export async function getStaffRequirement(queueLoad: Record<string, number>) {
  const searchParams = new URLSearchParams();
  Object.entries(queueLoad).forEach(([key, value]) => {
    searchParams.append(key, value.toString());
  });

  const response = await fetch(`${BACKEND_URL}/api/allocate/requirement?${searchParams}`);
  if (!response.ok) throw new Error('Failed to calculate staff requirement');
  return response.json();
}

/**
 * Get optimized staff directly from AI Engine (bypass backend)
 */
export async function optimizeStaffDirect(params: {
  staff: Array<{
    id: number;
    name: string;
    skill_level: string;
    skills: string[];
    available_slots: number[];
    max_hours?: number;
    hourly_rate?: number;
  }>;
  counters: Array<{
    id: number;
    counter_type: string;
    max_capacity: number;
    priority?: number;
  }>;
  current_queue_load: Record<string, number>;
  predicted_queue_load?: Record<string, number>;
  time_slots: number[];
  budget?: number;
}) {
  const response = await fetch(`${AI_ENGINE_URL}/optimize-staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to optimize staff');
  return response.json();
}

/**
 * Get prediction and optimization in one call (AI Engine)
 */
export async function predictAndOptimize(params: {
  last_60_values?: number[];
  staff: Array<any>;
  counters: Array<any>;
  current_queue_load: Record<string, number>;
  predicted_queue_load?: Record<string, number>;
  time_slots: number[];
  budget?: number;
}) {
  const response = await fetch(`${AI_ENGINE_URL}/predict-and-optimize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to predict and optimize');
  return response.json();
}
