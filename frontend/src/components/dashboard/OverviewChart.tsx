'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

interface Point {
  label: string;
  primary: number;
  secondary: number;
}

interface OverviewChartProps {
  data: Point[];
  height?: number;
}

function PremiumTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'linear-gradient(160deg, rgba(28,28,36,0.96), rgba(16,16,22,0.96))',
        border: '1px solid var(--border-accent)',
        borderRadius: 10,
        padding: '0.6rem 0.8rem',
        boxShadow: 'var(--shadow-float)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div style={{
        fontSize: '0.625rem',
        color: 'var(--text-faint)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily: 'var(--font-geist-mono)',
        marginBottom: '0.2rem',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Health data
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
        {payload[0]?.value} index
      </div>
    </div>
  );
}

export default function OverviewChart({ data, height = 240 }: OverviewChartProps) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="rqPrimaryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(220,220,245,0.22)" />
              <stop offset="100%" stopColor="rgba(220,220,245,0)" />
            </linearGradient>
            <linearGradient id="rqPrimaryStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#9a9ac4" />
              <stop offset="50%" stopColor="#ededf0" />
              <stop offset="100%" stopColor="#8a8ab0" />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="var(--border-subtle)"
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' }}
            dy={8}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--text-faint)', fontSize: 11, fontFamily: 'var(--font-geist-mono)' }}
            width={48}
          />
          <Tooltip
            content={<PremiumTooltip />}
            cursor={{ stroke: 'var(--border-accent)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />

          {/* Secondary, fainter line */}
          <Area
            type="monotone"
            dataKey="secondary"
            stroke="rgba(120,120,150,0.5)"
            strokeWidth={1.5}
            fill="transparent"
            dot={false}
            activeDot={false}
          />
          {/* Primary luminous line */}
          <Area
            type="monotone"
            dataKey="primary"
            stroke="url(#rqPrimaryStroke)"
            strokeWidth={2.5}
            fill="url(#rqPrimaryFill)"
            dot={false}
            activeDot={{
              r: 4,
              fill: '#ededf0',
              stroke: 'rgba(200,200,240,0.4)',
              strokeWidth: 4,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
