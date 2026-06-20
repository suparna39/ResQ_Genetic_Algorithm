'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ArrowRight, Users, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth';
import SideRays from '@/components/ui/SideRays';
import BorderGlow from '@/components/ui/BorderGlow';
import ResQLogo from '@/components/ui/ResQLogo';
import CinemaTransition from '@/components/ui/CinemaTransition';

const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@700;800;900&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&display=swap';

// Register uses violet + cyan rays (different corner to login)
const RAY1 = '#a78bfa';
const RAY2 = '#9cecff';

// BorderGlow violet palette
const GLOW_COLORS = ['#a78bfa', '#818cf8', '#9cecff'];
const GLOW_COLOR_HSL = '258 85 74'; // violet in HSL

const ROLES = [
  { value: 'patient', label: 'Patient',  desc: 'Request emergency ambulance', Icon: Users },
  { value: 'driver',  label: 'Driver',   desc: 'Respond to dispatch calls',   Icon: Truck },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    role: 'patient' as 'patient' | 'driver',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [focused,      setFocused]      = useState<string | null>(null);
  const [mounted,      setMounted]      = useState(false);

  // Entry animation — triggers on every portal visit
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const set = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  /* ── Auth logic — unchanged ─────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill all required fields'); return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        name: form.name, email: form.email, password: form.password,
        // @ts-ignore
        role: form.role, phone: form.phone,
      });
      if (error) { toast.error(error.message || 'Registration failed'); return; }
      const { data: signInData } = await authClient.signIn.email({
        email: form.email, password: form.password,
      });
      if (signInData?.token) localStorage.setItem('auth_token', signInData.token);
      toast.success('Account created! Redirecting…');
      if (form.role === 'driver') router.push('/driver/dashboard');
      else                        router.push('/patient/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`@import url('${FONTS}');`}</style>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; }

        .rg-page {
          min-height: 100svh;
          background: #09090f;
          display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          font-family: 'Instrument Sans', system-ui, sans-serif;
          color: #f0f4ff;
          padding: clamp(20px,4vw,48px);
        }
        .rg-rays    { position: absolute; inset: 0; z-index: 0; }
        .rg-vignette {
          position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background: radial-gradient(ellipse 90% 90% at 50% 50%, transparent 20%, rgba(9,9,15,.68) 100%);
        }
        .rg-grid {
          position: absolute; inset: 0; z-index: 2; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px);
          background-size: 52px 52px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
        }

        /* ── Center column — entry animation ─────────────────── */
        .rg-center {
          position: relative; z-index: 10;
          width: 100%; max-width: 480px;
          display: flex; flex-direction: column;
          opacity: 0; transform: translateY(28px);
          transition: opacity .65s cubic-bezier(.22,.68,0,1.2),
                      transform .65s cubic-bezier(.22,.68,0,1.2);
        }
        .rg-center.rg-visible { opacity:1; transform:translateY(0); }

        /* ── Logo ─────────────────────────────────────────────── */
        .rg-logo {
          display:flex; align-items:center; gap:10px;
          margin-bottom:26px; text-decoration:none;
        }
        .rg-logo-icon {
          width:36px; height:36px; border-radius:10px;
          background:linear-gradient(135deg,#a78bfa,#818cf8);
          display:flex; align-items:center; justify-content:center;
          box-shadow:0 0 22px rgba(167,139,250,.4);
        }
        .rg-logo-name {
          font-family:'Archivo',system-ui,sans-serif;
          font-size:22px; font-weight:800; letter-spacing:-.05em; color:#f0f4ff;
        }

        /* ── Card interior ───────────────────────────────────── */
        .rg-inner { padding:34px 38px; }

        /* ── Headings ────────────────────────────────────────── */
        .rg-eyebrow {
          font:500 10px 'IBM Plex Mono',monospace;
          letter-spacing:.18em; text-transform:uppercase;
          color:rgba(156,236,255,.75); margin-bottom:10px;
        }
        .rg-heading {
          font-family:'Archivo',system-ui,sans-serif;
          font-size:clamp(24px,5vw,32px); font-weight:800;
          letter-spacing:-.05em; color:#f0f4ff; line-height:1; margin-bottom:6px;
        }
        .rg-sub {
          font-size:13px; color:rgba(240,244,255,.42);
          margin-bottom:24px; line-height:1.55;
        }

        /* ── Role picker ─────────────────────────────────────── */
        .rg-roles { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:22px; }
        .rg-role {
          padding:13px 12px; border-radius:12px; cursor:pointer; text-align:left;
          background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1);
          transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
          display:flex; flex-direction:column; gap:5px;
        }
        .rg-role:hover { background:rgba(255,255,255,.07); }
        .rg-role[data-active='true'] {
          border-color:rgba(167,139,250,.55);
          background:rgba(167,139,250,.1);
          box-shadow:0 0 0 3px rgba(167,139,250,.12);
        }
        .rg-role-top { display:flex; align-items:center; gap:7px; }
        .rg-role-icon-wrap {
          width:27px; height:27px; border-radius:7px;
          display:flex; align-items:center; justify-content:center;
          background:rgba(167,139,250,.14);
          transition:background .18s ease;
        }
        .rg-role[data-active='true'] .rg-role-icon-wrap { background:rgba(167,139,250,.26); }
        .rg-role-label { font:700 13.5px 'Instrument Sans',system-ui,sans-serif; color:#f0f4ff; }
        .rg-role-desc  { font-size:11px; color:rgba(240,244,255,.42); line-height:1.4; }

        /* ── Form layout ─────────────────────────────────────── */
        .rg-row2   { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .rg-field  { display:flex; flex-direction:column; gap:5px; margin-bottom:13px; }
        .rg-label  {
          font:600 11.5px 'Instrument Sans',system-ui,sans-serif;
          color:rgba(240,244,255,.58); letter-spacing:.02em;
        }
        .rg-input-wrap { position:relative; }
        .rg-input {
          width:100%; padding:11px 13px;
          background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.1);
          border-radius:11px; color:#f0f4ff;
          font:14.5px 'Instrument Sans',system-ui,sans-serif;
          outline:none; -webkit-appearance:none;
          transition:border-color .18s ease, box-shadow .18s ease;
        }
        .rg-input::placeholder { color:rgba(240,244,255,.2); }
        .rg-input:focus {
          border-color:rgba(167,139,250,.5);
          box-shadow:0 0 0 3px rgba(167,139,250,.12);
        }
        .rg-input-pw { padding-right:42px; }
        .rg-pw-toggle {
          position:absolute; right:12px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer;
          color:rgba(240,244,255,.35); padding:4px; display:flex;
          transition:color .15s ease;
        }
        .rg-pw-toggle:hover { color:rgba(240,244,255,.72); }
        .rg-optional {
          font:500 9.5px 'IBM Plex Mono',monospace;
          letter-spacing:.06em; color:rgba(240,244,255,.28); margin-left:5px;
        }

        /* ── Submit ──────────────────────────────────────────── */
        .rg-btn {
          width:100%; margin-top:6px; padding:14px 20px;
          background:linear-gradient(135deg,#a78bfa,#818cf8);
          border:none; border-radius:12px; cursor:pointer;
          color:#fff; font:700 15px 'Instrument Sans',system-ui,sans-serif;
          display:flex; align-items:center; justify-content:center; gap:8px;
          box-shadow:0 8px 32px rgba(167,139,250,.35), 0 0 0 1px rgba(167,139,250,.25);
          transition:transform .22s cubic-bezier(.22,.68,0,1.2),
                     box-shadow .22s ease, opacity .18s ease;
          position:relative; overflow:hidden;
        }
        .rg-btn::before {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,.15),transparent);
          opacity:0; transition:opacity .18s ease;
        }
        .rg-btn:hover:not(:disabled) {
          transform:translateY(-2px);
          box-shadow:0 14px 40px rgba(167,139,250,.5), 0 0 0 1px rgba(167,139,250,.4);
        }
        .rg-btn:hover::before { opacity:1; }
        .rg-btn:active:not(:disabled) { transform:translateY(0); }
        .rg-btn:disabled { opacity:.65; cursor:not-allowed; }

        /* ── Divider + footer ────────────────────────────────── */
        .rg-divider {
          display:flex; align-items:center; gap:12px;
          margin:20px 0; color:rgba(240,244,255,.2);
          font:11px 'IBM Plex Mono',monospace; letter-spacing:.08em;
        }
        .rg-divider::before,.rg-divider::after {
          content:''; flex:1; height:1px; background:rgba(255,255,255,.08);
        }
        .rg-footer { text-align:center; font-size:13.5px; color:rgba(240,244,255,.38); }
        .rg-footer a {
          color:rgba(167,139,250,.9); font-weight:600;
          text-decoration:none; transition:color .15s ease;
        }
        .rg-footer a:hover { color:#a78bfa; }

        @media (max-width:520px) {
          .rg-inner  { padding:24px 18px; }
          .rg-row2   { grid-template-columns:1fr; }
          .rg-roles  { grid-template-columns:1fr; }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .spin { animation:spin .8s linear infinite; }
      `}</style>

      <div className="rg-page">
        {/* ── SideRays WebGL background ─────────────────────────── */}
        <div className="rg-rays">
          <SideRays
            speed={1.4} rayColor1={RAY1} rayColor2={RAY2}
            intensity={1.9} spread={2.6} origin="top-left"
            tilt={8} saturation={1.4} blend={0.55} falloff={1.6} opacity={0.85}
          />
        </div>
        <div className="rg-grid" />
        <div className="rg-vignette" />

        {/* ── Center column ─────────────────────────────────────── */}
        <div className={`rg-center ${mounted ? 'rg-visible' : ''}`}>

          {/* Logo */}
          <CinemaTransition href="/" asLink className="rg-logo">
            <ResQLogo size={36} wordmark variant="violet" />
          </CinemaTransition>

          {/* BorderGlow card */}
          <BorderGlow
            animated
            edgeSensitivity={20}
            glowColor={GLOW_COLOR_HSL}
            backgroundColor="#0e0a16"
            borderRadius={22}
            glowRadius={36}
            glowIntensity={1.15}
            coneSpread={22}
            colors={GLOW_COLORS}
            fillOpacity={0.4}
          >
            <div className="rg-inner">
              <div className="rg-eyebrow">Emergency Dispatch System</div>
              <h1 className="rg-heading">Create account</h1>
              <p className="rg-sub">Join ResQ — request help or respond to emergencies.</p>

              {/* Role picker */}
              <div className="rg-roles">
                {ROLES.map(({ value, label, desc, Icon }) => (
                  <button
                    key={value} type="button" className="rg-role"
                    data-active={form.role === value ? 'true' : 'false'}
                    onClick={() => set('role', value)}
                  >
                    <div className="rg-role-top">
                      <div className="rg-role-icon-wrap">
                        <Icon size={13} color="#a78bfa" strokeWidth={2} />
                      </div>
                      <span className="rg-role-label">{label}</span>
                    </div>
                    <div className="rg-role-desc">{desc}</div>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {/* Name + Phone */}
                <div className="rg-row2">
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-name">Full name</label>
                    <input
                      id="rg-name" type="text" className="rg-input"
                      placeholder="Jane Doe" autoComplete="name"
                      value={form.name} onChange={e => set('name', e.target.value)}
                      onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
                      disabled={isLoading}
                    />
                  </div>
                  <div className="rg-field">
                    <label className="rg-label" htmlFor="rg-phone">
                      Phone <span className="rg-optional">optional</span>
                    </label>
                    <input
                      id="rg-phone" type="tel" className="rg-input"
                      placeholder="+91 98765 43210" autoComplete="tel"
                      value={form.phone} onChange={e => set('phone', e.target.value)}
                      onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="rg-field">
                  <label className="rg-label" htmlFor="rg-email">Email address</label>
                  <input
                    id="rg-email" type="email" className="rg-input"
                    placeholder="you@example.com" autoComplete="email"
                    value={form.email} onChange={e => set('email', e.target.value)}
                    onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                    disabled={isLoading}
                  />
                </div>

                {/* Password */}
                <div className="rg-field">
                  <label className="rg-label" htmlFor="rg-password">Password</label>
                  <div className="rg-input-wrap">
                    <input
                      id="rg-password" type={showPassword ? 'text' : 'password'}
                      className="rg-input rg-input-pw"
                      placeholder="Min. 8 characters" autoComplete="new-password"
                      value={form.password} onChange={e => set('password', e.target.value)}
                      onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
                      disabled={isLoading}
                    />
                    <button type="button" className="rg-pw-toggle"
                      onClick={() => setShowPassword(p => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button type="submit" className="rg-btn" disabled={isLoading}>
                  {isLoading
                    ? <><Loader2 size={16} className="spin" /> Creating account…</>
                    : <>Create account <ArrowRight size={15} /></>}
                </button>
              </form>

              <div className="rg-divider">or</div>
              <p className="rg-footer">
                Already have an account?{' '}<CinemaTransition href="/login" asLink style={{color:'rgba(167,139,250,.9)',fontWeight:600,textDecoration:'none'}}>Sign in</CinemaTransition>
              </p>
            </div>
          </BorderGlow>
        </div>
      </div>
    </>
  );
}
