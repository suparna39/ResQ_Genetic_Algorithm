'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AmbientNav, { AmbientVideoBg, AMBIENT_STYLES } from '@/components/layout/AmbientNav';
import {
  Brain, GitBranch, MapPin, Clock, Activity, Shield,
  Bell, Cpu, Zap, ChevronDown, CheckCircle2, Terminal,
  Radio, Route, Users, BarChart3, Lock, Smartphone,
} from 'lucide-react';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: 'easeOut' as const, delay },
});

const FEATURES = [
  {
    id: 'ml-priority',
    icon: Brain,
    color: '#9cecff',
    colorBg: 'rgba(156,236,255,.08)',
    colorBorder: 'rgba(156,236,255,.2)',
    title: 'AI Priority Prediction',
    subtitle: 'Random Forest Classifier',
    brief: 'Classifies emergency urgency in milliseconds using patient vitals and symptoms.',
    detail: `A scikit-learn Random Forest model (200 trees, depth-12) evaluates 8 patient features — age, heart rate, blood pressure, SpO₂, GCS score, symptom severity, symptom category, and hospital proximity — to produce one of four urgency labels.

The model runs inside a FastAPI microservice and responds with a priority level + confidence score in under 50ms. This directly controls ambulance selection weights in the downstream GA.`,
    specs: [
      '200-tree Random Forest ensemble',
      'GridSearchCV-tuned hyperparameters',
      '94% accuracy · F1 = 0.92 (macro)',
      'StandardScaler preprocessing',
      'Output: Low / Medium / High / Critical',
    ],
  },
  {
    id: 'ga-dispatch',
    icon: GitBranch,
    color: '#ffcc80',
    colorBg: 'rgba(255,204,128,.08)',
    colorBorder: 'rgba(255,204,128,.2)',
    title: 'Genetic Algorithm Dispatch',
    subtitle: 'Evolutionary Route Optimization',
    brief: 'Selects the best ambulance by evolving a population of candidate assignments over 100 generations.',
    detail: `Custom Python GA runs on every incoming emergency request. Population of 50 individuals (ambulance candidates) are evolved using tournament selection, single-point crossover, and swap mutation.

Fitness function = 0.35×(1/distance) + 0.25×availability + 0.30×priority_weight + 0.10×(1/ETA). The algorithm terminates at 100 generations or after 10 stagnant generations. Average decision latency: < 200ms.`,
    specs: [
      'Population: 50 · Max generations: 100',
      'Tournament selection (k=3)',
      'Crossover probability: 0.85',
      'Mutation probability: 0.05',
      'Elitism: top-2 preserved per generation',
    ],
  },
  {
    id: 'gps-tracking',
    icon: MapPin,
    color: '#a5f3a5',
    colorBg: 'rgba(165,243,165,.08)',
    colorBorder: 'rgba(165,243,165,.2)',
    title: 'Live GPS Tracking',
    subtitle: 'WebSocket Realtime Stream',
    brief: 'Patients see their assigned ambulance moving in real-time on a Leaflet.js map.',
    detail: `Driver app emits GPS coordinates via Socket.IO every 3 seconds. The backend relays the stream to the patient's browser over a dedicated socket room. Leaflet.js renders the moving ambulance marker and smoothly interpolates position updates.

The same stream powers the admin dashboard, which shows all active units simultaneously on a live fleet map.`,
    specs: [
      'Socket.IO rooms per assignment',
      '3-second GPS emission interval',
      'Leaflet.js smooth marker interpolation',
      'ETA recalculated on each GPS tick',
      'Admin fleet view: all units simultaneously',
    ],
  },
  {
    id: 'dijkstra',
    icon: Route,
    color: '#c4b5fd',
    colorBg: 'rgba(196,181,253,.08)',
    colorBorder: 'rgba(196,181,253,.2)',
    title: 'Dijkstra Route Visualization',
    subtitle: 'Graph-Based Shortest Path',
    brief: "Shows the driver the optimal route on their dashboard using Dijkstra's algorithm over a road graph.",
    detail: `After the GA selects an ambulance, Dijkstra's algorithm runs on the city road graph to find the shortest valid path from the ambulance's current location to the patient. The path is visualized as an animated polyline on the driver dashboard map.

The road graph is loaded as an adjacency list. Node weights account for real road distances (approximated from coordinate pairs). Updates run when the patient's location or the ambulance's position changes significantly.`,
    specs: [
      'Adjacency list road graph',
      'Distance-weighted edge relaxation',
      'Animated polyline on Leaflet map',
      'Re-routes on significant position delta',
      'Runs client-side for sub-20ms response',
    ],
  },
  {
    id: 'realtime-notify',
    icon: Bell,
    color: '#fda4af',
    colorBg: 'rgba(253,164,175,.08)',
    colorBorder: 'rgba(253,164,175,.2)',
    title: 'Real-Time Notifications',
    subtitle: 'Socket.IO Event Bus',
    brief: 'Instant push events delivered to drivers, patients, and admins at every step of the dispatch lifecycle.',
    detail: `Every state transition in the assignment lifecycle — created → accepted → en_route → arrived → completed — emits a Socket.IO event to all relevant connected clients. No polling. No missed updates.

Drivers receive assignment notifications with a vibration prompt. Patients see the stepper update live. Admins see every event in the control dashboard. The backend uses Socket.IO rooms to scope events to the right audience.`,
    specs: [
      'Events: created, accepted, pickup, complete',
      'Scoped Socket.IO rooms per assignment',
      'Driver vibration prompt on new dispatch',
      'Patient status stepper updates live',
      'Admin event log with timestamps',
    ],
  },
  {
    id: 'admin-center',
    icon: Activity,
    color: '#67e8f9',
    colorBg: 'rgba(103,232,249,.08)',
    colorBorder: 'rgba(103,232,249,.2)',
    title: 'Admin Control Center',
    subtitle: 'Full Fleet Visibility',
    brief: 'Manage ambulances, monitor requests, view assignments, and track all active units from one dashboard.',
    detail: `The admin dashboard provides complete operational visibility: all active/completed emergency requests, every ambulance in the fleet with status, all assignments with driver info, and a live map showing real-time unit positions.

Admins can add/remove ambulances, view patient and driver profiles, and see the AI model's priority classification for each request. Role-based access ensures only admins can reach this panel.`,
    specs: [
      'Full request, assignment, ambulance CRUD',
      'Live fleet map (all active units)',
      'AI priority label per request visible',
      'Driver and patient profile views',
      'Role-gated access (admin only)',
    ],
  },
  {
    id: 'role-access',
    icon: Shield,
    color: '#86efac',
    colorBg: 'rgba(134,239,172,.08)',
    colorBorder: 'rgba(134,239,172,.2)',
    title: 'Role-Based Authentication',
    subtitle: 'Better Auth + JWT',
    brief: 'Three separate, secure portals — Patient, Driver, Admin — with role-gated routing and session management.',
    detail: `Authentication is powered by Better Auth with email/password sign-up and sign-in. User roles (patient, driver, admin) are stored in Supabase and embedded in the session token. Each Next.js route is guarded server-side to prevent unauthorized access.

The session token is also forwarded to the Express backend for API authorization, ensuring that drivers can't access admin endpoints and patients can't trigger driver actions.`,
    specs: [
      'Better Auth email/password flow',
      'Role field in Supabase user table',
      'JWT forwarded to Express middleware',
      'Next.js route guards per role',
      '3 portals: Patient · Driver · Admin',
    ],
  },
  {
    id: 'mobile',
    icon: Smartphone,
    color: '#fcd34d',
    colorBg: 'rgba(252,211,77,.08)',
    colorBorder: 'rgba(252,211,77,.2)',
    title: 'Mobile-First Design',
    subtitle: 'Responsive Across All Devices',
    brief: 'Every dashboard is fully responsive — patients request from a phone, drivers accept on the go.',
    detail: `All three portals (patient, driver, admin) are built mobile-first with responsive layouts. The patient request form works seamlessly on any phone. The driver dashboard shows the map and assignment details in a stacked layout on small screens.

The luxury monochrome design system uses CSS variables and clamp() sizing to ensure pixel-perfect layouts from 360px to 4K. Touch-friendly button sizes and gesture-aware map controls are included.`,
    specs: [
      'Responsive at every breakpoint (360px → 4K)',
      'Touch-friendly gesture map controls',
      'clamp() fluid typography system',
      'Mobile-first patient request flow',
      'Driver portal: full feature on phone',
    ],
  },
];

