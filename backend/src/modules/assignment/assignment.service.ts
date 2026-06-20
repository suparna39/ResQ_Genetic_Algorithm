import { supabaseAdmin } from '../../config/supabase';
import {
  EmergencyRequest,
  Assignment,
} from '../../types';
import { AppError } from '../../middleware/errorHandler';
import { getAvailableAmbulancesService, updateAmbulanceStatusService } from '../ambulance/ambulance.service';
import { updateEmergencyStatusService } from '../emergency/emergency.service';
import { getIo } from '../../sockets/socket';
import {
  predictPriority,
  predictTraffic,
  predictHotspot,
  optimizeAmbulance,
} from './ai.service';

// ─── Full Allocation Pipeline ─────────────────────────────────────────────────
// Orchestrates the real AI-ML microservice end to end:
//   1. /predict-priority  → emergency severity
//   2. /predict-traffic   → congestion multiplier (affects ETA)
//   3. /predict-hotspot   → location risk score
//   4. /optimize-ambulance→ Genetic Algorithm picks the best unit
// Each step degrades gracefully to a deterministic fallback if the Python
// service is offline, so dispatch never crashes.

export const triggerAllocationService = async (
  request: EmergencyRequest
): Promise<Assignment> => {
  const io = getIo();

  // Step 1: Predict priority (AI model 1)
  const { priority, confidence: priorityConfidence } = await predictPriority(request);
  await updateEmergencyStatusService(request.id, 'pending', priority);

  // Step 2: Get available ambulances
  const ambulances = await getAvailableAmbulancesService();
  if (ambulances.length === 0) {
    throw new AppError('No available ambulances', 503);
  }

  // Step 3: Context for the GA — traffic multiplier (model 3) + hotspot risk (model 2).
  // Run concurrently; both have safe fallbacks.
  const [traffic, hotspot] = await Promise.all([
    predictTraffic(),
    predictHotspot(request),
  ]);

  // Step 4: GA allocation (model 4 / GA engine)
  const allocation = await optimizeAmbulance(
    request,
    ambulances,
    priority,
    hotspot.risk_score,
    traffic.congestion_multiplier
  );

  if (!allocation.best_ambulance_id) {
    throw new AppError('No available ambulances', 503);
  }

  const etaMinutes = Math.max(1, Math.round(allocation.estimated_eta_minutes ?? 0));

  // ── Build the GA intelligence snapshot ──────────────────────────────────────
  // Captures *why* this unit was chosen so the patient & driver UIs can render
  // the genetic-algorithm reasoning. Includes every candidate (with coordinates)
  // so the frontend can animate the GA candidate-scan over the map.
  const winner = ambulances.find((a) => a.id === allocation.best_ambulance_id);
  const backupIds = new Set(allocation.backup_suggestions.map((b) => b.ambulance_id));
  const gaMetrics = {
    engine: allocation.fallback ? ('heuristic' as const) : ('genetic_algorithm' as const),
    fallback: allocation.fallback,
    priority,
    priority_confidence: Math.round((priorityConfidence ?? 0.5) * 100) / 100,
    traffic_level: traffic.traffic_level,
    congestion_multiplier: traffic.congestion_multiplier,
    congestion_pct: traffic.congestion_pct,
    hotspot_risk: Math.round(hotspot.risk_score * 100) / 100,
    hotspot_category: hotspot.risk_category,
    fitness_score: allocation.fitness_score,
    distance_km: allocation.distance_km,
    eta_minutes: etaMinutes,
    reason: allocation.reason_for_assignment,
    generations_run: allocation.generations_run ?? null,
    population_size: allocation.population_size ?? null,
    fleet_size: ambulances.length,
    candidates_evaluated: ambulances.filter((a) => a.status === 'available').length,
    backup_suggestions: allocation.backup_suggestions,
    // Candidate roster with coordinates → drives the map GA-scan animation.
    candidates: ambulances
      .filter((a) => a.status === 'available')
      .map((a) => ({
        id: a.id,
        vehicle_number: a.vehicle_number,
        latitude: a.latitude,
        longitude: a.longitude,
        is_winner: a.id === allocation.best_ambulance_id,
        is_backup: backupIds.has(a.id),
        fitness:
          allocation.backup_suggestions.find((b) => b.ambulance_id === a.id)?.fitness ??
          (a.id === allocation.best_ambulance_id ? allocation.fitness_score : null),
      })),
    winner: winner
      ? { id: winner.id, vehicle_number: winner.vehicle_number, latitude: winner.latitude, longitude: winner.longitude }
      : null,
    computed_at: new Date().toISOString(),
  };

  // Step 5: Save assignment
  const { data: assignment, error } = await supabaseAdmin
    .from('assignments')
    .insert({
      request_id: request.id,
      ambulance_id: allocation.best_ambulance_id,
      eta: etaMinutes,
      assigned_at: new Date().toISOString(),
      status: 'assigned',
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Persist GA metrics if the (optional) jsonb column exists. Wrapped so a
  // missing column can never break dispatch — the live socket payload still
  // carries the metrics regardless.
  try {
    await supabaseAdmin
      .from('assignments')
      .update({ ga_metrics: gaMetrics })
      .eq('id', assignment.id);
  } catch {
    /* column not migrated yet — non-critical */
  }

  // Step 6: Update request and ambulance status
  await updateEmergencyStatusService(request.id, 'assigned', priority);
  await updateAmbulanceStatusService(allocation.best_ambulance_id, 'busy');

  console.log(
    `🧬 GA dispatch [${allocation.fallback ? 'fallback' : 'ai-ml'}] · priority=${priority} · ` +
      `traffic=${traffic.traffic_level}(${traffic.congestion_multiplier}x) · ` +
      `risk=${hotspot.risk_category}(${hotspot.risk_score.toFixed(2)}) · ` +
      `eta=${etaMinutes}min · ${allocation.reason_for_assignment}`
  );

  // Step 7: Real-time notifications
  // Fetch the chosen ambulance to get driver_id
  const { data: ambRow } = await supabaseAdmin
    .from('ambulances')
    .select('driver_id')
    .eq('id', allocation.best_ambulance_id)
    .single();

  // Fetch the full assignment with joins for the notification payload
  const { data: fullAssignment } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .eq('id', assignment.id)
    .single();

  // Merge GA metrics onto the assignment object so every client receives them
  // (driver cockpit, patient command center, admin) even without the DB column.
  const assignmentWithGa = { ...(fullAssignment || assignment), ga_metrics: gaMetrics };

  const notifyPayload = {
    assignment: assignmentWithGa,
    request: { ...request, priority },
    eta: etaMinutes,
    ga_metrics: gaMetrics,
  };

  // Notify specific driver by user ID (if ambulance has a driver linked)
  if (ambRow?.driver_id) {
    io.to(`driver:${ambRow.driver_id}`).emit('assignment:new', notifyPayload);
  }
  // Also broadcast to ALL drivers room so unlinked drivers can see it
  io.to('drivers').emit('assignment:new', notifyPayload);
  // Admin room
  io.to('admin').emit('assignment:new', notifyPayload);

  io.to(`patient:${request.patient_id}`).emit('request:status_change', {
    request_id: request.id,
    status: 'assigned',
    priority,
    assignment_id: assignment.id,
    eta: etaMinutes,
    ga_metrics: gaMetrics,
  });

  return assignment as Assignment;
};

// ─── Assignment CRUD ──────────────────────────────────────────────────────────

export const getAssignmentByIdService = async (id: string): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .eq('id', id)
    .single();

  if (error || !data) throw new AppError('Assignment not found', 404);
  return data as unknown as Assignment;
};

export const getAllAssignmentsService = async (): Promise<Assignment[]> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .order('assigned_at', { ascending: false });

  if (error) throw new AppError(error.message, 500);
  return (data || []) as unknown as Assignment[];
};

