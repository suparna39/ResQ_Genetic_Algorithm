export default function Loading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        {/* Animated ambulance cross */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 10,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'pulse-critical 1.5s ease-in-out infinite',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#ededed" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-faint)', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
          LOADING...
        </div>
      </div>
    </div>
  );
}