export default function FeaturesPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <style>{AMBIENT_STYLES}</style>
      <style>{`
        .feat-hero { padding: 160px clamp(20px,6vw,80px) 60px; max-width: 900px; margin: 0 auto; }
        .feat-section { padding: 20px clamp(20px,6vw,80px) 80px; max-width: 1200px; margin: 0 auto; }
        .feat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px,1fr)); gap: 14px; margin-top: 36px; }
        .feat-card {
          padding: 0; overflow: hidden;
          cursor: pointer; position: relative;
        }
        .feat-card-head { padding: 24px 24px 20px; display: flex; flex-direction: column; gap: 14px; }
        .feat-icon-wrap { width: 48px; height: 48px; border-radius: 14px;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .feat-title { font: 700 17px 'Instrument Sans', system-ui, sans-serif; color: #eefaff; letter-spacing: -.01em; }
        .feat-subtitle { font: 500 10.5px 'IBM Plex Mono', monospace; letter-spacing: .08em; text-transform: uppercase; margin-top: 2px; }
        .feat-brief { font-size: 13.5px; color: rgba(238,250,255,.6); line-height: 1.65; }
        .feat-expand-btn {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px; border-top: 1px solid rgba(238,250,255,.06);
          font: 500 11px 'IBM Plex Mono', monospace;
          color: rgba(238,250,255,.45); letter-spacing: .06em; text-transform: uppercase;
          cursor: pointer; transition: color .15s ease;
        }
        .feat-expand-btn:hover { color: rgba(238,250,255,.75); }
        .feat-detail { padding: 0 24px 24px; }
        .feat-detail p { font-size: 13.5px; color: rgba(238,250,255,.65); line-height: 1.72; margin: 0 0 16px; }
        .feat-spec-list { display: flex; flex-direction: column; gap: 7px; }
        .feat-spec-row { display: flex; align-items: flex-start; gap: 9px;
          font-size: 13px; color: rgba(238,250,255,.6); }
        .feat-stat-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-top: 48px; }
        .feat-stat { padding: 24px; text-align: center; }
        .feat-stat-val { font: 800 clamp(32px,5vw,52px) 'Archivo',system-ui,sans-serif;
          letter-spacing: -.06em; color: #eefaff; }
        .feat-stat-lab { font: 500 12px 'IBM Plex Mono',monospace;
          color: rgba(238,250,255,.5); letter-spacing: .1em; text-transform: uppercase; margin-top: 6px; }
        @media (max-width: 640px) {
          .feat-grid { grid-template-columns: 1fr; }
          .feat-stat-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <AmbientVideoBg />
      <AmbientNav active="features" />

      <div className="amb-page">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <motion.div className="feat-hero" {...fade()}>
          <div className="section-eyebrow">ResQ / Features</div>
          <h1 className="section-title" style={{ marginBottom: 20 }}>
            What ResQ<br />can do.
          </h1>
          <p className="section-sub" style={{ fontSize: 16 }}>
            Eight deeply integrated capabilities — from AI triage to real-time GPS —
            working together as one seamless emergency response engine.
          </p>
        </motion.div>

        {/* ── Stat strip ────────────────────────────────────────── */}
        <div className="feat-section">
          <motion.div className="feat-stat-row" {...fade(0.05)}>
            {[
              { val: '<200ms', lab: 'GA dispatch time' },
              { val: '94%',    lab: 'ML accuracy' },
              { val: '3 Roles', lab: 'Patient · Driver · Admin' },
            ].map(({ val, lab }) => (
              <div key={lab} className="glass feat-stat">
                <div className="feat-stat-val">{val}</div>
                <div className="feat-stat-lab">{lab}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Feature cards ─────────────────────────────────────── */}
        <div className="feat-section" style={{ paddingTop: 0 }}>
          <motion.div {...fade()}>
            <div className="section-eyebrow">All Capabilities</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)' }}>
              Click to explore.
            </h2>
          </motion.div>

          <div className="feat-grid">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              const isOpen = expanded === feat.id;
              return (
                <motion.div key={feat.id} className="glass-card feat-card" {...fade(i * 0.04)}>
                  <div className="feat-card-head">
                    <div
                      className="feat-icon-wrap"
                      style={{ background: feat.colorBg, border: `1px solid ${feat.colorBorder}` }}
                    >
                      <Icon size={22} color={feat.color} strokeWidth={1.7} />
                    </div>
                    <div>
                      <div className="feat-title">{feat.title}</div>
                      <div className="feat-subtitle" style={{ color: feat.color }}>{feat.subtitle}</div>
                    </div>
                    <div className="feat-brief">{feat.brief}</div>
                  </div>

                  <button
                    className="feat-expand-btn"
                    onClick={() => setExpanded(isOpen ? null : feat.id)}
                    aria-expanded={isOpen}
                    style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}
                  >
                    <span>{isOpen ? 'Collapse' : 'Learn more'}</span>
                    <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        className="feat-detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeOut' as const }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ borderTop: `1px solid ${feat.colorBorder}`, paddingTop: 20 }}>
                          <p style={{ whiteSpace: 'pre-line' }}>{feat.detail}</p>
                          <div className="feat-spec-list">
                            {feat.specs.map((spec) => (
                              <div key={spec} className="feat-spec-row">
                                <CheckCircle2 size={13} color={feat.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                                <span>{spec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
