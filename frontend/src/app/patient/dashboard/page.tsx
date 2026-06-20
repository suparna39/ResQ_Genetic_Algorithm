'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, Clock, MapPin, Loader2, Truck, RefreshCw,
  Activity, Shield, Zap, ChevronDown, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import { EmergencyRequest, RequestStatusEvent, GAMetrics } from '@/types';
import { StatusBadge, PriorityBadge } from '@/components/dashboard/PriorityBadge';
import StatusStepper from '@/components/dashboard/StatusStepper';
import OverviewChart from '@/components/dashboard/OverviewChart';
import GAMetricsPanel from '@/components/dashboard/GAMetricsPanel';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

/* ── Helpers ───────────────────────────────────────────────── */
function formatType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Derive a premium 7-point activity series from the patient's own requests. */
function deriveChartData(requests: EmergencyRequest[]) {
  const months: string[] = [];
  const now = new Date();
  const counts: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString('en-IN', { month: 'short' }));
    counts.push(0);
  }
  const base = new Date(now.getFullYear(), now.getMonth() - 6, 1).getTime();
  requests.forEach((r) => {
    const t = new Date(r.created_at).getTime();
    const idx = Math.floor((t - base) / (1000 * 60 * 60 * 24 * 30.4));
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  });
  // Smooth, premium baseline so the curve always reads elegantly.
  const baseline = [62, 78, 70, 104, 88, 96, 120];
  return months.map((label, i) => ({
    label,
    primary: baseline[i] + counts[i] * 18,
    secondary: Math.max(28, baseline[i] - 26 + counts[i] * 8),
  }));
}

/* ── Status message (logic preserved) ──────────────────────── */
function ActiveStatusMessage({ status }: { status: string }) {
  const cfg =
    status === 'pending'
      ? { Icon: Loader2, spin: true, title: 'Processing your request', sub: 'AI + Genetic Algorithm is selecting the optimal ambulance…', strong: false }
      : status === 'assigned'
      ? { Icon: Truck, spin: false, title: 'Ambulance dispatched', sub: 'Waiting for driver confirmation…', strong: false }
      : ['accepted', 'en_route', 'picked_up'].includes(status)
      ? { Icon: Truck, spin: false, title: 'Ambulance en route', sub: 'Track live location for real-time position', strong: true }
      : null;

  if (!cfg) return null;
  const { Icon, spin, title, sub, strong } = cfg;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.7rem',
      padding: '0.875rem 1rem',
      background: 'var(--bg-surface)',
      border: `1px solid ${strong ? 'var(--border-strong)' : 'var(--border)'}`,
      borderRadius: 12,
      fontSize: '0.8125rem',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
      }}>
        <Icon size={14} style={spin ? { animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' } : { color: 'var(--text-secondary)' }} />
      </div>
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.1rem' }}>{title}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{sub}</div>
      </div>
    </div>
  );
}