/**
 * Get assignments for the currently-logged-in driver.
 * Looks up their ambulance by driver_id = user.id, then returns assignments for that ambulance.
 * If no ambulance is linked yet, returns the most recent unassigned active assignments
 * so the driver can still pick up work.
 */
export const getMyAssignmentsService = async (driverId: string): Promise<Assignment[]> => {
  // Find ambulance linked to this driver
  const { data: ambData } = await supabaseAdmin
    .from('ambulances')
    .select('id')
    .eq('driver_id', driverId)
    .single();

  if (ambData?.id) {
    // Driver has an ambulance — return its assignments
    const { data, error } = await supabaseAdmin
      .from('assignments')
      .select('*, emergency_requests(*), ambulances(*)')
      .eq('ambulance_id', ambData.id)
      .not('status', 'in', '("completed","cancelled")')
      .order('assigned_at', { ascending: false });

    if (error) throw new AppError(error.message, 500);
    return (data || []) as unknown as Assignment[];
  }

  // No ambulance linked — return all active assignments (driver can claim any)
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .not('status', 'in', '("completed","cancelled")')
    .order('assigned_at', { ascending: false })
    .limit(10);

  if (error) throw new AppError(error.message, 500);
  return (data || []) as unknown as Assignment[];
};

export const acceptAssignmentService = async (
  id: string
): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({
      accepted_at: new Date().toISOString(),
      status: 'accepted',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Also update the emergency request status
  await updateEmergencyStatusService((data as any).request_id, 'accepted');

  // Fetch request so we can notify the patient by their patient room
  const { data: reqRow } = await supabaseAdmin
    .from('emergency_requests')
    .select('patient_id')
    .eq('id', (data as any).request_id)
    .single();

  if (reqRow?.patient_id) {
    const io = getIo();
    io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', {
      request_id: (data as any).request_id,
      status: 'accepted',
      assignment_id: id,
    });
  }

  // Return the FULL assignment (with request + ambulance joins) so the driver
  // dashboard keeps patient coordinates for the route-search visualisation.
  const { data: full } = await supabaseAdmin
    .from('assignments')
    .select('*, emergency_requests(*), ambulances(*)')
    .eq('id', id)
    .single();

  return (full || data) as unknown as Assignment;
};

