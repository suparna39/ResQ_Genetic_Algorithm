/**
 * AI-ML service client.
 *
 * Wraps the Python FastAPI microservice (see ai-ml/api_doc.md):
 *   POST /predict-priority    → emergency severity (Low/Medium/High/Critical)
 *   POST /predict-traffic     → congestion % + ETA multiplier
 *   POST /predict-hotspot     → location risk score 0–1
 *   POST /optimize-ambulance  → GA dispatch (best unit + backups + ETA)
 *
 * Every call has a short timeout and a deterministic fallback so the
 * allocation pipeline never crashes when the Python service is offline.
 */

import axios from 'axios';
import { env } from '../../config/env';
import { Ambulance, EmergencyRequest, Priority } from '../../types';

// ── Axios instance with sane defaults ────────────────────────────────────────
const aiClient = axios.create({
  baseURL: env.AI_ML_SERVICE_URL,
  timeout: 6000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Priority casing helpers ──────────────────────────────────────────────────
// The AI service returns capitalised classes ("Critical"); our DB stores
// lowercase ("critical"). Map in both directions.
const AI_TO_DB_PRIORITY: Record<string, Priority> = {
  Low: 'low',
  Medium: 'medium',
  High: 'high',
  Critical: 'critical',
};

const DB_TO_AI_PRIORITY: Record<Priority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function toDbPriority(aiClass: string | undefined): Priority {
  if (!aiClass) return 'high';
  return AI_TO_DB_PRIORITY[aiClass] ?? 'high';
}

export function toAiPriority(priority: Priority | null | undefined): string {
  if (!priority) return 'High';
  return DB_TO_AI_PRIORITY[priority] ?? 'High';
}

// ── Emergency type → accident-style features the priority model expects ───────
// The priority model was trained on road-accident data, so map our richer
// emergency types onto reasonable casualty/severity hints.
const HIGH_SEVERITY_TYPES = new Set([
  'cardiac_arrest',
  'stroke',
  'respiratory',
  'drowning',
]);

// ── AI result shapes ─────────────────────────────────────────────────────────
export interface PriorityResult {
  priority: Priority;
  confidence: number;
}

export interface TrafficResult {
  congestion_pct: number;
  congestion_multiplier: number;
  traffic_level: string;
}

export interface HotspotResult {
  risk_score: number;
  risk_category: string;
}

export interface OptimizeBackup {
  ambulance_id: string;
  fitness: number;
  eta_minutes: number;
}

export interface OptimizeResult {
  best_ambulance_id: string | null;
  estimated_eta_minutes: number | null;
  fitness_score: number | null;
  distance_km: number | null;
  backup_suggestions: OptimizeBackup[];
  reason_for_assignment: string;
  /** GA run statistics (when the genetic algorithm produced the result) */
  generations_run: number | null;
  population_size: number | null;
  /** true when the result came from the rule-based fallback, not the GA service */
  fallback: boolean;
}

// ── Capability level: derive from vehicle number until the column exists ──────
// The DB ambulances table has no capability_level column yet, so we infer one
// from the vehicle number tag (MICU/ALS/BLS) and otherwise default to 2 (ALS basic).
function deriveCapabilityLevel(amb: Ambulance): number {
  const tag = (amb.vehicle_number || '').toUpperCase();
  if (tag.includes('MICU')) return 4;
  if (tag.includes('ALS')) return 3;
  if (tag.includes('BLS')) return 1;
  return 2;
}

// ── Time features shared by several calls ─────────────────────────────────────
function timeFeatures() {
  const now = new Date();
  const dow = now.getDay(); // 0=Sunday in JS
  // Python convention: 0=Monday … 6=Sunday. Convert.
  const day_of_week = dow === 0 ? 6 : dow - 1;
  return {
    hour: now.getHours(),
    day_of_week,
    month: now.getMonth() + 1,
    is_weekend: day_of_week >= 5 ? 1 : 0,
  };
}

/**
 * Predict emergency priority via POST /predict-priority.
 * Falls back to a rule based on emergency type when the service is unavailable.
 */
export async function predictPriority(
  request: EmergencyRequest
): Promise<PriorityResult> {
  const t = timeFeatures();
  const isHigh = HIGH_SEVERITY_TYPES.has(request.emergency_type);

  try {
    const { data } = await aiClient.post('/predict-priority', {
      emergency_type: request.emergency_type,
      weather: 'clear',
      road_condition: 'dry',
      road_type: 'urban road',
      hour: t.hour,
      day_of_week: t.day_of_week,
      month: t.month,
      num_vehicles: 1,
      // Bias the accident-trained model using our emergency type
      num_casualties: isHigh ? 3 : 1,
      num_fatalities: 0,
      speed_limit: 50,
      alcohol_involvement: 'No',
      state: 'Unknown',
      city: 'Unknown',
    });

    return {
      priority: toDbPriority(data?.priority_class),
      confidence: typeof data?.confidence === 'number' ? data.confidence : 0.5,
    };
  } catch {
    console.warn('⚠️  /predict-priority unavailable — using rule-based fallback.');
    return { priority: isHigh ? 'critical' : 'high', confidence: 0.5 };
  }
}

/**
 * Estimate traffic congestion multiplier via POST /predict-traffic.
 * Falls back to a mild 1.3× multiplier when unavailable.
 */
export async function predictTraffic(): Promise<TrafficResult> {
  const t = timeFeatures();
  try {
    const { data } = await aiClient.post('/predict-traffic', {
      hour: t.hour,
      day_of_week: t.day_of_week,
      is_weekend: t.is_weekend,
      road_type: 'urban',
      monthly_avg_congestion: 40,
    });
    return {
      congestion_pct: data?.congestion_pct ?? 30,
      congestion_multiplier:
        typeof data?.congestion_multiplier === 'number'
          ? data.congestion_multiplier
          : 1.3,
      traffic_level: data?.traffic_level ?? 'Moderate',
    };
  } catch {
    console.warn('⚠️  /predict-traffic unavailable — using default multiplier.');
    return { congestion_pct: 30, congestion_multiplier: 1.3, traffic_level: 'Moderate' };
  }
}

/**
 * Estimate location hotspot risk via POST /predict-hotspot.
 * Falls back to a neutral 0.5 risk when unavailable.
 */
export async function predictHotspot(
  request: EmergencyRequest
): Promise<HotspotResult> {
  const t = timeFeatures();
  try {
    const { data } = await aiClient.post('/predict-hotspot', {
      city: 'Unknown',
      state: 'Unknown',
      latitude: request.latitude,
      longitude: request.longitude,
      hour: t.hour,
      day_of_week: t.day_of_week,
      month: t.month,
      weather: 'clear',
      road_type: 'urban',
      visibility: 'high',
      traffic_density: 'medium',
    });
    return {
      risk_score: typeof data?.risk_score === 'number' ? data.risk_score : 0.5,
      risk_category: data?.risk_category ?? 'Medium',
    };
  } catch {
    console.warn('⚠️  /predict-hotspot unavailable — using neutral risk.');
    return { risk_score: 0.5, risk_category: 'Medium' };
  }
}

// ── Haversine (used only by the local fallback) ──────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Pick the best ambulance via the Genetic Algorithm (POST /optimize-ambulance).
 *
 * When the AI service is unreachable, falls back to a nearest-available
 * heuristic so dispatch always succeeds.
 */
export async function optimizeAmbulance(
  request: EmergencyRequest,
  ambulances: Ambulance[],
  priority: Priority,
  hotspotRisk: number,
  congestionMultiplier: number
): Promise<OptimizeResult> {
  // Only available ambulances are dispatch candidates.
  const candidates = ambulances.filter((a) => a.status === 'available');

  try {
    const { data } = await aiClient.post('/optimize-ambulance', {
      patient_lat: request.latitude,
      patient_lon: request.longitude,
      emergency_type: request.emergency_type,
      priority_class: toAiPriority(priority),
      hotspot_risk: hotspotRisk,
      congestion_multiplier: congestionMultiplier,
      ambulances: candidates.map((a) => ({
        id: a.id,
        latitude: a.latitude,
        longitude: a.longitude,
        status: a.status,
        capability_level: deriveCapabilityLevel(a),
      })),
    });

    return {
      best_ambulance_id: data?.best_ambulance_id ?? null,
      estimated_eta_minutes: data?.estimated_eta_minutes ?? null,
      fitness_score: data?.fitness_score ?? null,
      distance_km: data?.distance_km ?? null,
      backup_suggestions: Array.isArray(data?.backup_suggestions)
        ? data.backup_suggestions
        : [],
      reason_for_assignment:
        data?.reason_for_assignment ?? 'Ambulance selected by Genetic Algorithm.',
      generations_run: data?.ga_metadata?.generations_run ?? null,
      population_size: data?.ga_metadata?.population_size ?? null,
      fallback: false,
    };
  } catch {
    console.warn('⚠️  /optimize-ambulance unavailable — using nearest-available fallback.');
    return nearestAvailableFallback(request, candidates, congestionMultiplier);
  }
}

/**
 * Deterministic fallback: choose the nearest available ambulance by Haversine,
 * estimate ETA from distance + traffic multiplier (matches the Python geo model:
 * road distance ≈ 1.3× straight line, base urban speed 25 km/h).
 */
function nearestAvailableFallback(
  request: EmergencyRequest,
  candidates: Ambulance[],
  congestionMultiplier: number
): OptimizeResult {
  if (candidates.length === 0) {
    return {
      best_ambulance_id: null,
      estimated_eta_minutes: null,
      fitness_score: null,
      distance_km: null,
      backup_suggestions: [],
      reason_for_assignment: 'No available ambulances in the fleet.',
      generations_run: null,
      population_size: null,
      fallback: true,
    };
  }

  const ranked = candidates
    .map((a) => ({
      amb: a,
      dist: haversineKm(request.latitude, request.longitude, a.latitude, a.longitude),
    }))
    .sort((x, y) => x.dist - y.dist);

  const etaFor = (distKm: number) => {
    const effectiveSpeed = 25 / Math.max(congestionMultiplier, 1);
    return Math.round(((distKm * 1.3) / effectiveSpeed) * 60 * 10) / 10;
  };

  const best = ranked[0];
  return {
    best_ambulance_id: best.amb.id,
    estimated_eta_minutes: etaFor(best.dist),
    fitness_score: null,
    distance_km: Math.round(best.dist * 1000) / 1000,
    backup_suggestions: ranked.slice(1, 3).map((r) => ({
      ambulance_id: r.amb.id,
      fitness: 0,
      eta_minutes: etaFor(r.dist),
    })),
    reason_for_assignment: `Nearest available ambulance selected (fallback). Distance: ${best.dist.toFixed(
      2
    )} km.`,
    generations_run: null,
    population_size: null,
    fallback: true,
  };
}
