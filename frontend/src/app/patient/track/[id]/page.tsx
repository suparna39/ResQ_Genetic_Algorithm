'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, Clock, Truck, CheckCircle, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useRoute } from '@/hooks/useRoute';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import StatusStepper from '@/components/dashboard/StatusStepper';
import GAMetricsPanel from '@/components/dashboard/GAMetricsPanel';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import { EmergencyRequest, DriverLocationEvent, RequestStatusEvent, GAMetrics } from '@/types';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

interface AssignmentData {
  id: string;
  eta: number;
  status: string;
  ga_metrics?: GAMetrics;
  ambulances?: {
    vehicle_number: string;
    latitude: number;
    longitude: number;
    status: string;
  };
}

export default function TrackPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on, isConnected } = useSocket();

  const [request, setRequest] = useState<EmergencyRequest | null>(null);
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [ambulancePos, setAmbulancePos] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [assignmentRoomId, setAssignmentRoomId] = useState<string | null>(null);
  const [gaMetrics, setGaMetrics] = useState<GAMetrics | null>(null);
  const [gaScan, setGaScan] = useState<{
    patient: [number, number];
    candidates: { lng: number; lat: number; isWinner: boolean; fitness: number | null }[];
    runId: number;
  } | null>(null);
  const gaScanRunIdRef = useRef(0);

  // Once a live socket GPS update arrives, stop letting the 10-second DB poll
  // overwrite ambulancePos with stale coordinates (which may match patient's location).
  const hasLivePosRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  // ── Load request + assignment ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!user || !id) return;
    try {
      const reqRes = await emergencyApi.getById(id);
      if (reqRes.data.success) {
        setRequest(reqRes.data.data as EmergencyRequest);
      }

      const asnRes = await emergencyApi.getAssignment(id);
      if (asnRes.data.success && asnRes.data.data) {
        const asn = asnRes.data.data as AssignmentData;
        setAssignment(asn);

        // Capture GA decision metrics + trigger the candidate-scan animation once.
        if (asn.ga_metrics) {
          setGaMetrics(asn.ga_metrics);
          const reqData = reqRes.data?.data as EmergencyRequest | undefined;
          if (reqData?.latitude && reqData?.longitude && asn.ga_metrics.candidates?.length) {
            gaScanRunIdRef.current += 1;
            setGaScan({
              patient: [reqData.longitude, reqData.latitude],
              candidates: asn.ga_metrics.candidates.map((c) => ({
                lng: c.longitude, lat: c.latitude, isWinner: c.is_winner, fitness: c.fitness,
              })),
              runId: gaScanRunIdRef.current,
            });
          }
        }

        // Seed ambulancePos from DB if the driver has already shared their location
        // AND we haven't received a live socket update yet.
        // The socket relay now persists the driver's real location to ambulances table,
        // so this value reflects where the driver actually is (not just their home coords).
        if (asn.ambulances?.latitude && asn.ambulances?.longitude && !hasLivePosRef.current) {
          setAmbulancePos({
            lat: asn.ambulances.latitude,
            lng: asn.ambulances.longitude,
          });
        }

        if (asn.id) setAssignmentRoomId(asn.id);
      }
    } catch {
      // silently ignore — assignment may not exist yet
    } finally {
      setIsLoading(false);
    }
  }, [user, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Socket rooms ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) joinRoom('join:patient', user.id);
  }, [user, joinRoom]);

  // Join assignment room whenever we learn the assignment ID (from loadData or socket event).
  useEffect(() => {
    if (assignmentRoomId) joinRoom('join:assignment', assignmentRoomId);
  }, [assignmentRoomId, joinRoom]);

  // ── Real-time: driver location ────────────────────────────────────────────
  useEffect(() => {
    const unsub = on<DriverLocationEvent>('driver:location_update', (data) => {
      hasLivePosRef.current = true; // lock: loadData must not overwrite from now on
      setAmbulancePos({ lat: data.latitude, lng: data.longitude });
    });
    return unsub;
  }, [on]);

  // ── Real-time: status changes ─────────────────────────────────────────────
  // Exactly [on, loadData] — size never changes between renders.
  useEffect(() => {
    const unsub = on<RequestStatusEvent>('request:status_change', (data) => {
      setRequest((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: data.status as any,
          ...(data.priority ? { priority: data.priority as any } : {}),
        };
      });

      setAssignment((prev) => {
        if (!prev) return prev;
        return { ...prev, status: data.status, ...(data.eta ? { eta: data.eta } : {}) };
      });

      // If we received an assignment_id we didn't know about, join that room.
      if (data.assignment_id) setAssignmentRoomId(data.assignment_id);

      loadData();

      const statusLabels: Record<string, string> = {
        assigned:  '🚑 Ambulance assigned to you',
        accepted:  '✅ Driver accepted — heading to you',
        en_route:  '🚨 Ambulance is en route!',
        picked_up: '🏥 On board — heading to hospital',
        completed: '✓ Trip completed',
      };
      toast.info(statusLabels[data.status] ?? `Status: ${data.status.replace(/_/g, ' ')}`, { duration: 5000 });
    });
    return unsub;
  }, [on, loadData]);

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !id) return;
    pollRef.current = setInterval(loadData, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadData]);

  // ── Derived values — ALL useMemo/useMemo-like must be ABOVE early returns ─
  // Rules of Hooks: hooks cannot appear after conditional returns.

  const mapMarkers = useMemo(() => {
    const base = request
      ? [{ lat: request.latitude, lng: request.longitude, type: 'patient' as const, label: 'Your location' }]
      : [];
    const ambPin = ambulancePos
      ? [{ lat: ambulancePos.lat, lng: ambulancePos.lng, type: 'ambulance' as const,
           label: `Ambulance · ${assignment?.ambulances?.vehicle_number ?? 'En route'}` }]
      : [];
    return [...base, ...ambPin];
  }, [request?.latitude, request?.longitude, ambulancePos, assignment?.ambulances?.vehicle_number]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (request?.latitude && request?.longitude) return [request.latitude, request.longitude];
    return [12.97, 77.59];
  }, [request?.latitude, request?.longitude]);

  // ── Live road route: ambulance → patient ──────────────────────────────────
  // Memoise the two endpoints so the routing hook only refires on real moves.
  const patientPos = useMemo(
    () => (request ? { lat: request.latitude, lng: request.longitude } : null),
    [request?.latitude, request?.longitude]
  );
  // Only draw the route while the trip is heading TO the patient. Once picked up,
  // the ambulance→patient leg is no longer meaningful.
  const showRouteToPatient =
    !!assignment && !['picked_up', 'completed', 'cancelled'].includes(assignment.status);
  const { route } = useRoute(
    showRouteToPatient ? ambulancePos : null,
    showRouteToPatient ? patientPos : null
  );

  // ── Early returns — only after ALL hooks ─────────────────────────────────
  if (isLoading || authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!request) {
    return (
      <div>
        <Sidebar role="patient" userName={user?.name || ''} onLogout={logout} />
        <div className="main-content">
          <Topbar title="Track Ambulance" />
          <div className="page-container" style={{ paddingTop: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Request not found.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Sidebar role="patient" userName={user?.name || ''} onLogout={logout} />
      <div className="main-content">
        <Topbar
          title="Live Tracking"
          subtitle={isConnected ? '🟢 Connected' : '🔴 Reconnecting...'}
        />

        <div className="page-container" style={{ paddingTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>

            <div>
              <LiveMap
                center={mapCenter}
                markers={mapMarkers}
                route={route ? { coordinates: route.coordinates } : undefined}
                gaScan={gaScan}
                height="460px"
                zoom={14}
              />

              {assignment ? (
                <div className="card" style={{ marginTop: '1rem', padding: '1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Estimated Arrival</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <Clock size={18} />{assignment.eta} min
                    </div>
                  </div>

                  {showRouteToPatient && route && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Route Distance
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}>
                        <Navigation size={15} />
                        {route.distanceKm.toFixed(1)} km
                        {route.fallback && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)' }}>(direct)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {assignment.ambulances?.vehicle_number && (
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ambulance</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600 }}>
                        <Truck size={16} />{assignment.ambulances.vehicle_number}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Priority</div>
                    <PriorityBadge priority={request.priority} />
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Driver Status</div>
                    <StatusBadge status={assignment.status as any} />
                  </div>
                </div>
              ) : (
                <div className="card card-padding" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  AI + Genetic Algorithm is selecting the nearest ambulance...
                </div>
              )}

              {ambulancePos && assignment && request.status !== 'pending' && (
                <div className="card card-padding animate-slide-up" style={{ marginTop: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <CheckCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                      {request.status === 'picked_up' ? 'You are on board' : 'Ambulance dispatched'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {assignment.ambulances?.vehicle_number
                        ? `${assignment.ambulances.vehicle_number} · ${request.status === 'picked_up' ? 'heading to hospital' : 'en route to you'}`
                        : 'An ambulance is on its way.'}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <MapPin size={11} />
                      Live GPS: {ambulancePos.lat.toFixed(4)}, {ambulancePos.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <StatusStepper currentStatus={request.status} />
              {gaMetrics && (
                <div style={{ marginTop: '1.25rem' }}>
                  <GAMetricsPanel metrics={gaMetrics} compact />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
