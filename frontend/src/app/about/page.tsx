'use client';

import { motion } from 'framer-motion';
import AmbientNav, { AmbientVideoBg, AMBIENT_STYLES } from '@/components/layout/AmbientNav';
import {
  Brain, GitBranch, Users, Cpu, Database, Layers,
  Zap, Target, RefreshCw, Filter, Award, Code2,
  ArrowRight, FlaskConical, BarChart3, Network
} from 'lucide-react';

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
});

const TEAM = [
  { name: 'Sushovan Ghosh',      role: 'Team Lead & Backend Architect',  focus: 'System design, Node.js APIs, Supabase schema, deployment pipeline', icon: Code2 },
  { name: 'Suparna Panda',       role: 'AI / ML Engineer',               focus: 'Random Forest classifier, feature engineering, model training & evaluation', icon: Brain },
  { name: 'Suman Ghosh',         role: 'Frontend Developer',             focus: 'Next.js UI, real-time dashboard, map integration, UX design', icon: Layers },
  { name: 'Shreyashi Bhunia',    role: 'AI / ML Engineer',               focus: 'Genetic Algorithm implementation, fitness function design, route optimization', icon: GitBranch },
  { name: 'Archishman Sarkar',   role: 'Backend Developer',              focus: 'Socket.IO real-time engine, Express middleware, ambulance tracking APIs', icon: Network },
  { name: 'Devargho Chakraborty',role: 'Full Stack & DevOps',            focus: 'Full-stack integration, Render/Vercel deployment, CI pipeline, testing', icon: Cpu },
];

const GA_PHASES = [
  {
    step: '01', icon: Filter,
    title: 'Chromosome Encoding',
    color: 'rgba(156,236,255,.8)',
    desc: 'Each individual in the population is a candidate ambulance assignment. A chromosome encodes a selected ambulance ID, its current zone, estimated distance to the patient, vehicle type (ALS/BLS), and real-time availability status.',
    detail: 'Gene structure: [ ambulance_id | zone_id | distance_km | vehicle_type | availability_score ]',
  },
  {
    step: '02', icon: Target,
    title: 'Fitness Function',
    color: 'rgba(255,196,100,.8)',
    desc: 'Each chromosome is scored using a multi-objective weighted fitness function balancing four critical factors. Higher fitness = better dispatch candidate.',
    detail: 'f(x) = 0.35×(1/distance) + 0.25×availability + 0.30×priority_weight + 0.10×(1/eta)\nAll factors normalized to [0,1] before weighting.',
  },
  {
    step: '03', icon: Award,
    title: 'Selection (Tournament)',
    color: 'rgba(200,150,255,.8)',
    desc: 'Tournament selection with k=3. Three random individuals compete; the fittest survives to the mating pool. Maintains selection pressure while preserving genetic diversity across generations.',
    detail: 'Population size: 50 individuals\nTournament size k = 3\nElitism: top 2 individuals preserved each generation',
  },
  {
    step: '04', icon: RefreshCw,
    title: 'Crossover & Mutation',
    color: 'rgba(100,255,180,.8)',
    desc: 'Single-point crossover exchanges ambulance selection genes between parent pairs, producing offspring that inherit traits from both. Swap mutation randomly alters one gene to maintain diversity.',
    detail: 'Crossover probability: 0.85\nMutation probability: 0.05\nCrossover type: Single-point\nMutation type: Random swap',
  },
  {
    step: '05', icon: BarChart3,
    title: 'Termination & Output',
    color: 'rgba(255,150,150,.8)',
    desc: 'The GA runs for a maximum of 100 generations or terminates early if the best fitness score has not improved for 10 consecutive generations. The highest-scoring chromosome is decoded into the dispatched ambulance.',
    detail: 'Max generations: 100\nEarly stopping: 10 stagnant generations\nAvg runtime: < 200ms on production hardware',
  },
];

