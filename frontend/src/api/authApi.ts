/**
 * Auth API - HTTP requests for authentication
 * Talks to: Backend /api/auth (to be implemented)
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface LoginCredentials {
  username: string;
  password: string;
}

interface User {
  id: string;
  username: string;
  role: string;
  token?: string;
}

/**
 * Login user
 */
export async function login(credentials: LoginCredentials): Promise<User> {
  const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) throw new Error('Login failed');
  return response.json();
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Logout failed');
  return response.json();
}

/**
 * Get current user session
 */
export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to get current user');
  return response.json();
}

/**
 * Verify token
 */
export async function verifyToken(token: string): Promise<boolean> {
  const response = await fetch(`${BACKEND_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!response.ok) return false;
  return response.json();
}

/**
 * Refresh authentication token
 */
export async function refreshToken(): Promise<{ token: string }> {
  const response = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Failed to refresh token');
  return response.json();
}
