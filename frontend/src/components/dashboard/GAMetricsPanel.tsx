'use client';

import { GAMetrics } from '@/types';
import { motion } from 'framer-motion';
import { Dna, Gauge, Activity, Wind, Crosshair, Trophy, Cpu } from 'lucide-react';

interface GAMetricsPanelProps {
  metrics: GAMetrics;
  compact?: boolean;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ga-stat">
      <div className="ga-stat-label">{label}</div>
      <div className="ga-stat-value">{value}</div>
      {sub && <div className="ga-stat-sub">{sub}</div>}
    </div>
  );
}

export default function GAMetricsPanel({ metrics, compact = false }: GAMetricsPanelProps) {
  const isGA = metrics.engine === 'genetic_algorithm';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="panel"
      style={{ padding: '1.4rem' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <div className={`ga-badge-icon ${isGA ? 'live' : ''}`}>
            <Dna size={16} strokeWidth={2} />
          </div>
          <div>
            <div className="panel-title" style={{ fontSize: '0.9375rem' }}>
              {isGA ? 'Genetic Algorithm' : 'Heuristic Dispatch'}
            </div>
            <div className="panel-sub">
              {isGA ? 'Optimal unit selected by evolutionary search' : 'Nearest-available fallback selection'}
            </div>
          </div>
        </div>
        <span className={`ga-engine-pill ${isGA ? 'ga' : 'fallback'}`}>
          {isGA ? 'GA · OPTIMIZED' : 'FALLBACK'}
        </span>
      </div>

      {/* Reason */}
      <div className="ga-reason">
        <Trophy size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-secondary)' }} />
        <span>{metrics.reason}</span>
      </div>

      {/* Core metrics grid */}
      <div className="ga-grid">
        <Stat
          label="Fitness"
          value={metrics.fitness_score != null ? metrics.fitness_score.toFixed(3) : '—'}
          sub="GA score"
        />
        <Stat
          label="Distance"
          value={metrics.distance_km != null ? `${metrics.distance_km.toFixed(2)} km` : '—'}
        />
        <Stat label="ETA" value={`${metrics.eta_minutes} min`} />
        <Stat
          label="Candidates"
          value={`${metrics.candidates_evaluated}`}
          sub={`of ${metrics.fleet_size} fleet`}
        />
      </div>

      {!compact && (
        <>
          {/* Decision factors */}
          <div className="ga-eyebrow">Decision Factors</div>
          <div className="ga-factors">
            <div className="ga-factor">
              <Activity size={13} strokeWidth={1.75} />
              <span className="ga-factor-label">Priority</span>
              <span className={`ga-chip pri-${metrics.priority}`}>{metrics.priority}</span>
            </div>
            <div className="ga-factor">
              <Wind size={13} strokeWidth={1.75} />
              <span className="ga-factor-label">Traffic</span>
              <span className="ga-chip">{metrics.traffic_level} · {metrics.congestion_multiplier}×</span>
            </div>
            <div className="ga-factor">
              <Crosshair size={13} strokeWidth={1.75} />
              <span className="ga-factor-label">Hotspot risk</span>
              <span className="ga-chip">{metrics.hotspot_category} · {metrics.hotspot_risk.toFixed(2)}</span>
            </div>
            <div className="ga-factor">
              <Gauge size={13} strokeWidth={1.75} />
              <span className="ga-factor-label">Confidence</span>
              <span className="ga-chip">{Math.round(metrics.priority_confidence * 100)}%</span>
            </div>
          </div>

          {/* GA run stats */}
          {isGA && metrics.generations_run != null && (
            <div className="ga-runstats">
              <Cpu size={12} strokeWidth={1.75} />
              <span>
                Converged in <strong>{metrics.generations_run}</strong> generations
                {metrics.population_size ? <> · population <strong>{metrics.population_size}</strong></> : null}
              </span>
            </div>
          )}

          {/* Backups */}
          {metrics.backup_suggestions.length > 0 && (
            <>
              <div className="ga-eyebrow">Backup Units</div>
              <div className="ga-backups">
                {metrics.backup_suggestions.map((b, i) => (
                  <div key={b.ambulance_id} className="ga-backup">
                    <span className="ga-backup-rank">#{i + 2}</span>
                    <span className="ga-backup-eta">{b.eta_minutes.toFixed(0)} min</span>
                    {b.fitness > 0 && <span className="ga-backup-fit">fit {b.fitness.toFixed(2)}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </motion.div>
  );
}
