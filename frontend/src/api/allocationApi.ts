/**
 * Allocation API - HTTP requests for staff allocation and optimization
 * Talks to: Backend /api/allocate and Flask AI Engine
 */

import {
  applyLocalAllocationById,
  generateLocalAllocation,
  getLocalAllocationHistory,
  getLocalAllocationStats,
  getLocalLatestAllocation,
  getLocalLiveQueue,
  getLocalStaff,
} from '@/lib/localDataStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
const AI_ENGINE_URL = process.env.NEXT_PUBLIC_AI_ENGINE_URL || 'http://localhost:8001';

interface AllocationRequest {
  currentQueueLoad: Record<string, number>;
  predictedQueueLoad?: Record<string, number>;
  timeSlots?: number[];
  budget?: number;
}

function normalizeStatus(status?: string) {
  if (!status) return 'pending';
  if (status === 'infeasible') return 'infeasible';
  if (status === 'active' || status === 'completed' || status === 'applied') {
    return 'applied';
  }
  return status;
}

function normalizeAssignment(item: any) {
  return {
    staff_id: item?.staff_id || item?.staffId || '',
    staff_name: item?.staff_name || item?.staffName || '',
    counter_id: String(item?.counter_id ?? item?.counterId ?? item?.counter ?? ''),
    start_time: item?.start_time ?? item?.startTime ?? 'N/A',
    end_time: item?.end_time ?? item?.endTime ?? 'N/A',
    last_moved_at: item?.last_moved_at ?? item?.lastMovedAt ?? null,
    priority: item?.priority === 1 || item?.priority === 'high' ? 'high' : 'normal',
  };
}

function normalizeAllocation(raw: any) {
  if (!raw) return null;

  const assignments = Array.isArray(raw.allocations)
    ? raw.allocations.map(normalizeAssignment)
    : Array.isArray(raw.assignments)
      ? raw.assignments.map(normalizeAssignment)
      : [];

  return {
    id: raw.id || raw._id || '',
    assignments,
    totalCost: raw.totalCost ?? raw.total_cost ?? 0,
    timestamp: raw.timestamp || raw.createdAt || new Date().toISOString(),
    status: normalizeStatus(raw.status),
  };
}

/**
 * Generate optimized allocation recommendation now
 */
export async function allocateNow(request?: Partial<AllocationRequest>) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/allocate/now`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request || {}),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const details = errorData.details || errorData.error || 'Unknown error';
      throw new Error(`Failed to generate allocation: ${details}`);
    }
    const json = await response.json();

    // Backend returns { success, data, optimization }. Frontend cards expect { success, allocation }.
    const allocation = normalizeAllocation(json?.data) || normalizeAllocation(json?.optimization);

    // If optimizer reports infeasible, override allocation status so UI can show correct state.
    if (allocation && json?.optimization?.status === 'infeasible') {
      allocation.status = 'infeasible';
    }

    return {
      ...json,
      allocation,
    };
  } catch {
    const local = generateLocalAllocation();
    return {
      success: true,
      data: local,
      allocation: normalizeAllocation(local),
      message: 'Generated local recommendation',
      source: 'local-fallback',
    };
  }
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
  try {
    const response = await fetch(`${BACKEND_URL}/api/allocate/recommendation`);
    if (!response.ok) throw new Error('Failed to fetch recommendation');
    const json = await response.json();
    const allocation = normalizeAllocation(json?.data);
    if (allocation && Array.isArray(json?.data?.allocations) && json.data.allocations.length === 0 && (json?.data?.totalScore || 0) === 0) {
      allocation.status = 'infeasible';
    }

    return {
      ...json,
      allocation,
    };
  } catch {
    const local = getLocalLatestAllocation('pending') || generateLocalAllocation();
    return {
      success: true,
      data: local,
      allocation: normalizeAllocation(local),
      source: 'local-fallback',
    };
  }
}

/**
 * Apply allocation (assign staff to counters)
 */
export async function applyAllocation(allocationId: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/allocate/${allocationId}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to apply allocation');
    return response.json();
  } catch {
    const applied = applyLocalAllocationById(allocationId);
    if (!applied) throw new Error('Allocation not found');
    return {
      success: true,
      data: applied,
      message: 'Allocation applied locally',
      source: 'local-fallback',
    };
  }
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

  try {
    const response = await fetch(`${BACKEND_URL}/api/allocate/history?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch allocation history');
    return response.json();
  } catch {
    const data = getLocalAllocationHistory(params?.limit || 20);
    return {
      success: true,
      count: data.length,
      data,
      source: 'local-fallback',
    };
  }
}

/**
 * Get allocation statistics
 */
export async function getAllocationStats(period?: string) {
  const searchParams = period ? new URLSearchParams({ period }) : '';
  try {
    const response = await fetch(`${BACKEND_URL}/api/allocate/stats?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch allocation stats');
    return response.json();
  } catch {
    return {
      success: true,
      data: getLocalAllocationStats(),
      source: 'local-fallback',
    };
  }
}

/**
 * Calculate staff requirement based on queue load
 */
export async function getStaffRequirement(queueLoad: Record<string, number>) {
  const searchParams = new URLSearchParams();
  Object.entries(queueLoad).forEach(([key, value]) => {
    searchParams.append(key, value.toString());
  });

  try {
    const response = await fetch(`${BACKEND_URL}/api/allocate/requirement?${searchParams}`);
    if (!response.ok) throw new Error('Failed to calculate staff requirement');
    return response.json();
  } catch {
    const live = getLocalLiveQueue();
    const totalQueue = live.reduce((sum, q) => sum + Number(q.queueSize || 0), 0);
    const requiredStaff = Math.max(0, Math.ceil(totalQueue / 6));
    const available = getLocalStaff({ availability: 'available' }).length;
    const busy = getLocalStaff({ availability: 'busy' }).length;

    return {
      success: true,
      data: {
        requiredStaff,
        currentAvailable: available,
        currentBusy: busy,
        needsMoreStaff: requiredStaff > available + busy,
      },
      source: 'local-fallback',
    };
  }
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
