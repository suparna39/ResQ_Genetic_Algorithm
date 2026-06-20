'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import AmbientNav, { AmbientVideoBg, AMBIENT_STYLES } from '@/components/layout/AmbientNav';
import {
  Smartphone, Brain, GitBranch, Truck, Radio,
  MapPin, CheckCircle2, ArrowRight, Zap, Clock,
  Database, Server, Cpu, Network,
} from 'lucide-react';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55, ease: 'easeOut' as const, delay },
});

const STEPS = [
  {
    num: '01', icon: Smartphone, color: '#9cecff',
    title: 'Patient Submits Request',
    actor: 'Patient Portal',
    time: '~0s',
    desc: 'Patient opens the ResQ web app, fills in their current location (auto-detected via browser GPS or manual entry), describes their emergency, and submits the form. The request is stored in Supabase with status PENDING.',
    tech: ['Next.js form submission', 'Supabase insert (emergencies table)', 'Socket.IO event: new_request', 'Browser Geolocation API'],
    output: 'Emergency record created · Admin notified via socket',
  },
  {
    num: '02', icon: Brain, color: '#ffcc80',
    title: 'AI Classifies Priority',
    actor: 'ML Microservice (FastAPI)',
    time: '~50ms',
    desc: 'The Node.js backend calls the Python FastAPI microservice with the patient\'s vitals and symptom data. The Random Forest model processes 8 features through 200 decision trees and returns a priority class — Low, Medium, High, or Critical — with a confidence score.',
    tech: ['FastAPI POST /predict', 'Random Forest (200 trees, depth 12)', 'StandardScaler feature normalization', 'Returns: { priority, confidence }'],
    output: 'Priority label stored · Weight applied in GA fitness function',
  },
  {
    num: '03', icon: GitBranch, color: '#c4b5fd',
    title: 'Genetic Algorithm Selects Ambulance',
    actor: 'GA Engine (Python)',
    time: '~150ms',
    desc: 'With the priority weight in hand, the GA runs over the pool of available ambulances. A population of 50 candidate assignments is evolved for up to 100 generations. Each individual\'s fitness score is computed from distance, availability, vehicle type, and the ML priority weight. The fittest individual is decoded into the optimal ambulance dispatch.',
    tech: ['Population: 50 · Generations: max 100', 'Fitness = 0.35/dist + 0.25×avail + 0.30×priority + 0.10/eta', 'Tournament selection k=3 · Crossover 0.85 · Mutation 0.05', 'Early stop: 10 stagnant generations'],
    output: 'Best ambulance ID + driver ID returned · Assignment created',
  },
  {
    num: '04', icon: Truck, color: '#86efac',
    title: 'Driver Receives Dispatch',
    actor: 'Driver Dashboard',
    time: '~0s',
    desc: 'A Socket.IO event is immediately emitted to the assigned driver\'s browser. Their dashboard shows a full-screen assignment notification with patient location, priority level, and a "Accept" action. Dijkstra\'s algorithm renders the optimal route on the Leaflet map. The assignment status transitions to ACCEPTED once the driver confirms.',
    tech: ['Socket.IO room: driver_<id>', "Dijkstra's shortest path on road graph", 'Leaflet polyline route visualization', 'Status: PENDING → ACCEPTED'],
    output: 'Driver en route · Patient notified instantly',
  },
  {
    num: '05', icon: Radio, color: '#fda4af',
    title: 'Real-Time GPS Stream Begins',
    actor: 'Socket.IO Stream',
    time: 'Continuous',
    desc: 'The driver\'s device begins emitting GPS coordinates every 3 seconds over the WebSocket connection. The backend relays these to the patient\'s browser in real-time. The patient sees the ambulance marker moving across their Leaflet map with a live ETA countdown recalculated on each GPS tick.',
    tech: ['Driver emits: location_update every 3s', 'Backend relays to room: patient_<id>', 'Leaflet marker smooth interpolation', 'ETA recalculated on each coordinate update'],
    output: 'Patient sees ambulance approaching live · ETA updates continuously',
  },
  {
    num: '06', icon: MapPin, color: '#67e8f9',
    title: 'Pickup Confirmed at Scene',
    actor: 'Driver Portal',
    time: '~0s',
    desc: 'Once the driver physically arrives at the patient\'s location, they press "Patient Picked Up" in their dashboard. This changes the assignment status to PICKED_UP and emits a socket event. The patient\'s status stepper advances. Admin dashboard reflects the change in real-time.',
    tech: ['Socket.IO event: patient_picked_up', 'Status: ACCEPTED → PICKED_UP', 'Patient stepper advances to step 3', 'Admin event log updated'],
    output: 'All portals updated simultaneously · Journey to hospital begins',
  },
  {
    num: '07', icon: CheckCircle2, color: '#fcd34d',
    title: 'Trip Completed & Logged',
    actor: 'System (All Portals)',
    time: '~0s',
    desc: 'On arrival at the hospital, the driver marks the trip as complete. The assignment status flips to COMPLETED. The emergency record is archived. The ambulance is returned to AVAILABLE status in the fleet. GPS streaming stops. All portals reflect the final state, and the data is persisted for admin analytics.',
    tech: ['Status: PICKED_UP → COMPLETED', 'Ambulance: BUSY → AVAILABLE', 'Assignment archived in Supabase', 'Socket rooms cleaned up'],
    output: 'Case closed · Fleet restored · Analytics updated · History visible to patient',
  },
];

