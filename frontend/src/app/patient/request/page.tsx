'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin, AlertTriangle, Loader2, Navigation, ShieldAlert,
  HeartPulse, Car, Brain, Wind, Bone, Flame, Droplets, CircleHelp, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { emergencyApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

const LiveMap = dynamic(() => import('@/components/maps/LiveMap'), { ssr: false });

const EMERGENCY_TYPES = [
  { value: 'cardiac_arrest', label: 'Cardiac Arrest',       icon: HeartPulse },
  { value: 'accident',       label: 'Road Accident',        icon: Car },
  { value: 'stroke',         label: 'Stroke',               icon: Brain },
  { value: 'respiratory',    label: 'Respiratory Distress', icon: Wind },
  { value: 'trauma',         label: 'Physical Trauma',      icon: Bone },
  { value: 'fire',           label: 'Fire / Burns',         icon: Flame },
  { value: 'drowning',       label: 'Drowning',             icon: Droplets },
  { value: 'other',          label: 'Other Emergency',      icon: CircleHelp },
];

export default function RequestPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout } = useAuth();
  const [form, setForm] = useState({
    emergency_type: 'cardiac_arrest',
    description: '',
    latitude: 12.9716,
    longitude: 77.5946,
  });
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationSet, setLocationSet] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setLocationSet(true);
        setIsLocating(false);
        toast.success('Location detected');
      },
      (err) => {
        toast.error('Could not detect location. Please allow access.');
        setIsLocating(false);
      },
      { timeout: 10000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error('Please describe the emergency');
      return;
    }
    if (!locationSet) {
      toast.error('Please detect your location first');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await emergencyApi.create(form);
      if (res.data.success) {
        toast.success('Emergency request sent! Allocating ambulance...');
        router.push('/patient/dashboard');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedType = EMERGENCY_TYPES.find((t) => t.value === form.emergency_type);

  return (
    <div>
      <Sidebar role="patient" userName={user?.name || 'Patient'} onLogout={logout} />
      <div className="main-content">
        <Topbar
          title="Request Ambulance"
          subtitle="Emergency intake"
          userName={user?.name || 'Patient'}
          role="patient"
        />

        <div className="page-container" style={{ paddingTop: '0.5rem', maxWidth: 1180 }}>

          {/* Warning banner */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="intake-banner"
          >
            <div className="intake-banner-icon">
              <ShieldAlert size={16} color="var(--text-primary)" strokeWidth={2} />
            </div>
            <span>
              <strong>For life-threatening emergencies only.</strong> Misuse may delay help to others.
            </span>
          </motion.div>

          <form onSubmit={handleSubmit} className="intake-grid">

            {/* ── LEFT: details ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="panel"
              style={{ padding: '1.5rem' }}
            >
              <div className="eyebrow" style={{ marginBottom: '0.35rem' }}>Step 01</div>
              <div className="panel-title" style={{ marginBottom: '0.25rem' }}>Emergency Type</div>
              <div className="panel-sub" style={{ marginBottom: '1.1rem' }}>Select the closest match for fastest triage</div>

              {/* Emergency type selector cards */}
              <div className="type-grid">
                {EMERGENCY_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = form.emergency_type === t.value;
                  return (
                    <button
                      type="button"
                      key={t.value}
                      onClick={() => setForm((p) => ({ ...p, emergency_type: t.value }))}
                      className={`type-card ${active ? 'active' : ''}`}
                      aria-label={`Emergency type: ${t.label}${active ? ' (selected)' : ''}`}
                    >
                      <Icon size={18} strokeWidth={active ? 2 : 1.75} />
                      <span>{t.label}</span>
                      {active && <Check size={13} className="type-card-check" strokeWidth={2.5} />}
                    </button>
                  );
                })}
              </div>

              {/* Hidden native select preserves original form semantics */}
              <select
                id="emergency-type"
                value={form.emergency_type}
                onChange={(e) => setForm((p) => ({ ...p, emergency_type: e.target.value }))}
                aria-hidden
                aria-label="Emergency type"
                title="Emergency type"
                tabIndex={-1}
                style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
              >
                {EMERGENCY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>

              <div className="divider" style={{ margin: '1.5rem 0' }} />

              <div className="eyebrow" style={{ marginBottom: '0.35rem' }}>Step 02</div>
              <label className="panel-title" htmlFor="description" style={{ display: 'block', marginBottom: '0.25rem' }}>
                Describe the Situation
              </label>
              <div className="panel-sub" style={{ marginBottom: '0.9rem' }}>Concise details help responders prepare</div>

              <textarea
                id="description"
                className="input intake-textarea"
                placeholder="Briefly describe what happened, the patient's condition, and any hazards…"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={4}
                minLength={5}
                maxLength={500}
              />
              <div className="intake-counter">{form.description.length}/500</div>
            </motion.div>

            {/* ── RIGHT: location + submit ──────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
              style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
            >
              {/* Location panel */}
              <div className="panel" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <div className="eyebrow" style={{ marginBottom: '0.35rem' }}>Step 03</div>
                    <div className="panel-title">Your Location</div>
                    <div className="panel-sub">Required for dispatch</div>
                  </div>
                  <button
                    type="button"
                    id="detect-location"
                    className={`btn btn-sm ${locationSet ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={detectLocation}
                    disabled={isLocating}
                    style={{ flexShrink: 0 }}
                  >
                    {isLocating ? (
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : locationSet ? (
                      <Check size={14} strokeWidth={2.5} />
                    ) : (
                      <Navigation size={14} />
                    )}
                    {isLocating ? 'Detecting…' : locationSet ? 'Detected' : 'Detect'}
                  </button>
                </div>

                <div className="map-frame">
                  <LiveMap
                    center={[form.latitude, form.longitude]}
                    zoom={14}
                    markers={[
                      { lat: form.latitude, lng: form.longitude, type: 'patient', label: 'Your location' },
                    ]}
                    height="240px"
                  />
                </div>

                <div className="intake-coords">
                  <MapPin size={12} color="var(--text-faint)" />
                  <span>{form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}</span>
                  <span className={`intake-loc-pill ${locationSet ? 'ok' : ''}`}>
                    {locationSet ? 'Locked' : 'Not set'}
                  </span>
                </div>
              </div>

              {/* Summary + submit */}
              <div className="card-hero" style={{ padding: '1.5rem' }}>
                <div style={{
                  position: 'absolute', top: -30, right: 30, width: 150, height: 150,
                  background: 'radial-gradient(circle, rgba(170,170,220,0.06) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }} />
                <div className="eyebrow" style={{ marginBottom: '0.75rem' }}>Review &amp; Dispatch</div>
                <div className="intake-summary-row">
                  <span>Type</span>
                  <span className="intake-summary-val">
                    {selectedType && <selectedType.icon size={13} />}
                    {selectedType?.label}
                  </span>
                </div>
                <div className="intake-summary-row">
                  <span>Location</span>
                  <span className="intake-summary-val">{locationSet ? 'Confirmed' : 'Pending'}</span>
                </div>

                <button
                  type="submit"
                  id="submit-emergency"
                  className="btn-command primary"
                  disabled={isSubmitting || !locationSet}
                  style={{ marginTop: '1.25rem' }}
                >
                  {isSubmitting ? (
                    <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <AlertTriangle size={16} strokeWidth={2} />
                  )}
                  {isSubmitting ? 'Sending Request…' : 'Send Emergency Request'}
                </button>
                {!locationSet && (
                  <div className="intake-hint">Detect your location to enable dispatch</div>
                )}
              </div>
            </motion.div>
          </form>
        </div>
      </div>
    </div>
  );
}
