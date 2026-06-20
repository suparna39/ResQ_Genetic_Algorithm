// ============================================
// Shared TypeScript Types for Backend
// ============================================

export type UserRole = 'patient' | 'driver' | 'admin';

export type EmergencyType =
  | 'cardiac_arrest'
  | 'accident'
  | 'stroke'
  | 'respiratory'
  | 'trauma'
  | 'fire'
  | 'drowning'
  | 'other';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type RequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'en_route'
  | 'picked_up'
  | 'completed'
  | 'cancelled';

export type AmbulanceStatus = 'available' | 'busy' | 'offline';

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at: string;
}

export interface Ambulance {
  id: string;
  driver_id: string | null;
  vehicle_number: string;
  status: AmbulanceStatus;
  latitude: number;
  longitude: number;
  last_updated: string;
}

export interface Hospital {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  contact_number: string;
  capacity: number;
}

export interface EmergencyRequest {
  id: string;
  patient_id: string;
  emergency_type: EmergencyType;
  description: string;
  priority: Priority | null;
  status: RequestStatus;
  latitude: number;
  longitude: number;
  created_at: string;
}

export interface Assignment {
  id: string;
  request_id: string;
  ambulance_id: string;
  eta: number; // minutes
  assigned_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  status: RequestStatus;
}

export interface TrackingLog {
  id: string;
  assignment_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// ─── AI/ML Service Types ──────────────────────────────────────────────────────

export interface PredictionInput {
  emergency_type: EmergencyType;
  hour: number;
  day_of_week: number;
  traffic_level: number; // 1-5
  weather: string;
  latitude: number;
  longitude: number;
}

export interface PredictionOutput {
  priority: Priority;
  confidence: number;
}

// ─── GA Allocation Types ─────────────────────────────────────────────────────

export interface AllocationInput {
  request: EmergencyRequest;
  ambulances: Ambulance[];
  priority: Priority;
}

export interface AllocationOutput {
  ambulance_id: string;
  estimated_eta: number; // minutes
  distance_km: number;
}
