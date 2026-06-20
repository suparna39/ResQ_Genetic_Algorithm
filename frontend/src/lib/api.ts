import axios, { AxiosError } from 'axios';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ── Request interceptor — attach stored token as Bearer ─────────
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor — extract data or throw clean errors ──
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ── Auth ────────────────────────────────────────────────────────
export const authApi = {
  me: () => api.get('/auth/me'),
};

// ── Emergency ───────────────────────────────────────────────────
export const emergencyApi = {
  create: (data: {
    emergency_type: string;
    description: string;
    latitude: number;
    longitude: number;
  }) => api.post('/emergency/create', data),

  getById: (id: string) => api.get(`/emergency/${id}`),
  getAll: () => api.get('/emergency/all'),
  getMy: () => api.get('/emergency/my'),
  /** Get the assignment (+ ambulance info) for a given emergency request ID */
  getAssignment: (requestId: string) => api.get(`/emergency/${requestId}/assignment`),
  updateStatus: (id: string, status: string, priority?: string) =>
    api.patch(`/emergency/${id}/status`, { status, priority }),
};

// ── Ambulance ───────────────────────────────────────────────────
export const ambulanceApi = {
  getAll: () => api.get('/ambulance/all'),
  getAvailable: () => api.get('/ambulance/available'),
  getMine: () => api.get('/ambulance/mine'),
  updateStatus: (id: string, status: string) =>
    api.patch(`/ambulance/status/${id}`, { status }),
  updateLocation: (data: {
    latitude: number;
    longitude: number;
    assignment_id?: string;
  }) => api.post('/ambulance/location', data),
};

// ── Assignment ──────────────────────────────────────────────────
export const assignmentApi = {
  getById: (id: string) => api.get(`/assignment/${id}`),
  getAll: () => api.get('/assignment/all'),
  getMine: () => api.get('/assignment/mine'),      // ← driver only
  accept: (id: string) => api.patch(`/assignment/${id}/accept`),
  pickup: (id: string) => api.patch(`/assignment/${id}/pickup`),
  complete: (id: string) => api.patch(`/assignment/${id}/complete`),
};

// ── Tracking ────────────────────────────────────────────────────
export const trackingApi = {
  update: (data: {
    assignment_id: string;
    latitude: number;
    longitude: number;
  }) => api.post('/tracking/update', data),
  getHistory: (assignmentId: string) =>
    api.get(`/tracking/${assignmentId}`),
};

// ── Admin ───────────────────────────────────────────────────────
export const adminApi = {
  getMetrics: () => api.get('/admin/metrics'),
  getRecentRequests: (limit?: number) =>
    api.get('/admin/recent-requests', { params: { limit } }),
};