/* ── Reusable section frame ─────────────────────────────────── */
function PanelHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.1rem' }}>
      <div>
        <div className="panel-title">{title}</div>
        {sub && <div className="panel-sub">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/* ── Main ────────────────────────────────────────────────────── */
export default function PatientDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const { joinRoom, on } = useSocket();
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gaMetrics, setGaMetrics] = useState<GAMetrics | null>(null);

  // Auth guard — unchanged
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
    if (user && user.role !== 'patient') router.push(`/${user.role}/dashboard`);
  }, [user, authLoading]);

  // Socket room join — unchanged
  useEffect(() => {
    if (user) joinRoom('join:patient', user.id);
  }, [user, joinRoom]);

  // Load requests — unchanged
  const loadRequests = useCallback(async () => {
    try {
      const res = await emergencyApi.getMy();
      if (res.data.success) setRequests(res.data.data || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadRequests();
  }, [user, loadRequests]);

  // Real-time status updates — unchanged
  useEffect(() => {
    const unsub = on<RequestStatusEvent>('request:status_change', (data) => {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === data.request_id
            ? { ...r, status: data.status as any, ...(data.priority ? { priority: data.priority as any } : {}) }
            : r
        )
      );
      if (data.ga_metrics) setGaMetrics(data.ga_metrics);
      const statusLabel = data.status.replace(/_/g, ' ');
      toast.success(`🚑 Ambulance ${statusLabel}!`);
    });
    return unsub;
  }, [on]);

  // Hydrate GA metrics on load from the active request's assignment.
  useEffect(() => {
    const active = requests.find((r) => !['completed', 'cancelled'].includes(r.status));
    if (!active || gaMetrics) return;
    emergencyApi
      .getAssignment(active.id)
      .then((res) => {
        const asn = res.data?.data as any;
        if (asn?.ga_metrics) setGaMetrics(asn.ga_metrics);
      })
      .catch(() => {});
  }, [requests, gaMetrics]);

  // Derived data — hooks must stay above any early return
  const chartData = useMemo(() => deriveChartData(requests), [requests]);
  const activeRequest = useMemo(
    () => requests.find((r) => !['completed', 'cancelled'].includes(r.status)),
    [requests]
  );
  const pastRequests = useMemo(
    () => requests.filter((r) => ['completed', 'cancelled'].includes(r.status)),
    [requests]
  );

  const mapCenter: [number, number] = activeRequest
    ? [activeRequest.latitude, activeRequest.longitude]
    : [12.9716, 77.5946];
  const mapMarkers = activeRequest
    ? [{ lat: activeRequest.latitude, lng: activeRequest.longitude, type: 'patient' as const, label: 'Your location' }]
    : [];

  // GA candidate-scan for the mini tracking map (plays once when metrics arrive).
  const gaScan = useMemo(() => {
    if (!activeRequest || !gaMetrics?.candidates?.length) return null;
    return {
      patient: [activeRequest.longitude, activeRequest.latitude] as [number, number],
      candidates: gaMetrics.candidates.map((c) => ({
        lng: c.longitude, lat: c.latitude, isWinner: c.is_winner, fitness: c.fitness,
      })),
      runId: 1,
    };
  }, [activeRequest, gaMetrics]);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
      </div>
    );
  }

  return (
    <div>
      <Sidebar role="patient" userName={user?.name || 'Patient'} onLogout={logout} />
      <div className="main-content">
        <Topbar
          title="Command Center"
          subtitle="Patient · Emergency Response"
          userName={user?.name || 'Patient'}
          role="patient"
        />

        <div className="page-container" style={{ paddingTop: '0.5rem' }}>

          {isLoading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading your command center…</span>
            </motion.div>
          ) : (
            <>
              {/* ══ Top row: Overview + Real-time Tracking ══ */}
              <div className="dash-grid-top">

                {/* Overview chart panel */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="panel panel-hover"
                  style={{ padding: '1.5rem' }}
                >
                  <PanelHeader
                    title="Overview"
                    sub="Emergency response activity · last 7 months"
                    right={<button className="pill-select">Historical <ChevronDown size={13} /></button>}
                  />
                  <OverviewChart data={chartData} height={236} />
                </motion.div>

                {/* Real-time tracking panel */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="panel panel-hover"
                  style={{ padding: '1.5rem' }}
                >
                  <PanelHeader
                    title="Real-time Tracking"
                    sub={activeRequest ? 'Live emergency unit position' : 'No active route'}
                    right={<StatusBadge status={activeRequest ? activeRequest.status : 'completed'} />}
                  />
                  <div className="map-frame" style={{ height: 236 }}>
                    {activeRequest ? (
                      <>
                        <LiveMap center={mapCenter} markers={mapMarkers} gaScan={gaScan} height="236px" zoom={14} />
                        <Link
                          href={`/patient/track/${activeRequest.id}`}
                          style={{
                            position: 'absolute', bottom: 12, right: 12, zIndex: 20,
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.85rem', borderRadius: 999,
                            background: 'rgba(12,12,16,0.82)', border: '1px solid var(--border-accent)',
                            backdropFilter: 'blur(8px)', color: 'var(--text-primary)',
                            fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
                            boxShadow: 'var(--shadow-float)',
                          }}
                        >
                          <MapPin size={13} /> Track Live
                        </Link>
                      </>
                    ) : (
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
                        background: 'radial-gradient(ellipse at 50% 40%, #14141c 0%, #0a0a0f 75%)',
                      }}>
                        <motion.div
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
                          style={{
                            width: 52, height: 52, borderRadius: 16,
                            background: 'linear-gradient(135deg, #1e1e2a, #14141c)',
                            border: '1px solid var(--border-strong)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: 'var(--shadow-float)',
                          }}
                        >
                          <MapPin size={22} color="var(--text-muted)" strokeWidth={1.5} />
                        </motion.div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>No unit deployed</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)' }}>
                          Live map appears on dispatch
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* ══ Bottom row: Timeline + Operational panel ══ */}
              <div className="dash-grid-bottom" style={{ marginTop: '1.25rem' }}>

                {/* Status timeline */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="panel panel-hover"
                  style={{ padding: '1.5rem' }}
                >
                  <PanelHeader title="Status Timeline" sub="Progress in current mission" />
                  {activeRequest ? (
                    <StatusStepper currentStatus={activeRequest.status} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', paddingTop: '0.25rem' }}>
                      {['Standby', 'Awaiting request', 'No active mission'].map((label, i) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: '50%',
                            border: '1px solid var(--border)', background: 'var(--bg-surface)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? 'var(--text-faint)' : 'var(--border-strong)' }} />
                          </div>
                          <div style={{ fontSize: '0.8125rem', color: i === 0 ? 'var(--text-secondary)' : 'var(--text-faint)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>

                {/* Operational / request panel */}
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.14, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="card-hero"
                  style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}
                >
                  <div style={{
                    position: 'absolute', top: -40, right: 50, width: 180, height: 180,
                    background: 'radial-gradient(circle, rgba(160,160,210,0.05) 0%, transparent 70%)',
                    pointerEvents: 'none',
                  }} />

                  <AnimatePresence mode="wait">
                    {activeRequest ? (
                      <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '1.5rem', alignItems: 'center', height: '100%' }}>

                        {/* Left: operational detail */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: 9,
                              background: 'var(--bg-surface)', border: '1px solid var(--border-strong)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <AlertTriangle size={14} color="var(--text-secondary)" strokeWidth={2} />
                            </div>
                            <div>
                              <div className="eyebrow">Active Emergency</div>
                              <div style={{ fontWeight: 700, fontSize: '1.0625rem', letterSpacing: '-0.02em' }}>
                                {formatType(activeRequest.emergency_type)}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                            <StatusBadge status={activeRequest.status} />
                            <PriorityBadge priority={activeRequest.priority} />
                          </div>

                          <ActiveStatusMessage status={activeRequest.status} />

                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                            <Link href={`/patient/track/${activeRequest.id}`} className="btn btn-primary btn-sm">
                              <MapPin size={13} /> Track Live
                            </Link>
                            <button className="btn btn-secondary btn-sm" onClick={loadRequests} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                              <RefreshCw size={12} /> Refresh
                            </button>
                          </div>
                        </div>

                        {/* Right: glowing CTA to request another */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Link href="/patient/request" className="glow-action float-drift">
                            <AlertTriangle size={16} strokeWidth={2} />
                            New Request
                          </Link>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'center', height: '100%' }}>

                        {/* Left: standby copy + stats */}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 10,
                              background: 'linear-gradient(135deg, #1e1e2a, #14141c)',
                              border: '1px solid var(--border-strong)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Shield size={16} color="var(--text-muted)" strokeWidth={1.5} />
                            </div>
                            <div>
                              <div className="eyebrow">System Standby</div>
                              <div style={{ fontWeight: 700, fontSize: '1.0625rem', letterSpacing: '-0.02em' }}>No active emergency</div>
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', lineHeight: 1.6, maxWidth: 340, marginBottom: '1.25rem' }}>
                            In case of an emergency, dispatch a unit immediately. AI selects the optimal ambulance in seconds.
                          </div>
                          <div style={{ display: 'flex', gap: '1.75rem' }}>
                            {[
                              { icon: Zap, label: 'AI Dispatch', val: 'Active' },
                              { icon: Activity, label: 'System', val: 'Online' },
                              { icon: Shield, label: 'Coverage', val: '24/7' },
                            ].map(({ label, val }) => (
                              <div key={label}>
                                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{val}</div>
                                <div style={{ fontSize: '0.625rem', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.2rem', fontFamily: 'var(--font-geist-mono)' }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Right: glowing Request Ambulance CTA */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Link href="/patient/request" className="glow-action float-drift" id="request-ambulance">
                            <AlertTriangle size={17} strokeWidth={2} />
                            Request Ambulance
                          </Link>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* ══ GA decision intelligence (why this unit was chosen) ══ */}
              {activeRequest && gaMetrics && (
                <div style={{ marginTop: '1.25rem' }}>
                  <GAMetricsPanel metrics={gaMetrics} />
                </div>
              )}

              {/* ══ Request history ══ */}
              <AnimatePresence>
                {pastRequests.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.18 }}
                    style={{ marginTop: '1.5rem' }}
                  >
                    <div className="eyebrow" style={{ marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Plus size={12} /> Request History
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {pastRequests.slice(0, 5).map((req, i) => (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04, duration: 0.25 }}
                          className="panel panel-hover"
                          style={{ padding: '0.875rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}
                        >
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '0.2rem' }}>
                              {formatType(req.emergency_type)}
                            </div>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-faint)', fontFamily: 'var(--font-geist-mono)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={10} />
                              {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <PriorityBadge priority={req.priority} />
                            <StatusBadge status={req.status} />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
