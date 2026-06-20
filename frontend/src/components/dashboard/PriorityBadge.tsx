'use client';

import { Priority, RequestStatus } from '@/types';
import { motion } from 'framer-motion';

interface PriorityBadgeProps {
  priority: Priority | null;
}

const priorityConfig: Record<Priority, { label: string; pulse: boolean }> = {
  low:      { label: 'Low',      pulse: false },
  medium:   { label: 'Medium',   pulse: false },
  high:     { label: 'High',     pulse: false },
  critical: { label: 'Critical', pulse: true  },
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (!priority) {
    return (
      <span
        className="badge"
        style={{ color: 'var(--text-ghost)', borderColor: 'var(--border-subtle)' }}
      >
        —
      </span>
    );
  }
  const config = priorityConfig[priority];
  return (
    <motion.span
      className={`badge priority-${priority} ${config.pulse ? 'pulse-critical' : ''}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {priority === 'critical' && (
        <span style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'currentColor',
          display: 'inline-block',
          animation: 'pulse-critical 1.8s infinite',
        }} />
      )}
      {config.label}
    </motion.span>
  );
}

interface StatusBadgeProps {
  status: RequestStatus;
}

const statusLabels: Record<RequestStatus, string> = {
  pending:   'Pending',
  assigned:  'Assigned',
  accepted:  'Accepted',
  en_route:  'En Route',
  picked_up: 'Picked Up',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <motion.span
      className={`badge badge-${status}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {statusLabels[status]}
    </motion.span>
  );
}
