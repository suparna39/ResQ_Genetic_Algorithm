'use client';

import { RequestStatus } from '@/types';
import { CheckCircle, Clock, Truck, MapPin, Package, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const steps: { status: RequestStatus; label: string; sublabel: string; icon: React.ElementType }[] = [
  { status: 'pending',   label: 'Request Sent',        sublabel: 'Processing with AI',        icon: Clock      },
  { status: 'assigned',  label: 'Ambulance Assigned',  sublabel: 'GA optimization complete',   icon: Package    },
  { status: 'accepted',  label: 'Driver Confirmed',    sublabel: 'En route to you',            icon: CheckCircle },
  { status: 'en_route',  label: 'En Route',            sublabel: 'Ambulance approaching',      icon: Truck      },
  { status: 'picked_up', label: 'Patient Aboard',      sublabel: 'Heading to hospital',        icon: MapPin     },
  { status: 'completed', label: 'Completed',           sublabel: 'Mission successful',         icon: CheckCircle },
];

const statusOrder: Record<RequestStatus, number> = {
  pending: 0, assigned: 1, accepted: 2, en_route: 3, picked_up: 4, completed: 5, cancelled: -1,
};

interface StatusStepperProps {
  currentStatus: RequestStatus;
}

export default function StatusStepper({ currentStatus }: StatusStepperProps) {
  if (currentStatus === 'cancelled') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.875rem',
          padding: '1.25rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(46,46,58,0.5)',
          border: '1px solid var(--status-cancelled)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <XCircle size={16} color="var(--status-cancelled)" />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Request Cancelled</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            This emergency request has been cancelled.
          </div>
        </div>
      </motion.div>
    );
  }

  const currentOrder = statusOrder[currentStatus];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{
        background: 'var(--gradient-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.25rem',
        boxShadow: 'var(--shadow-card)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top shimmer edge */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(200,200,240,0.12), transparent)',
      }} />

      <div style={{
        fontSize: '0.6875rem', fontWeight: 600,
        color: 'var(--text-faint)',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        fontFamily: 'var(--font-geist-mono)',
        marginBottom: '1.25rem',
      }}>
        Mission Timeline
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((step, idx) => {
          const isDone    = currentOrder >= idx;
          const isActive  = currentOrder === idx;
          const isFuture  = currentOrder < idx;
          const Icon      = step.icon;

          return (
            <motion.div
              key={step.status}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.25 }}
              style={{ display: 'flex', gap: '0.875rem' }}
            >
              {/* Icon + connector line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    background: isDone
                      ? isActive
                        ? 'linear-gradient(135deg, #d0d0d8, #b8b8c4)'
                        : 'linear-gradient(135deg, #404050, #2e2e3e)'
                      : 'var(--bg-surface)',
                    border: isActive
                      ? '1px solid var(--text-secondary)'
                      : isDone
                      ? '1px solid var(--border-strong)'
                      : '1px solid var(--border)',
                    boxShadow: isActive
                      ? '0 0 0 3px var(--bg-base), 0 0 0 4px rgba(180,180,200,0.25)'
                      : 'none',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Icon
                    size={12}
                    color={
                      isActive ? '#0a0a10' :
                      isDone   ? 'var(--text-secondary)' :
                                 'var(--text-ghost)'
                    }
                    strokeWidth={2}
                  />
                </div>

                {idx < steps.length - 1 && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 20,
                      margin: '3px 0',
                      background: isDone
                        ? 'linear-gradient(to bottom, var(--border-strong), var(--border))'
                        : 'var(--border-subtle)',
                      transition: 'background 0.4s ease',
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <div style={{
                paddingBottom: idx < steps.length - 1 ? '1.1rem' : 0,
                paddingTop: '0.2rem',
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 600 : isDone ? 500 : 400,
                  color: isActive
                    ? 'var(--text-primary)'
                    : isDone
                    ? 'var(--text-secondary)'
                    : 'var(--text-faint)',
                  letterSpacing: '-0.01em',
                  transition: 'color 0.3s ease',
                }}>
                  {step.label}
                </div>
                {(isActive || isDone) && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: isActive ? 'var(--text-muted)' : 'var(--text-ghost)',
                    marginTop: '0.1rem',
                    fontFamily: 'var(--font-geist-mono)',
                  }}>
                    {isActive ? step.sublabel : ''}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