/**
 * Auto-advance assignment from accepted → en_route.
 * Called by setTimeout 10 seconds after driver accepts.
 * Uses top-level imports (no dynamic import) so it always works in CJS.
 */
export const enRouteAssignmentService = async (id: string): Promise<void> => {
  const io = getIo();

  const { data: asnRow } = await supabaseAdmin
    .from('assignments')
    .select('request_id, status')
    .eq('id', id)
    .single();

  // Only advance if driver hasn't already moved to a later status
  if (!asnRow || asnRow.status !== 'accepted') return;

  await supabaseAdmin
    .from('assignments')
    .update({ status: 'en_route' })
    .eq('id', id);

  await updateEmergencyStatusService(asnRow.request_id, 'en_route');

  const { data: reqRow } = await supabaseAdmin
    .from('emergency_requests')
    .select('patient_id')
    .eq('id', asnRow.request_id)
    .single();

  const payload = {
    request_id: asnRow.request_id,
    status: 'en_route',
    assignment_id: id,
  };

  io.to(`assignment:${id}`).emit('request:status_change', payload);
  if (reqRow?.patient_id) {
    io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', payload);
  }

  console.log(`✅ auto en_route fired for assignment ${id}`);
};

export const pickupAssignmentService = async (
  id: string
): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({ status: 'picked_up' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  await updateEmergencyStatusService((data as any).request_id, 'picked_up');

  // Notify patient
  const { data: reqRow } = await supabaseAdmin
    .from('emergency_requests')
    .select('patient_id')
    .eq('id', (data as any).request_id)
    .single();

  const io = getIo();
  io.to(`assignment:${id}`).emit('request:status_change', {
    request_id: (data as any).request_id,
    status: 'picked_up',
    assignment_id: id,
  });
  if (reqRow?.patient_id) {
    io.to(`patient:${reqRow.patient_id}`).emit('request:status_change', {
      request_id: (data as any).request_id,
      status: 'picked_up',
      assignment_id: id,
    });
  }

  return data as unknown as Assignment;
};

export const completeAssignmentService = async (
  id: string
): Promise<Assignment> => {
  const { data, error } = await supabaseAdmin
    .from('assignments')
    .update({
      completed_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Update related records
  await updateEmergencyStatusService((data as any).request_id, 'completed');
  await updateAmbulanceStatusService((data as any).ambulance_id, 'available');

  return data as unknown as Assignment;
};
