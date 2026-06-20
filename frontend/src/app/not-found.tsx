import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <AlertTriangle size={24} color="var(--text-muted)" />
      </div>

      <div
        style={{
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
          color: 'var(--text-faint)',
          marginBottom: '0.75rem',
          letterSpacing: '0.08em',
        }}
      >
        ERROR 404
      </div>

      <h1
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          marginBottom: '0.75rem',
        }}
      >
        Page not found
      </h1>

      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: 360 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>

      <Link href="/" className="btn btn-primary">
        Go home
      </Link>
    </div>
  );
}