const ML_FEATURES = [
  { label: 'Age', type: 'Numerical' },
  { label: 'Heart Rate', type: 'Numerical' },
  { label: 'Blood Pressure (Sys/Dia)', type: 'Numerical' },
  { label: 'Oxygen Saturation (SpO₂)', type: 'Numerical' },
  { label: 'Symptom Severity Score', type: 'Ordinal (1–10)' },
  { label: 'Conscious Level (GCS)', type: 'Categorical' },
  { label: 'Reported Symptom Category', type: 'Categorical (encoded)' },
  { label: 'Distance to Hospital', type: 'Numerical' },
];

const TECH = [
  { label: 'Frontend',    value: 'Next.js 15 App Router · Framer Motion · Leaflet.js · Socket.IO client' },
  { label: 'Backend',     value: 'Node.js · Express · Socket.IO · Better Auth · Prisma ORM' },
  { label: 'Database',    value: 'Supabase (PostgreSQL) · Row-Level Security · Realtime subscriptions' },
  { label: 'AI/ML',       value: 'Python · FastAPI · scikit-learn · Random Forest · GA (custom) · Dijkstra' },
  { label: 'Deployment',  value: 'Vercel (frontend) · Render (backend + AI) · Supabase Cloud' },
  { label: 'Real-Time',   value: 'WebSockets (Socket.IO) · GPS stream · Live assignment events' },
];

