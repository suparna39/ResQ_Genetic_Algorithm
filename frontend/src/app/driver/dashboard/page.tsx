'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Truck, MapPin, CheckCircle, Clock,
  RefreshCw, Navigation, Package, Radio, Activity, Gauge,
} from 'lucide-react';
import { toast } from 'sonner';
import { assignmentApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useRoute } from '@/hooks/useRoute';
import { computeDijkstraViz } from '@/lib/dijkstraViz';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { PriorityBadge, StatusBadge } from '@/components/dashboard/PriorityBadge';
import GAMetricsPanel from '@/components/dashboard/GAMetricsPanel';
import { Assignment, GAMetrics } from '@/types';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

/* ── Empty standby ─────────────────────────────────────────── */
function StandbyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="panel"
      style={{ padding: '3rem 2rem', textAlign: 'center', maxWidth: 560, margin: '1.5rem auto 0' }}
    >
      <div style={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 260, height: 260,
        background: 'radial-gradient(circle, rgba(120,120,180,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
        style={{
          width: 76, height: 76,
          background: 'linear-gradient(135deg, #1e1e2a 0%, #141420 100%)',
          border: '1px solid var(--border-strong)',
          borderRadius: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
          boxShadow: 'var(--shadow-float), var(--shadow-glow-sm)',
        }}
      >
        <Truck size={30} color="var(--text-muted)" strokeWidth={1.5} />
      </motion.div>

      <div style={{ fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
        Standby Mode
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: 1.6, maxWidth: 380, margin: '0 auto 2rem' }}>
        You will be notified automatically when a new emergency is dispatched to your unit.
      </div>

      <button
        className="glow-action"
        onClick={onRefresh}
        style={{ margin: '0 auto' }}
        id="refresh-assignments"
      >
        <RefreshCw size={15} strokeWidth={1.75} />
        Check for Assignments
      </button>

      {/* Status metrics */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '2.5rem',
        marginTop: '2.5rem', paddingTop: '1.5rem',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        {[
          { Icon: Gauge,    label: 'Unit Status', val: 'Available' },
          { Icon: Radio,    label: 'Connection',  val: 'Live'      },
          { Icon: Activity, label: 'AI Engine',   val: 'Active'    },
        ].map(({ Icon, label, val }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              <Icon size={14} color="var(--text-faint)" />{val}
            </div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.25rem', fontFamily: 'var(--font-geist-mono)' }}>{label}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Trip flow stepper ─────────────────────────────────────── */
const TRIP_STEPS = [
  { s: 'assigned',  label: 'Assigned',   sub: 'Accept to begin' },
  { s: 'accepted',  label: 'Accepted',   sub: 'Drive to patient' },
  { s: 'en_route',  label: 'En Route',   sub: 'Approaching patient' },
  { s: 'picked_up', label: 'Picked Up',  sub: 'Drive to hospital' },
  { s: 'completed', label: 'Completed',  sub: 'Mission success' },
];
const TRIP_ORDER: Record<string, number> = {
  assigned: 0, accepted: 1, en_route: 2, picked_up: 3, completed: 4,
};

function TripStepper({ status }: { status: string }) {
  const cur = TRIP_ORDER[status] ?? 0;
  return (
    <div className="panel" style={{ padding: '1.25rem' }}>
      <div className="eyebrow" style={{ marginBottom: '1rem' }}>Mission Progress</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {TRIP_STEPS.map((step, idx) => {
          const isDone   = cur >= idx;
          const isActive = cur === idx;
          return (
            <div key={step.s} style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive
                    ? 'linear-gradient(135deg, #c8c8d0, #a8a8b8)'
                    : isDone ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? 'var(--text-secondary)' : isDone ? 'var(--border-strong)' : 'var(--border)'}`,
                  boxShadow: isActive ? '0 0 0 3px var(--bg-base), 0 0 0 4px rgba(180,180,200,0.2)' : 'none',
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: isActive ? '#09090c' : isDone ? 'var(--text-faint)' : 'var(--border)',
                  }} />
                </div>
                {idx < TRIP_STEPS.length - 1 && (
                  <div style={{
                    width: 1, flex: 1, minHeight: 18, margin: '2px 0',
                    background: isDone ? 'var(--border-strong)' : 'var(--border-subtle)',
                  }} />
                )}
              </div>
              <div style={{ paddingBottom: idx < TRIP_STEPS.length - 1 ? '0.9rem' : 0, paddingTop: '0.1rem' }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? 'var(--text-primary)' : isDone ? 'var(--text-muted)' : 'var(--text-ghost)',
                }}>
                  {step.label}
                </div>
                {isActive && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)' }}>
                    {step.sub}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────── */
export default function DriverDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on, emit, isConnected } = useSocket();

  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading]       = useState(true);
  const [isAccepting, setIsAccepting]   = useState(false);
  const [isPickingUp, setIsPickingUp]   = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const locationWatchRef  = useRef<number | null>(null);
  const manualOverrideRef = useRef(false);

  // Dijkstra state — all unchanged
  const [searchViz, setSearchViz] = useState<{
    segments: [number, number][][];
    source: [number, number];
    target: [number, number];
    runId: number;
  } | null>(null);
  const [dijkstraPath, setDijkstraPath] = useState<[number, number][] | null>(null);
  const [isSearching, setIsSearching]   = useState(false);
  const searchRunIdRef  = useRef(0);
  const searchAbortRef  = useRef<AbortController | null>(null);

  // GA decision metrics + map candidate-scan animation (additive)
  const [gaMetrics, setGaMetrics] = useState<GAMetrics | null>(null);
  const [gaScan, setGaScan] = useState<{
    patient: [number, number];
    candidates: { lng: number; lat: number; isWinner: boolean; fitness: number | null }[];
    runId: number;
  } | null>(null);
  const gaScanRunIdRef = useRef(0);

  // Build the GA scan payload from metrics so the map can animate the evaluation.
  const triggerGaScan = useCallback((metrics: GAMetrics | null | undefined, req: any) => {
    if (!metrics || !req?.latitude || !req?.longitude || !metrics.candidates?.length) return;
    gaScanRunIdRef.current += 1;
    setGaScan({
      patient: [req.longitude, req.latitude],
      candidates: metrics.candidates.map((c) => ({
        lng: c.longitude,
        lat: c.latitude,
        isWinner: c.is_winner,
        fitness: c.fitness,
      })),
      runId: gaScanRunIdRef.current,
    });
  }, []);

  // Auth guard — unchanged
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && user.role !== 'driver') router.push(`/${user.role}/dashboard`);
  }, [user, authLoading]);

  useEffect(() => {
    if (!user) return;
    joinRoom('join:driver', user.id);
  }, [user, joinRoom]);

  useEffect(() => {
    if (activeAssignment?.id) joinRoom('join:assignment', activeAssignment.id);
  }, [activeAssignment?.id, joinRoom]);

  const loadAssignment = useCallback(async () => {
    if (!user) return;
    try {
      const res = await assignmentApi.getMine();
      if (res.data.success) {
        const assignments = res.data.data as Assignment[];
        const active = assignments.find((a) => !['completed', 'cancelled'].includes(a.status)) || null;
        setActiveAssignment(active);
        if (active?.ga_metrics) {
          setGaMetrics(active.ga_metrics);
          triggerGaScan(active.ga_metrics, (active as any).emergency_requests);
        }
      }
    } catch {
      // no assignments
    } finally {
      setIsLoading(false);
    }
  }, [user, triggerGaScan]);

  useEffect(() => { if (user) loadAssignment(); }, [user, loadAssignment]);

  useEffect(() => {
    const unsub = on<{ assignment: Assignment; request: any; eta: number; ga_metrics?: GAMetrics }>('assignment:new', ({ assignment, request, ga_metrics }) => {
      setActiveAssignment(assignment);
      const metrics = ga_metrics ?? assignment.ga_metrics;
      if (metrics) {
        setGaMetrics(metrics);
        triggerGaScan(metrics, (assignment as any).emergency_requests ?? request);
      }
      toast.success('🚨 New emergency assignment!', { duration: 8000 });
    });
    return unsub;
  }, [on, triggerGaScan]);

  useEffect(() => {
    const unsub = on<{ status: string; assignment_id: string }>('request:status_change', (data) => {
      setActiveAssignment((prev) => {
        if (!prev || prev.id !== data.assignment_id) return prev;
        return { ...prev, status: data.status as any };
      });
    });
    return unsub;
  }, [on]);

  // GPS watch — unchanged
  useEffect(() => {
    if (!activeAssignment || ['completed', 'cancelled'].includes(activeAssignment.status)) {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
      return;
    }
    if (navigator.geolocation && locationWatchRef.current === null) {
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (manualOverrideRef.current) return;
          const { latitude, longitude } = pos.coords;
          setDriverPos({ lat: latitude, lng: longitude });
          emit('driver:location_update', { assignment_id: activeAssignment.id, latitude, longitude });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
    return () => {
      if (locationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
        locationWatchRef.current = null;
      }
    };
  }, [activeAssignment?.id]);

  // Dijkstra search — unchanged
  const startRouteSearch = useCallback(async (assignment: Assignment) => {
    const req = assignment.emergency_requests as any;
    const patient = req?.latitude && req?.longitude ? { lat: req.latitude as number, lng: req.longitude as number } : null;
    if (!patient) return;
    let origin = driverPos;
    if (!origin && typeof navigator !== 'undefined' && navigator.geolocation) {
      origin = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
        );
      });
    }
    if (!origin) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const safety = setTimeout(() => controller.abort(), 12000);
    setIsSearching(true);
    try {
      const viz = await computeDijkstraViz([origin.lng, origin.lat], [patient.lng, patient.lat], controller.signal);
      clearTimeout(safety);
      const isCurrent = searchAbortRef.current === controller;
      if (controller.signal.aborted) { if (isCurrent) setIsSearching(false); return; }
      if (!isCurrent) return;
      if (!viz.exploreSegments.length) { setIsSearching(false); return; }
      searchRunIdRef.current += 1;
      setDijkstraPath(viz.path && viz.path.length > 1 ? viz.path : null);
      setSearchViz({ segments: viz.exploreSegments, source: viz.source, target: viz.target, runId: searchRunIdRef.current });
    } catch {
      clearTimeout(safety);
      if (searchAbortRef.current === controller) setIsSearching(false);
    }
  }, [driverPos]);

  // Action handlers — all unchanged
  const handleAccept = async () => {
    if (!activeAssignment) return;
    setIsAccepting(true);
    try {
      const res = await assignmentApi.accept(activeAssignment.id);
      if (res.data.success) {
        const accepted = res.data.data as Assignment;
        const merged: Assignment = {
          ...activeAssignment, ...accepted,
          emergency_requests: (accepted as any).emergency_requests ?? activeAssignment.emergency_requests,
          ambulances: (accepted as any).ambulances ?? activeAssignment.ambulances,
        };
        setActiveAssignment(merged);
        toast.success('Assignment accepted! Computing shortest route...');
        startRouteSearch(merged);
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setIsAccepting(false); }
  };

  const handlePickup = async () => {
    if (!activeAssignment) return;
    setIsPickingUp(true);
    try {
      const res = await assignmentApi.pickup(activeAssignment.id);
      if (res.data.success) {
        setActiveAssignment((prev) => prev ? { ...prev, status: 'picked_up' } : null);
        toast.success('Patient picked up! Head to hospital.');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setIsPickingUp(false); }
  };

  const handleComplete = async () => {
    if (!activeAssignment) return;
    setIsCompleting(true);
    try {
      const res = await assignmentApi.complete(activeAssignment.id);
      if (res.data.success) {
        setActiveAssignment(null);
        setDriverPos(null);
        setSearchViz(null);
        setDijkstraPath(null);
        setIsSearching(false);
        setGaMetrics(null);
        setGaScan(null);
        toast.success('Trip completed! Great work.');
      }
    } catch (err: any) { toast.error(err.message); }
    finally { setIsCompleting(false); }
  };

  const handleManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Invalid coordinates. Lat: -90 to 90, Lng: -180 to 180.');
      return;
    }
    manualOverrideRef.current = true;
    if (locationWatchRef.current !== null) {
      navigator.geolocation.clearWatch(locationWatchRef.current);
      locationWatchRef.current = null;
    }
    setDriverPos({ lat, lng });
    if (activeAssignment) emit('driver:location_update', { assignment_id: activeAssignment.id, latitude: lat, longitude: lng });
    toast.success('Location updated!');
    setShowManualInput(false);
  };

  // Derived values — all unchanged
  const emergencyReq = activeAssignment?.emergency_requests as any;

  const mapMarkers = useMemo(() => {
    const result: { lat: number; lng: number; type: 'patient' | 'ambulance'; label: string }[] = [];
    if (emergencyReq?.latitude && emergencyReq?.longitude)
      result.push({ lat: emergencyReq.latitude, lng: emergencyReq.longitude, type: 'patient', label: 'Patient location' });
    if (driverPos)
      result.push({ lat: driverPos.lat, lng: driverPos.lng, type: 'ambulance', label: 'Your location' });
    return result;
  }, [emergencyReq?.latitude, emergencyReq?.longitude, driverPos]);

  const mapCenter: [number, number] = driverPos
    ? [driverPos.lat, driverPos.lng]
    : emergencyReq?.latitude ? [emergencyReq.latitude, emergencyReq.longitude] : [12.97, 77.59];

  const patientPos = useMemo(() =>
    emergencyReq?.latitude && emergencyReq?.longitude
      ? { lat: emergencyReq.latitude, lng: emergencyReq.longitude } : null,
    [emergencyReq?.latitude, emergencyReq?.longitude]
  );

  const showRouteToPatient =
    !!activeAssignment && ['assigned', 'accepted', 'en_route'].includes(activeAssignment.status);

  const { route } = useRoute(showRouteToPatient ? driverPos : null, showRouteToPatient ? patientPos : null);

  const routeCoords = dijkstraPath && dijkstraPath.length > 1 ? dijkstraPath : route?.coordinates;
  const routeForMap =
    routeCoords && !isSearching && !!activeAssignment && ['accepted', 'en_route'].includes(activeAssignment.status)
      ? { coordinates: routeCoords } : undefined;

  const handleSearchComplete = useCallback(() => { setIsSearching(false); }, []);

  if (authLoading || isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div>
      <Sidebar role="driver" userName={user?.name || 'Driver'} onLogout={logout} />
      <div className="main-content">
        <Topbar
          title="Dispatch Cockpit"
          subtitle={isConnected ? 'Connected · Live' : 'Reconnecting…'}
          userName={user?.name || 'Driver'}
          role="driver"
          live={isConnected}
        />

        <div className="page-container" style={{ paddingTop: '0.5rem' }}>

          <AnimatePresence mode="wait">
            {activeAssignment && emergencyReq ? (

              /* ── Active mission layout ─────────────────── */
              <motion.div
                key="active"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.25rem', alignItems: 'start' }}
                className="driver-grid"
              >

                {/* ── LEFT: Map + location ─────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Navigation frame panel */}
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="panel"
                    style={{ padding: '1.25rem' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <div className="panel-title">Live Navigation</div>
                        <div className="panel-sub">Optimal route · Dijkstra pathfinding</div>
                      </div>
                      <StatusBadge status={activeAssignment.status as any} />
                    </div>

                    {/* Map frame */}
                    <div className="map-frame" style={{ position: 'relative' }}>
                      <LiveMap
                        center={mapCenter}
                        markers={mapMarkers}
                        route={routeForMap}
                        search={searchViz}
                        onSearchComplete={handleSearchComplete}
                        gaScan={gaScan}
                        height="430px"
                        zoom={14}
                      />

                      {/* Dijkstra searching overlay */}
                      {isSearching && (
                        <div style={{
                          position: 'absolute', top: 12, left: 12, zIndex: 20,
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.45rem 0.875rem',
                          borderRadius: 999,
                          background: 'rgba(9,9,12,0.88)',
                          border: '1px solid var(--border-strong)',
                          backdropFilter: 'blur(8px)',
                          pointerEvents: 'none',
                        }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: 'var(--text-secondary)',
                            boxShadow: '0 0 8px rgba(180,180,220,0.6)',
                            animation: 'pulse 1.1s ease-in-out infinite',
                          }} />
                          <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-geist-mono)', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                            Dijkstra · computing optimal route…
                          </span>
                        </div>
                      )}

                      {/* GA engine badge — shows which engine chose this unit */}
                      {gaMetrics && !isSearching && (
                        <div style={{
                          position: 'absolute', top: 12, left: 12, zIndex: 20,
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.45rem 0.875rem',
                          borderRadius: 999,
                          background: 'rgba(9,9,12,0.85)',
                          border: '1px solid var(--border-accent)',
                          backdropFilter: 'blur(8px)',
                          pointerEvents: 'none',
                        }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: '#dcdcf4',
                            boxShadow: '0 0 8px rgba(200,200,245,0.7)',
                          }} />
                          <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-geist-mono)', color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                            {gaMetrics.engine === 'genetic_algorithm'
                              ? `GA · ${gaMetrics.candidates_evaluated} units evaluated`
                              : 'Heuristic dispatch'}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* GPS / manual location card */}
                  <div className="panel" style={{ padding: '1.1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: showManualInput ? '0.875rem' : 0, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                          background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Navigation size={14} strokeWidth={1.75} color="var(--text-secondary)" />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.625rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-geist-mono)' }}>GPS Position</div>
                          <span style={{ fontFamily: 'var(--font-geist-mono)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                            {driverPos
                              ? `${driverPos.lat.toFixed(4)}, ${driverPos.lng.toFixed(4)}`
                              : 'Unavailable — set manually'}
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowManualInput((v) => !v)}
                        id="toggle-manual-location"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        <MapPin size={11} />
                        {showManualInput ? 'Cancel' : 'Set Location'}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showManualInput && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap', overflow: 'hidden' }}
                        >
                          {[
                            { id: 'manual-lat', label: 'LATITUDE',  val: manualLat, set: setManualLat, ph: 'e.g. 12.9716'  },
                            { id: 'manual-lng', label: 'LONGITUDE', val: manualLng, set: setManualLng, ph: 'e.g. 77.5946' },
                          ].map(({ id, label, val, set, ph }) => (
                            <div key={id} style={{ flex: 1, minWidth: 120 }}>
                              <label className="input-label">{label}</label>
                              <input
                                type="number" step="0.0001" placeholder={ph}
                                value={val}
                                onChange={(e) => set(e.target.value)}
                                id={id}
                                style={{
                                  width: '100%', background: 'var(--bg-base)',
                                  border: '1px solid var(--border)', borderRadius: 8,
                                  padding: '0.5rem 0.75rem', color: 'var(--text-primary)',
                                  fontSize: '0.875rem', fontFamily: 'var(--font-geist-mono)',
                                  outline: 'none',
                                }}
                              />
                            </div>
                          ))}
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={handleManualLocation}
                            id="submit-manual-location"
                          >
                            Update
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── RIGHT: Task panel ─────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Assignment hero */}
                  <motion.div
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.05 }}
                    className="card-hero"
                    style={{ padding: '1.5rem' }}
                  >
                    <div style={{
                      position: 'absolute', top: -30, right: 30, width: 150, height: 150,
                      background: 'radial-gradient(circle, rgba(170,170,220,0.06) 0%, transparent 70%)',
                      pointerEvents: 'none',
                    }} />

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.875rem' }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 10,
                        background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Truck size={16} color="var(--text-secondary)" strokeWidth={2} />
                      </div>
                      <div className="eyebrow">Active Mission</div>
                    </div>

                    {/* Badges */}
                    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
                      <StatusBadge status={activeAssignment.status as any} />
                      <PriorityBadge priority={emergencyReq.priority} />
                    </div>

                    {/* Title */}
                    <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, marginBottom: '0.375rem', letterSpacing: '-0.02em' }}>
                      {emergencyReq.emergency_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </h2>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                      {emergencyReq.description}
                    </p>

                    <div className="divider" style={{ marginBottom: '1.25rem' }} />

                    {/* Metadata rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.375rem' }}>
                      {[
                        { Icon: MapPin,     label: 'Patient Coords', val: `${emergencyReq.latitude?.toFixed(4)}, ${emergencyReq.longitude?.toFixed(4)}`, mono: true },
                        { Icon: Clock,      label: 'ETA',            val: `${activeAssignment.eta} min`,                                                mono: false },
                        ...(showRouteToPatient && route ? [{ Icon: Navigation, label: 'Route Distance', val: `${route.distanceKm.toFixed(1)} km${route.fallback ? ' (direct)' : ''}`, mono: false }] : []),
                        ...(driverPos ? [{ Icon: Navigation, label: 'Your Position', val: `${driverPos.lat.toFixed(4)}, ${driverPos.lng.toFixed(4)}`, mono: true }] : []),
                      ].map(({ Icon, label, val, mono }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Icon size={12} color="var(--text-faint)" strokeWidth={1.75} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.625rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-geist-mono)' }}>{label}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: mono ? 'var(--font-geist-mono)' : 'inherit' }}>{val}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ── Action buttons (sequential, unchanged logic) ── */}

                    {/* Step 1: Accept */}
                    {activeAssignment.status === 'assigned' && (
                      <button
                        className={`btn-command primary`}
                        onClick={handleAccept}
                        disabled={isAccepting}
                        id="accept-assignment"
                      >
                        {isAccepting
                          ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          : <CheckCircle size={14} strokeWidth={2} />}
                        {isAccepting ? 'Accepting…' : 'Accept Assignment'}
                      </button>
                    )}

                    {/* Step 2: En route → pickup */}
                    {['accepted', 'en_route'].includes(activeAssignment.status) && (
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.625rem 0.75rem',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          marginBottom: '0.625rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}>
                          <Navigation size={12} style={{ flexShrink: 0 }} strokeWidth={1.75} />
                          {activeAssignment.status === 'accepted'
                            ? 'Accepted — en route status updating…'
                            : 'En route · Pick up patient when you arrive'}
                        </div>
                        <button
                          className="btn-command primary"
                          onClick={handlePickup}
                          disabled={isPickingUp}
                          id="pickup-patient"
                        >
                          {isPickingUp
                            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Package size={14} strokeWidth={2} />}
                          {isPickingUp ? 'Marking…' : 'Patient Picked Up'}
                        </button>
                      </>
                    )}

                    {/* Step 3: Complete */}
                    {activeAssignment.status === 'picked_up' && (
                      <>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.625rem 0.75rem',
                          borderRadius: 8,
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          marginBottom: '0.625rem',
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                        }}>
                          <CheckCircle size={12} style={{ flexShrink: 0 }} strokeWidth={1.75} />
                          Patient aboard — drive to hospital
                        </div>
                        <button
                          className="btn-command"
                          onClick={handleComplete}
                          disabled={isCompleting}
                          id="complete-trip"
                        >
                          {isCompleting
                            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                            : <CheckCircle size={14} strokeWidth={2} />}
                          {isCompleting ? 'Completing…' : 'Mark Trip Completed'}
                        </button>
                      </>
                    )}
                  </motion.div>

                  {/* Trip flow stepper */}
                  <TripStepper status={activeAssignment.status} />

                  {/* GA decision intelligence */}
                  {gaMetrics && <GAMetricsPanel metrics={gaMetrics} />}
                </div>
              </motion.div>

            ) : (
              /* ── Standby state ─────────────────────────── */
              <motion.div key="standby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <StandbyState onRefresh={loadAssignment} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
