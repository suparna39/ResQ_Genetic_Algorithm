// ResQ custom SVG logo — Star-of-Life cross + location pin drop fused
// Works as a React component at any size, defaults match the nav/auth context

interface ResQLogoProps {
  /** pixel size of the square icon */
  size?: number;
  /** show the wordmark "ResQ" next to the icon */
  wordmark?: boolean;
  /** 'coral' (login) | 'violet' (register) | 'cyan' (nav) */
  variant?: 'coral' | 'violet' | 'cyan';
  className?: string;
}

const VARIANTS = {
  coral: {
    grad1: '#ff7a7a',
    grad2: '#ff4444',
    glow: 'rgba(255,95,95,.55)',
    text: '#f0f4ff',
  },
  violet: {
    grad1: '#c084fc',
    grad2: '#818cf8',
    glow: 'rgba(167,139,250,.5)',
    text: '#f0f4ff',
  },
  cyan: {
    grad1: '#9cecff',
    grad2: '#38bdf8',
    glow: 'rgba(156,236,255,.5)',
    text: '#eefaff',
  },
};

export default function ResQLogo({
  size = 36,
  wordmark = true,
  variant = 'coral',
  className = '',
}: ResQLogoProps) {
  const v = VARIANTS[variant];
  const id = `rq-${variant}-${size}`;
  const r = size * 0.265; // border-radius ≈ 26.5% of size (iOS-style)

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.3, textDecoration: 'none' }}
    >
      {/* ── Icon ──────────────────────────────────────────────── */}
      <svg
        width={size} height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ flexShrink: 0, filter: `drop-shadow(0 0 ${size * 0.42}px ${v.glow})` }}
      >
        <defs>
          {/* Icon background gradient */}
          <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={v.grad1} />
            <stop offset="100%" stopColor={v.grad2} />
          </linearGradient>
          {/* Shine overlay */}
          <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Rounded square background */}
        <rect x="0" y="0" width="36" height="36" rx="9.5" ry="9.5" fill={`url(#${id}-bg)`} />
        {/* Shine */}
        <rect x="0" y="0" width="36" height="36" rx="9.5" ry="9.5" fill={`url(#${id}-shine)`} />

        {/* ── Medical cross (Star-of-Life core) ─────────────── */}
        {/* Vertical bar */}
        <rect x="14.5" y="6" width="7" height="24" rx="2.5" fill="white" fillOpacity="0.95" />
        {/* Horizontal bar */}
        <rect x="6" y="14.5" width="24" height="7" rx="2.5" fill="white" fillOpacity="0.95" />

        {/* ── Location pin dot at center ─────────────────────── */}
        <circle cx="18" cy="18" r="2.8" fill={v.grad2} />
        {/* Tiny white ring to make the dot pop */}
        <circle cx="18" cy="18" r="1.4" fill="white" fillOpacity="0.75" />

        {/* ── Subtle pulse ring ──────────────────────────────── */}
        <circle cx="18" cy="18" r="8" stroke="white" strokeWidth="0.7" strokeOpacity="0.18" fill="none" />
      </svg>

      {/* ── Wordmark ───────────────────────────────────────────── */}
      {wordmark && (
        <span
          style={{
            fontFamily: "'Archivo', system-ui, sans-serif",
            fontSize: size * 0.625,
            fontWeight: 800,
            letterSpacing: '-0.05em',
            color: v.text,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ResQ
        </span>
      )}
    </span>
  );
}
