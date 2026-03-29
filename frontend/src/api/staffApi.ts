/**
 * Staff API - HTTP requests for staff management
 * Talks to: Backend /api/staff
 */

import {
  applyLocalStaffAllocationState,
  createLocalStaff,
  deleteLocalStaff,
  getLocalStaff,
  getLocalStaffById,
  updateLocalStaff,
} from '@/lib/localDataStore';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

interface StaffMember {
  staffId?: string;
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  skillLevel: string;
  skills: string[];
  performanceScore?: number;
  availableSlots?: number[];
  maxHours?: number;
  hourlyRate?: number;
  availability?: 'available' | 'busy' | 'break' | 'offline';
  isAvailable?: boolean;
  currentCounter?: string;
  shiftStart?: string;
  shiftEnd?: string;
}

/**
 * Get all staff members (with optional filters)
 */
export async function getStaffList(params?: {
  skill?: string;
  available?: boolean;
  skillLevel?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.skill) searchParams.append('skill', params.skill);
  if (params?.available !== undefined) searchParams.append('available', params.available.toString());
  if (params?.skillLevel) searchParams.append('skillLevel', params.skillLevel);

  try {
    const response = await fetch(`${BACKEND_URL}/api/staff?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch staff list');
    return response.json();
  } catch {
    const data = getLocalStaff({
      skill: params?.skill,
      availability: params?.available ? 'available' : undefined,
    });
    return {
      success: true,
      count: data.length,
      data,
      source: 'local-fallback',
    };
  }
}

/**
 * Get count of available staff
 */
export async function getAvailableStaffCount() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/available/count`);
    if (!response.ok) throw new Error('Failed to fetch available staff count');
    return response.json();
  } catch {
    const availableStaff = getLocalStaff({ availability: 'available' }).length;
    return {
      success: true,
      availableStaff,
      source: 'local-fallback',
    };
  }
}

/**
 * Get single staff member by ID
 */
export async function getStaffById(id: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/${id}`);
    if (!response.ok) throw new Error('Failed to fetch staff member');
    return response.json();
  } catch {
    const data = getLocalStaffById(id);
    if (!data) throw new Error('Staff member not found');
    return {
      success: true,
      data,
      source: 'local-fallback',
    };
  }
}

/**
 * Create new staff member
 */
export async function createStaff(staffData: StaffMember) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffData),
    });
    if (!response.ok) throw new Error('Failed to create staff member');
    return response.json();
  } catch {
    const created = createLocalStaff({
      ...staffData,
      currentCounter:
        staffData.currentCounter !== undefined && staffData.currentCounter !== null
          ? Number(staffData.currentCounter)
          : null,
      staffId: staffData.staffId || `S${Date.now()}`,
    });
    return {
      success: true,
      data: created,
      message: 'Staff member created locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Update staff member (full update)
 */
export async function updateStaff(id: string, staffData: StaffMember) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffData),
    });
    if (!response.ok) throw new Error('Failed to update staff member');
    return response.json();
  } catch {
    const updated = updateLocalStaff(id, staffData as any);
    if (!updated) throw new Error('Staff member not found');
    return {
      success: true,
      data: updated,
      message: 'Staff member updated locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Update staff availability
 */
export async function updateStaffAvailability(
  id: string,
  availability: 'available' | 'busy' | 'break' | 'offline'
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/${id}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ availability }),
    });
    if (!response.ok) throw new Error('Failed to update staff availability');
    return response.json();
  } catch {
    const updated = updateLocalStaff(id, { availability } as any);
    if (!updated) throw new Error('Staff member not found');
    return {
      success: true,
      data: updated,
      message: 'Availability updated locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Update staff skills
 */
export async function updateStaffSkills(id: string, skills: string[]) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/${id}/skills`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills }),
    });
    if (!response.ok) throw new Error('Failed to update staff skills');
    return response.json();
  } catch {
    const updated = updateLocalStaff(id, { skills } as any);
    if (!updated) throw new Error('Staff member not found');
    return {
      success: true,
      data: updated,
      message: 'Skills updated locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Assign staff to counter
 */
export async function assignStaffToCounter(id: string, counterId: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counterId }),
    });
    if (!response.ok) throw new Error('Failed to assign staff to counter');
    return response.json();
  } catch {
    const updated = updateLocalStaff(id, {
      currentCounter: counterId ? Number(counterId) : null,
      availability: counterId ? 'busy' : 'available',
      lastMovedAt: new Date().toISOString(),
    } as any);
    if (!updated) throw new Error('Staff member not found');
    return {
      success: true,
      data: updated,
      message: 'Staff assignment updated locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Delete staff member
 */
export async function deleteStaff(id: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete staff member');
    return response.json();
  } catch {
    const ok = deleteLocalStaff(id);
    if (!ok) throw new Error('Staff member not found');
    return {
      success: true,
      message: 'Staff member deleted locally',
      source: 'local-fallback',
    };
  }
}

/**
 * Get optimized staff allocation from AI Engine (via backend)
 */
export async function getOptimizedStaff(params: {
  currentQueueLoad: Record<string, number>;
  predictedQueueLoad?: Record<string, number>;
  timeSlots?: number[];
  budget?: number;
}) {
  const response = await fetch(`${BACKEND_URL}/api/allocate/now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) throw new Error('Failed to get optimized staff allocation');
  return response.json();
}

/**
 * Apply allocation map to persist current staff-to-counter state.
 */
export async function applyStaffAllocationState(allocation: Record<string, string[]>) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/staff/apply-allocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocation }),
    });
    if (!response.ok) {
      let message = 'Failed to apply allocation state';
      try {
        const body = await response.json();
        if (body?.error) {
          message = body.error;
        }
      } catch {
        // Keep fallback error message.
      }
      throw new Error(message);
    }
    return response.json();
  } catch {
    const data = applyLocalStaffAllocationState(allocation);
    return {
      success: true,
      data,
      message: 'Allocation applied locally',
      source: 'local-fallback',
    };
  }
}
