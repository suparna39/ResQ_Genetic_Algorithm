import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
}

export default function StatCard({ label, value, icon: Icon, description }: StatCardProps) {
  return (
    <div className="card card-padding animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value" style={{ marginTop: '0.5rem' }}>{value}</div>
          {description && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.375rem' }}>
              {description}
            </div>
          )}
        </div>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={18} color="var(--text-secondary)" />
        </div>
      </div>
    </div>
  );
}