const ARCH_LAYERS = [
  { icon: Smartphone, label: 'Client Layer',   items: ['Next.js 15 (Patient · Driver · Admin)', 'Leaflet.js real-time maps', 'Socket.IO client', 'Framer Motion UI'], color: '#9cecff' },
  { icon: Server,     label: 'API Layer',      items: ['Node.js + Express', 'Better Auth middleware', 'REST endpoints', 'Socket.IO server (rooms, events)'], color: '#ffcc80' },
  { icon: Cpu,        label: 'AI/ML Layer',    items: ['FastAPI microservice', 'Random Forest classifier', 'Genetic Algorithm engine', "Dijkstra's route solver"], color: '#c4b5fd' },
  { icon: Database,   label: 'Data Layer',     items: ['Supabase (PostgreSQL)', 'Prisma ORM', 'Row-Level Security', 'Realtime subscriptions'], color: '#86efac' },
];

export default function WorkingPage() {
  const [activeStep, setActiveStep] = useState<string | null>(null);

  return (
    <>
      <style>{AMBIENT_STYLES}</style>
      <style>{`
        .work-hero { padding: 160px clamp(20px,6vw,80px) 60px; max-width: 900px; margin: 0 auto; }
        .work-section { padding: 40px clamp(20px,6vw,80px) 60px; max-width: 1200px; margin: 0 auto; }

        /* Timeline */
        .work-timeline { display: flex; flex-direction: column; gap: 0; margin-top: 40px; }
        .work-step {
          display: grid; grid-template-columns: 72px 1fr;
          gap: 28px; position: relative; cursor: pointer;
        }
        .work-step:not(:last-child)::before {
          content: ''; position: absolute; left: 35px; top: 72px; bottom: -8px;
          width: 2px;
          background: linear-gradient(180deg, rgba(238,250,255,.15), rgba(238,250,255,.04));
        }
        .work-step-col {
          display: flex; flex-direction: column; align-items: center; gap: 6px; padding-top: 4px;
        }
        .work-step-icon {
          width: 56px; height: 56px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          transition: box-shadow .25s ease;
        }
        .work-step-time {
          font: 500 9px 'IBM Plex Mono', monospace;
          color: rgba(238,250,255,.35); letter-spacing: .06em; text-align: center;
        }
        .work-body {
          padding: 8px 0 36px;
        }
        .work-actor {
          font: 500 10px 'IBM Plex Mono', monospace;
          letter-spacing: .1em; text-transform: uppercase; margin-bottom: 6px;
        }
        .work-title { font: 700 18px 'Instrument Sans', system-ui, sans-serif;
          color: #eefaff; letter-spacing: -.01em; margin-bottom: 10px; }
        .work-desc { font-size: 14px; color: rgba(238,250,255,.62); line-height: 1.72; margin-bottom: 14px; }
        .work-tech-row { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 12px; }
        .work-tech-chip {
          font: 500 10px 'IBM Plex Mono', monospace; letter-spacing: .05em;
          padding: 4px 10px; border-radius: 999px;
          background: rgba(238,250,255,.05); border: 1px solid rgba(238,250,255,.1);
          color: rgba(238,250,255,.55);
        }
        .work-output {
          display: flex; align-items: center; gap: 8px;
          font-size: 13px; color: rgba(238,250,255,.5); font-style: italic;
        }

        /* Architecture grid */
        .arch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap: 14px; margin-top: 36px; }
        .arch-card { padding: 24px; display: flex; flex-direction: column; gap: 14px; }
        .arch-icon { width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center; }
        .arch-layer-label { font: 700 13px 'Instrument Sans', system-ui, sans-serif; color: #eefaff; }
        .arch-item { font-size: 13px; color: rgba(238,250,255,.58); display: flex; align-items: center; gap: 6px; }

        /* Flow diagram */
        .flow-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          margin-top: 24px; padding: 20px 24px;
          background: rgba(7,21,34,.7); backdrop-filter: blur(20px);
          border: 1px solid rgba(238,250,255,.1); border-radius: 16px; }
        .flow-node { padding: 8px 14px; border-radius: 8px;
          font: 600 12px 'Instrument Sans', system-ui, sans-serif;
          color: rgba(238,250,255,.85); }
        .flow-arrow { color: rgba(238,250,255,.3); flex-shrink: 0; }

        @media (max-width: 640px) {
          .work-step { grid-template-columns: 48px 1fr; gap: 16px; }
          .work-step-icon { width: 40px; height: 40px; }
          .work-step:not(:last-child)::before { left: 23px; }
          .arch-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <AmbientVideoBg />
      <AmbientNav active="working" />

      <div className="amb-page">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <motion.div className="work-hero" {...fade()}>
          <div className="section-eyebrow">ResQ / How It Works</div>
          <h1 className="section-title" style={{ marginBottom: 20 }}>
            From request<br />to rescue.
          </h1>
          <p className="section-sub" style={{ fontSize: 16 }}>
            Seven stages, three AI systems, and a real-time WebSocket bus — all coordinated in under 400 milliseconds.
            Here's the complete journey of a ResQ emergency dispatch.
          </p>
        </motion.div>

        {/* ── Data flow pill ────────────────────────────────────── */}
        <div className="work-section" style={{ paddingBottom: 0 }}>
          <motion.div {...fade()}>
            <div className="section-eyebrow">System Data Flow</div>
          </motion.div>
          <motion.div className="flow-row" {...fade(0.06)}>
            {[
              { label: 'Patient App', color: '#9cecff' },
              null,
              { label: 'Express API', color: '#ffcc80' },
              null,
              { label: 'ML (FastAPI)', color: '#c4b5fd' },
              null,
              { label: 'GA Engine', color: '#86efac' },
              null,
              { label: 'Supabase DB', color: '#67e8f9' },
              null,
              { label: 'Driver App', color: '#fda4af' },
            ].map((node, i) =>
              node === null ? (
                <ArrowRight key={i} size={14} className="flow-arrow" />
              ) : (
                <div key={i} className="flow-node" style={{ background: `${node.color}18`, border: `1px solid ${node.color}30`, color: node.color }}>
                  {node.label}
                </div>
              )
            )}
          </motion.div>
        </div>

        {/* ── Timeline ─────────────────────────────────────────── */}
        <div className="work-section">
          <motion.div {...fade()}>
            <div className="section-eyebrow">End-to-End Journey</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: 8 }}>
              7 stages explained.
            </h2>
            <p className="section-sub">Click any step to expand the full technical detail.</p>
          </motion.div>

          <div className="work-timeline">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isOpen = activeStep === step.num;
              return (
                <motion.div
                  key={step.num}
                  className="work-step"
                  onClick={() => setActiveStep(isOpen ? null : step.num)}
                  {...fade(i * 0.04)}
                >
                  <div className="work-step-col">
                    <div
                      className="work-step-icon"
                      style={{
                        background: `${step.color}14`,
                        border: `1px solid ${step.color}35`,
                        boxShadow: isOpen ? `0 0 24px ${step.color}30` : 'none',
                      }}
                    >
                      <Icon size={22} color={step.color} strokeWidth={1.7} />
                    </div>
                    <div className="work-step-time">{step.time}</div>
                  </div>

                  <div className="work-body">
                    <div className="work-actor" style={{ color: step.color }}>{step.actor}</div>
                    <div className="work-title">{step.num} · {step.title}</div>

                    <div className="work-desc">{step.desc}</div>

                    <motion.div
                      initial={false}
                      animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                      transition={{ duration: 0.3, ease: 'easeOut' as const }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div className="work-tech-row" style={{ marginBottom: 12 }}>
                        {step.tech.map((t) => (
                          <span key={t} className="work-tech-chip">{t}</span>
                        ))}
                      </div>
                    </motion.div>

                    <div className="work-output">
                      <CheckCircle2 size={13} color={step.color} strokeWidth={2} />
                      <span>{step.output}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Architecture layers ───────────────────────────────── */}
        <div className="work-section">
          <motion.div {...fade()}>
            <div className="section-eyebrow">System Architecture</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: 8 }}>
              Four layers.
            </h2>
            <p className="section-sub">Each layer is independently scalable and communicates over well-defined APIs and WebSocket channels.</p>
          </motion.div>

          <div className="arch-grid">
            {ARCH_LAYERS.map((layer, i) => {
              const Icon = layer.icon;
              return (
                <motion.div key={layer.label} className="glass-card arch-card" {...fade(i * 0.06)}>
                  <div className="arch-icon" style={{ background: `${layer.color}14`, border: `1px solid ${layer.color}30` }}>
                    <Icon size={20} color={layer.color} strokeWidth={1.7} />
                  </div>
                  <div>
                    <div className="arch-layer-label" style={{ marginBottom: 12 }}>{layer.label}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {layer.items.map((item) => (
                        <div key={item} className="arch-item">
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: layer.color, flexShrink: 0 }} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Performance strip ─────────────────────────────────── */}
        <div className="work-section">
          <motion.div
            {...fade()}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))',
              gap: 14,
            }}
          >
            {[
              { icon: Zap,   color: '#9cecff', label: 'Total Dispatch Latency', val: '< 400ms', note: 'API + ML + GA combined' },
              { icon: Brain, color: '#ffcc80', label: 'ML Inference Time',      val: '~50ms',   note: 'FastAPI + Random Forest' },
              { icon: GitBranch, color: '#c4b5fd', label: 'GA Convergence',    val: '~150ms',  note: '50 individuals, 100 gen' },
              { icon: Clock, color: '#86efac', label: 'GPS Update Interval',   val: '3s',      note: 'Socket.IO emit frequency' },
            ].map(({ icon: Icon, color, label, val, note }) => (
              <div key={label} className="glass" style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, border: `1px solid ${color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color={color} strokeWidth={1.8} />
                </div>
                <div style={{ font: "700 22px 'Archivo', system-ui, sans-serif", letterSpacing: '-.04em', color: '#eefaff' }}>{val}</div>
                <div>
                  <div style={{ font: "600 12.5px 'Instrument Sans', system-ui", color: 'rgba(238,250,255,.75)', marginBottom: 2 }}>{label}</div>
                  <div style={{ font: "500 10px 'IBM Plex Mono', monospace", color: 'rgba(238,250,255,.38)', letterSpacing: '.05em' }}>{note}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