export default function AboutPage() {
  return (
    <>
      <style>{AMBIENT_STYLES}</style>
      <style>{`
        .about-hero { padding: 160px clamp(20px,6vw,80px) 80px; max-width: 1100px; margin: 0 auto; }
        .about-section { padding: 80px clamp(20px,6vw,80px); max-width: 1200px; margin: 0 auto; }
        .team-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px,1fr)); gap: 16px; margin-top: 36px; }
        .team-card { padding: 28px; display: flex; flex-direction: column; gap: 12px; }
        .team-icon { width: 44px; height: 44px; border-radius: 12px;
          background: rgba(156,236,255,.1); border: 1px solid rgba(156,236,255,.18);
          display: flex; align-items: center; justify-content: center; }
        .team-name { font: 700 17px 'Instrument Sans', system-ui, sans-serif; color: #eefaff; letter-spacing: -.01em; }
        .team-role { font: 500 12px 'IBM Plex Mono', monospace; color: rgba(156,236,255,.75); letter-spacing: .06em; text-transform: uppercase; }
        .team-focus { font-size: 13.5px; color: rgba(238,250,255,.58); line-height: 1.6; }

        .ga-timeline { display: flex; flex-direction: column; gap: 0; margin-top: 36px; }
        .ga-step { display: grid; grid-template-columns: 56px 1fr; gap: 24px; position: relative; }
        .ga-step:not(:last-child)::before {
          content: ''; position: absolute; left: 27px; top: 56px; bottom: -20px;
          width: 2px; background: linear-gradient(180deg, rgba(156,236,255,.3), rgba(156,236,255,.05));
        }
        .ga-step-num {
          width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center; flex-direction: column;
          font: 700 11px 'IBM Plex Mono', monospace; letter-spacing: .05em;
        }
        .ga-body { padding: 0 0 40px; }
        .ga-title { font: 700 18px 'Instrument Sans', system-ui, sans-serif; letter-spacing: -.01em; color: #eefaff; margin-bottom: 8px; }
        .ga-desc { font-size: 14.5px; color: rgba(238,250,255,.65); line-height: 1.7; margin-bottom: 12px; }
        .ga-code { font: 12px 'IBM Plex Mono', monospace; color: rgba(156,236,255,.75); 
          background: rgba(156,236,255,.05); border: 1px solid rgba(156,236,255,.12);
          border-radius: 8px; padding: 12px 16px; line-height: 1.7; white-space: pre-wrap; }

        .ml-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; }
        .ml-feature-list { display: flex; flex-direction: column; gap: 8px; }
        .ml-feature-row { display: flex; justify-content: space-between; align-items: center;
          padding: 10px 14px; border-radius: 8px; background: rgba(238,250,255,.04);
          border: 1px solid rgba(238,250,255,.06); font-size: 13.5px; }
        .ml-label { color: rgba(238,250,255,.8); font-weight: 500; }
        .ml-type { font: 11px 'IBM Plex Mono', monospace; color: rgba(156,236,255,.65); }

        .accuracy-ring { width: 160px; height: 160px; border-radius: 50%;
          background: conic-gradient(rgba(156,236,255,.8) 0% 94%, rgba(238,250,255,.08) 94% 100%);
          display: flex; align-items: center; justify-content: center; position: relative;
          box-shadow: 0 0 40px rgba(156,236,255,.2); }
        .accuracy-inner { width: 120px; height: 120px; border-radius: 50%;
          background: rgba(7,21,34,.9); display: flex; flex-direction: column; align-items: center; justify-content: center; }

        .tech-table { display: flex; flex-direction: column; gap: 1px; margin-top: 24px;
          border: 1px solid rgba(238,250,255,.1); border-radius: 14px; overflow: hidden; }
        .tech-row { display: grid; grid-template-columns: 140px 1fr; gap: 0;
          background: rgba(8,26,42,.6); backdrop-filter: blur(16px); }
        .tech-row:not(:last-child) { border-bottom: 1px solid rgba(238,250,255,.06); }
        .tech-key { padding: 14px 20px; font: 600 11px 'IBM Plex Mono', monospace;
          color: rgba(156,236,255,.75); letter-spacing: .08em; text-transform: uppercase;
          border-right: 1px solid rgba(238,250,255,.06); display: flex; align-items: center; }
        .tech-val { padding: 14px 20px; font-size: 13px; color: rgba(238,250,255,.7); line-height: 1.6; }

        @media (max-width: 768px) {
          .ml-grid { grid-template-columns: 1fr; }
          .ga-step { grid-template-columns: 40px 1fr; gap: 16px; }
          .ga-step-num { width: 40px; height: 40px; font-size: 9px; }
          .ga-step:not(:last-child)::before { left: 19px; }
          .tech-row { grid-template-columns: 1fr; }
          .tech-key { border-right: none; border-bottom: 1px solid rgba(238,250,255,.06); }
        }
      `}</style>

      <AmbientVideoBg />
      <AmbientNav active="about" />

      <div className="amb-page">

        {/* ── Hero ─────────────────────────────────────────────── */}
        <motion.div className="about-hero" {...fade()}>
          <div className="section-eyebrow">ResQ / About</div>
          <h1 className="section-title" style={{ marginBottom: 20 }}>
            Built to save<br />every second.
          </h1>
          <p className="section-sub" style={{ fontSize: 16 }}>
            ResQ is an AI-powered emergency ambulance dispatch system developed by a team of six engineers.
            It combines a Machine Learning priority classifier with a Genetic Algorithm dispatcher and
            real-time GPS tracking to reduce response times across India.
          </p>
        </motion.div>

        {/* ── Team ─────────────────────────────────────────────── */}
        <div className="about-section">
          <motion.div {...fade()}>
            <div className="section-eyebrow">The Team</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: 8 }}>
              Built by six.
            </h2>
            <p className="section-sub">Engineers who turned a complex logistics problem into an elegant real-time system.</p>
          </motion.div>

          <div className="team-grid">
            {TEAM.map((member, i) => {
              const Icon = member.icon;
              return (
                <motion.div key={member.name} className="glass-card team-card" {...fade(i * 0.06)}>
                  <div className="team-icon">
                    <Icon size={20} color="#9cecff" strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="team-name">{member.name}</div>
                    <div className="team-role" style={{ marginTop: 4 }}>{member.role}</div>
                  </div>
                  <div className="team-focus">{member.focus}</div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Genetic Algorithm deep-dive ───────────────────────── */}
        <div className="about-section">
          <motion.div {...fade()}>
            <div className="section-eyebrow">Core Intelligence</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: 8 }}>
              Genetic Algorithm<br />Architecture
            </h2>
            <p className="section-sub">
              A custom evolutionary optimizer that solves the multi-objective ambulance selection problem —
              balancing distance, urgency, vehicle type, and availability — in under 200ms.
            </p>
          </motion.div>

          <div className="ga-timeline" style={{ marginTop: 48 }}>
            {GA_PHASES.map((phase, i) => {
              const Icon = phase.icon;
              return (
                <motion.div key={phase.step} className="ga-step" {...fade(i * 0.07)}>
                  <div
                    className="ga-step-num"
                    style={{
                      background: `linear-gradient(135deg, ${phase.color}22, ${phase.color}08)`,
                      border: `1px solid ${phase.color}44`,
                      color: phase.color,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                  </div>
                  <div className="ga-body">
                    <div className="ga-title">{phase.step} · {phase.title}</div>
                    <div className="ga-desc">{phase.desc}</div>
                    <div className="ga-code">{phase.detail}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── ML Model deep-dive ───────────────────────────────── */}
        <div className="about-section">
          <motion.div {...fade()}>
            <div className="section-eyebrow">Machine Learning Model</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)', marginBottom: 8 }}>
              Random Forest<br />Priority Classifier
            </h2>
            <p className="section-sub">
              A scikit-learn Random Forest model trained on emergency vitals and symptom data to classify
              cases into four urgency tiers: Low, Medium, High, Critical.
            </p>
          </motion.div>

          <div className="ml-grid" style={{ marginTop: 48 }}>
            {/* Feature list */}
            <motion.div {...fade(0.08)}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(238,250,255,.5)', letterSpacing: '.08em', textTransform: 'uppercase', fontFamily: "'IBM Plex Mono',monospace", marginBottom: 14 }}>
                Input Features
              </div>
              <div className="ml-feature-list">
                {ML_FEATURES.map((f) => (
                  <div key={f.label} className="ml-feature-row">
                    <span className="ml-label">{f.label}</span>
                    <span className="ml-type">{f.type}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Accuracy ring + details */}
            <motion.div {...fade(0.12)} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="glass-sm" style={{ padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                <div className="accuracy-ring">
                  <div className="accuracy-inner">
                    <span style={{ font: "800 28px 'Archivo',system-ui,sans-serif", color: '#9cecff' }}>94%</span>
                    <span style={{ font: "500 10px 'IBM Plex Mono',monospace", color: 'rgba(238,250,255,.5)', letterSpacing: '.06em' }}>ACCURACY</span>
                  </div>
                </div>
                <p style={{ font: "13.5px 'Instrument Sans',system-ui,sans-serif", color: 'rgba(238,250,255,.6)', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                  Evaluated on held-out test set of 2,000 synthetic emergency records.
                  F1-score: 0.92 (macro average across all four classes).
                </p>
              </div>

              <div className="glass-sm" style={{ padding: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { k: 'Algorithm',    v: 'Random Forest Classifier (scikit-learn)' },
                    { k: 'N Estimators', v: '200 trees' },
                    { k: 'Max Depth',    v: '12 (tuned via GridSearchCV)' },
                    { k: 'Scaler',       v: 'StandardScaler (numerical features)' },
                    { k: 'Encoding',     v: 'Label Encoding (categorical)' },
                    { k: 'Output',       v: 'Low / Medium / High / Critical' },
                  ].map(({ k, v }) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ font: "500 11px 'IBM Plex Mono',monospace", color: 'rgba(156,236,255,.7)', flexShrink: 0 }}>{k}</span>
                      <span style={{ fontSize: 12.5, color: 'rgba(238,250,255,.6)', textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Tech stack ───────────────────────────────────────── */}
        <div className="about-section">
          <motion.div {...fade()}>
            <div className="section-eyebrow">Technology Stack</div>
            <h2 className="section-title" style={{ fontSize: 'clamp(28px,4vw,48px)' }}>
              End-to-End.
            </h2>
          </motion.div>

          <motion.div className="tech-table" {...fade(0.08)}>
            {TECH.map(({ label, value }) => (
              <div key={label} className="tech-row">
                <div className="tech-key">{label}</div>
                <div className="tech-val">{value}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Footer spacer ─────────────────────────────────────── */}
        <div style={{ height: 60 }} />
      </div>
    </>
  );
}
