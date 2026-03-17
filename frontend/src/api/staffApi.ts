/**
 * Staff API - HTTP requests for staff management
 * Talks to: Backend /api/staff
 */

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

  const response = await fetch(`${BACKEND_URL}/api/staff?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch staff list');
  return response.json();
}

/**
 * Get count of available staff
 */
export async function getAvailableStaffCount() {
  const response = await fetch(`${BACKEND_URL}/api/staff/available/count`);
  if (!response.ok) throw new Error('Failed to fetch available staff count');
  return response.json();
}

/**
 * Get single staff member by ID
 */
export async function getStaffById(id: string) {
  const response = await fetch(`${BACKEND_URL}/api/staff/${id}`);
  if (!response.ok) throw new Error('Failed to fetch staff member');
  return response.json();
}

/**
 * Create new staff member
 */
export async function createStaff(staffData: StaffMember) {
  const response = await fetch(`${BACKEND_URL}/api/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(staffData),
  });
  if (!response.ok) throw new Error('Failed to create staff member');
  return response.json();
}

/**
 * Update staff member (full update)
 */
export async function updateStaff(id: string, staffData: StaffMember) {
  const response = await fetch(`${BACKEND_URL}/api/staff/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(staffData),
  });
  if (!response.ok) throw new Error('Failed to update staff member');
  return response.json();
}

/**
 * Update staff availability
 */
export async function updateStaffAvailability(
  id: string,
  availability: 'available' | 'busy' | 'break' | 'offline'
) {
  const response = await fetch(`${BACKEND_URL}/api/staff/${id}/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ availability }),
  });
  if (!response.ok) throw new Error('Failed to update staff availability');
  return response.json();
}

/**
 * Update staff skills
 */
export async function updateStaffSkills(id: string, skills: string[]) {
  const response = await fetch(`${BACKEND_URL}/api/staff/${id}/skills`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skills }),
  });
  if (!response.ok) throw new Error('Failed to update staff skills');
  return response.json();
}

/**
 * Assign staff to counter
 */
export async function assignStaffToCounter(id: string, counterId: string) {
  const response = await fetch(`${BACKEND_URL}/api/staff/${id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ counterId }),
  });
  if (!response.ok) throw new Error('Failed to assign staff to counter');
  return response.json();
}

/**
 * Delete staff member
 */
export async function deleteStaff(id: string) {
  const response = await fetch(`${BACKEND_URL}/api/staff/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete staff member');
  return response.json();
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
