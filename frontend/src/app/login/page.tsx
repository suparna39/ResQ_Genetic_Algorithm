'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth';
import SideRays from '@/components/ui/SideRays';
import BorderGlow from '@/components/ui/BorderGlow';
import ResQLogo from '@/components/ui/ResQLogo';
import CinemaTransition from '@/components/ui/CinemaTransition';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap';

// ResQ — full violet palette matching register (direction stays top-right)
const RAY1 = '#a78bfa'; // violet rays
const RAY2 = '#9cecff'; // ResQ cyan

// BorderGlow — violet, identical to register
const GLOW_COLORS    = ['#a78bfa', '#818cf8', '#9cecff'];
const GLOW_COLOR_HSL = '258 85 74'; // violet HSL

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [focused,      setFocused]      = useState<string | null>(null);
  const [mounted,      setMounted]      = useState(false);

  // Entry animation trigger — fires once on mount
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* ── Auth logic — unchanged ─────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill in all fields'); return; }
    setIsLoading(true);
    try {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) { toast.error(error.message || 'Login failed'); return; }
      if (data?.token) localStorage.setItem('auth_token', data.token);
      toast.success('Welcome back!');
      const role = (data?.user as any)?.role || 'patient';
      if      (role === 'admin')  router.push('/admin/dashboard');
      else if (role === 'driver') router.push('/driver/dashboard');
      else                        router.push('/patient/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`@import url('${FONTS}');`}</style>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; }

        .lr-page {
          min-height: 100svh;
          background: #09090f;
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          font-family: 'Instrument Sans', system-ui, sans-serif;
          color: #f0f4ff;
          padding: clamp(20px,4vw,48px);
        }
        .lr-rays    { position: absolute; inset: 0; z-index: 0; }
        .lr-vignette {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: radial-gradient(ellipse 85% 85% at 50% 50%, transparent 30%, rgba(9,9,15,.7) 100%);
        }
        .lr-grid {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
        }

        /* ── Center wrapper — entry animation ────────────────── */
        .lr-center {
          position: relative; z-index: 10;
          width: 100%; max-width: 440px;
          display: flex; flex-direction: column;
          opacity: 0; transform: translateY(28px);
          transition: opacity .65s cubic-bezier(.22,.68,0,1.2),
                      transform .65s cubic-bezier(.22,.68,0,1.2);
        }
        .lr-center.lr-visible {
          opacity: 1; transform: translateY(0);
        }

        /* ── Logo ─────────────────────────────────────────────── */
        .lr-logo {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 28px; text-decoration: none;
        }
        .lr-logo-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #ff5f5f, #ff9966);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 22px rgba(255,95,95,.45);
        }
        .lr-logo-name {
          font-family: 'Archivo', system-ui, sans-serif;
          font-size: 22px; font-weight: 800; letter-spacing: -.05em; color: #f0f4ff;
        }

        /* ── Card interior ───────────────────────────────────── */
        .lr-inner { padding: 38px 40px; }

        /* ── Eyebrow + heading ───────────────────────────────── */
        .lr-eyebrow {
          font: 500 10px 'IBM Plex Mono', monospace;
          letter-spacing: .18em; text-transform: uppercase;
          color: rgba(156,236,255,.75); margin-bottom: 10px;
        }
        .lr-heading {
          font-family: 'Archivo', system-ui, sans-serif;
          font-size: clamp(26px,5vw,34px); font-weight: 800;
          letter-spacing: -.05em; color: #f0f4ff; line-height: 1; margin-bottom: 8px;
        }
        .lr-sub {
          font-size: 13.5px; color: rgba(240,244,255,.45);
          margin-bottom: 30px; line-height: 1.55;
        }

        /* ── Fields ──────────────────────────────────────────── */
        .lr-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .lr-label {
          font: 600 11.5px 'Instrument Sans', system-ui, sans-serif;
          color: rgba(240,244,255,.6); letter-spacing: .02em;
        }
        .lr-input-wrap { position: relative; }
        .lr-input {
          width: 100%; padding: 12px 14px;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px;
          color: #f0f4ff; font: 15px 'Instrument Sans', system-ui, sans-serif;
          outline: none;
          transition: border-color .18s ease, box-shadow .18s ease;
          -webkit-appearance: none;
        }
        .lr-input::placeholder { color: rgba(240,244,255,.22); }
        .lr-input:focus {
          border-color: rgba(167,139,250,.5);
          box-shadow: 0 0 0 3px rgba(167,139,250,.12);
        }
        .lr-input-pw { padding-right: 44px; }
        .lr-pw-toggle {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer;
          color: rgba(240,244,255,.38); padding: 4px; display: flex;
          transition: color .15s ease;
        }
        .lr-pw-toggle:hover { color: rgba(240,244,255,.75); }

        /* ── Forgot ──────────────────────────────────────────── */
        .lr-forgot {
          text-align: right; margin-top: -8px; margin-bottom: 24px;
        }
        .lr-forgot a {
          font-size: 12px; color: rgba(156,236,255,.65);
          text-decoration: none; transition: color .15s ease;
        }
        .lr-forgot a:hover { color: #9cecff; }

        /* ── Submit button ───────────────────────────────────── */
        .lr-btn {
          width: 100%; padding: 14px 20px;
          background: linear-gradient(135deg, #a78bfa, #818cf8);
          border: none; border-radius: 12px; cursor: pointer;
          color: #fff; font: 700 15px 'Instrument Sans', system-ui, sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 8px 32px rgba(167,139,250,.35), 0 0 0 1px rgba(167,139,250,.25);
          transition: transform .22s cubic-bezier(.22,.68,0,1.2),
                      box-shadow .22s ease, opacity .18s ease;
          position: relative; overflow: hidden;
        }
        .lr-btn::before {
          content:''; position:absolute; inset:0;
          background: linear-gradient(135deg,rgba(255,255,255,.15),transparent);
          opacity:0; transition:opacity .18s ease;
        }
        .lr-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(167,139,250,.5), 0 0 0 1px rgba(167,139,250,.4);
        }
        .lr-btn:hover::before { opacity:1; }
        .lr-btn:active:not(:disabled) { transform:translateY(0); }
        .lr-btn:disabled { opacity:.65; cursor:not-allowed; }

        /* ── Divider + footer ────────────────────────────────── */
        .lr-divider {
          display:flex; align-items:center; gap:12px;
          margin:22px 0; color:rgba(240,244,255,.2);
          font:11px 'IBM Plex Mono',monospace; letter-spacing:.08em;
        }
        .lr-divider::before,.lr-divider::after {
          content:''; flex:1; height:1px; background:rgba(255,255,255,.08);
        }
        .lr-footer { text-align:center; font-size:13.5px; color:rgba(240,244,255,.4); }
        .lr-footer a {
          color:rgba(167,139,250,.9); font-weight:600;
          text-decoration:none; transition:color .15s ease;
        }
        .lr-footer a:hover { color:#a78bfa; }

        @media (max-width:480px) {
          .lr-inner { padding:26px 20px; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .spin { animation:spin .8s linear infinite; }
      `}</style>

      <div className="lr-page">
        {/* ── SideRays WebGL background ─────────────────────────── */}
        <div className="lr-rays">
          <SideRays
            speed={1.8} rayColor1={RAY1} rayColor2={RAY2}
            intensity={2.2} spread={2.4} origin="top-right"
            tilt={-5} saturation={1.6} blend={0.6} falloff={1.5} opacity={0.9}
          />
        </div>
        <div className="lr-grid" />
        <div className="lr-vignette" />

        {/* ── Center column — entry-animated ────────────────────── */}
        <div className={`lr-center ${mounted ? 'lr-visible' : ''}`}>

          {/* Logo */}
          <CinemaTransition href="/" asLink className="lr-logo">
            <ResQLogo size={36} wordmark variant="violet" />
          </CinemaTransition>

          {/* BorderGlow card */}
          <BorderGlow
            animated
            edgeSensitivity={20}
            glowColor={GLOW_COLOR_HSL}
            backgroundColor="#0e0a16"
            borderRadius={22}
            glowRadius={38}
            glowIntensity={1.2}
            coneSpread={22}
            colors={GLOW_COLORS}
            fillOpacity={0.45}
          >
            <div className="lr-inner">
              <div className="lr-eyebrow">Emergency Dispatch System</div>
              <h1 className="lr-heading">Sign in</h1>
              <p className="lr-sub">Access your ResQ portal and continue your mission.</p>

              <form onSubmit={handleSubmit} noValidate>
                {/* Email */}
                <div className="lr-field">
                  <label className="lr-label" htmlFor="login-email">Email address</label>
                  <div className="lr-input-wrap">
                    <input
                      id="login-email" type="email" className="lr-input"
                      placeholder="you@example.com" autoComplete="email"
                      value={email} onChange={e => setEmail(e.target.value)}
                      onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="lr-field">
                  <label className="lr-label" htmlFor="login-password">Password</label>
                  <div className="lr-input-wrap">
                    <input
                      id="login-password" type={showPassword ? 'text' : 'password'}
                      className="lr-input lr-input-pw"
                      placeholder="••••••••" autoComplete="current-password"
                      value={password} onChange={e => setPassword(e.target.value)}
                      onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                      disabled={isLoading}
                    />
                    <button type="button" className="lr-pw-toggle"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Forgot */}
                <div className="lr-forgot"><Link href="#">Forgot password?</Link></div>

                {/* Submit */}
                <button type="submit" className="lr-btn" disabled={isLoading}>
                  {isLoading
                    ? <><Loader2 size={16} className="spin" /> Signing in…</>
                    : <>Sign in <ArrowRight size={15} /></>}
                </button>
              </form>

              <div className="lr-divider">or</div>
              <p className="lr-footer">
                No account?{' '}<CinemaTransition href="/register" asLink style={{color:'rgba(167,139,250,.9)',fontWeight:600,textDecoration:'none'}}>Create one — it&apos;s free</CinemaTransition>
              </p>
            </div>
          </BorderGlow>
        </div>
      </div>
    </>
  );
}
