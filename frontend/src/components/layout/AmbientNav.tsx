'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ResQLogo from '@/components/ui/ResQLogo';
import CinemaTransition from '@/components/ui/CinemaTransition';

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_30c6yRkxUog0TZ5432rCR7HN4Pe/hf_20260429_034522_e2f81b2d-d670-4124-97eb-6ab3f1b2f379.mp4';
const POSTER =
  'https://playground.bravebrand.com/assets/backgrounds/polaris-cloud-browser-background.webp';

export const AMBIENT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Cormorant+Garamond:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Instrument+Sans:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  .amb-video-bg {
    position: fixed; inset: 0; width: 100%; height: 100%;
    object-fit: cover; object-position: center 46%;
    z-index: 0; pointer-events: none;
  }
  .amb-overlay {
    position: fixed; inset: 0; z-index: 1; pointer-events: none;
    background:
      linear-gradient(180deg, rgba(3,12,20,.42), rgba(3,12,20,.12) 40%, rgba(3,12,20,.82)),
      radial-gradient(circle at 72% 68%, rgba(156,236,255,.14), transparent 30%);
  }
  .amb-page {
    position: relative; z-index: 10;
    font-family: 'Instrument Sans', system-ui, sans-serif;
    color: #eefaff;
    min-height: 100svh;
  }
  .amb-nav {
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    z-index: 100;
    display: flex; gap: 4px; align-items: center;
    padding: 8px 14px;
    border: 1px solid rgba(238,250,255,.18);
    border-radius: 999px;
    background: rgba(8,22,34,.48);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 12px 50px rgba(0,0,0,.28);
    white-space: nowrap;
  }
  .amb-nav a {
    color: rgba(238,250,255,.65); font-size: 12px;
    text-decoration: none; padding: 7px 12px; border-radius: 999px;
    font-family: 'Instrument Sans', system-ui, sans-serif;
    font-weight: 500; letter-spacing: .01em;
    transition: color .18s ease, background .18s ease;
  }
  .amb-nav a:hover { color: #eefaff; background: rgba(238,250,255,.09); }
  .amb-nav a.active {
    color: #eefaff; background: rgba(238,250,255,.12);
    font-weight: 600;
  }
  .amb-nav a:focus-visible { outline: 2px solid rgba(156,236,255,.5); outline-offset: 2px; }
  .amb-nav-sep {
    width: 1px; height: 14px;
    background: rgba(238,250,255,.16); margin: 0 4px;
  }
  .amb-logo-mark {
    width: 28px; height: 28px; border-radius: 50%;
    background: radial-gradient(circle, #eefaff, #9cecff 45%, rgba(156,236,255,.12));
    box-shadow: 0 0 24px rgba(156,236,255,.55);
    flex-shrink: 0; cursor: pointer;
  }
  /* Glass panels */
  .glass { background: rgba(7,21,34,.7); backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(238,250,255,.1); border-radius: 20px; }
  .glass-sm { background: rgba(7,21,34,.6); backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    border: 1px solid rgba(238,250,255,.1); border-radius: 14px; }
  .glass-card { background: rgba(8,26,42,.65); backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(238,250,255,.1); border-radius: 16px;
    transition: border-color .2s ease, transform .2s ease, box-shadow .2s ease; }
  .glass-card:hover {
    border-color: rgba(156,236,255,.28);
    transform: translateY(-4px);
    box-shadow: 0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(156,236,255,.1); }
  /* CTAs */
  .cta-primary {
    display: inline-flex; align-items: center; gap: 8px;
    color: #071522; background: #eefaff; border: none; border-radius: 999px;
    padding: 13px 22px; font-family: 'Instrument Sans', system-ui, sans-serif;
    font-weight: 700; font-size: 14px; text-decoration: none; letter-spacing: -.01em;
    box-shadow: 0 0 36px rgba(156,236,255,.32); cursor: pointer;
    transition: transform .22s ease, box-shadow .22s ease;
  }
  .cta-primary:hover { transform: translateY(-3px); box-shadow: 0 0 56px rgba(156,236,255,.5); }
  .cta-ghost {
    display: inline-flex; align-items: center; gap: 8px;
    color: rgba(238,250,255,.75); background: rgba(238,250,255,.07);
    border: 1px solid rgba(238,250,255,.2); border-radius: 999px;
    padding: 12px 20px; font-family: 'Instrument Sans', system-ui, sans-serif;
    font-weight: 600; font-size: 13.5px; text-decoration: none; letter-spacing: -.01em;
    transition: transform .22s ease, background .2s ease, color .2s ease; cursor: pointer;
  }
  .cta-ghost:hover { transform: translateY(-3px); background: rgba(238,250,255,.12); color: #eefaff; }
  /* Typography */
  .section-eyebrow {
    font: 500 10px 'IBM Plex Mono', monospace;
    color: rgba(156,236,255,.8); letter-spacing: .18em;
    text-transform: uppercase; margin-bottom: 12px;
  }
  .section-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(36px, 5vw, 64px);
    font-weight: 700; line-height: .92;
    letter-spacing: -.04em; color: #eefaff;
  }
  .section-sub {
    color: rgba(238,250,255,.62); line-height: 1.68; font-size: 15px;
    max-width: 560px;
  }
  /* Cyan accent */
  .cyan { color: #9cecff; }
  .tag-chip {
    display: inline-block; padding: 3px 10px;
    background: rgba(156,236,255,.1); border: 1px solid rgba(156,236,255,.2);
    border-radius: 999px; font: 10px 'IBM Plex Mono', monospace;
    color: rgba(156,236,255,.8); letter-spacing: .1em; text-transform: uppercase;
  }
  /* Page content wrapper */
  .amb-content {
    padding: 110px clamp(20px, 6vw, 80px) 80px;
    max-width: 1200px; margin: 0 auto;
  }
  @media (max-width: 780px) {
    .amb-nav a:not(.amb-nav-signin) { font-size: 11px; padding: 6px 9px; }
    .amb-content { padding: 100px 18px 60px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cta-primary:hover, .cta-ghost:hover, .glass-card:hover { transform: none; }
  }
`;

interface AmbientNavProps {
  active?: 'about' | 'features' | 'working' | 'home';
}

export default function AmbientNav({ active }: AmbientNavProps) {
  return (
    <nav className="amb-nav" aria-label="Main navigation">
      <Link href="/about" className={active === 'about' ? 'active' : ''}>About</Link>
      <div className="amb-nav-sep" aria-hidden="true" />
      <Link href="/working" className={active === 'working' ? 'active' : ''}>Working</Link>
      <div className="amb-nav-sep" aria-hidden="true" />
      <Link href="/" aria-label="ResQ home">
        <ResQLogo size={28} wordmark={false} variant="cyan" />
      </Link>
      <div className="amb-nav-sep" aria-hidden="true" />
      <Link href="/features" className={active === 'features' ? 'active' : ''}>Features</Link>
      <div className="amb-nav-sep" aria-hidden="true" />
      <CinemaTransition href="/login" asLink className="amb-nav-signin">Sign In</CinemaTransition>
    </nav>
  );
}

export function AmbientVideoBg() {
  return (
    <>
      <video
        className="amb-video-bg"
        autoPlay loop muted playsInline preload="auto"
        poster={POSTER}
        // @ts-ignore
        disableRemotePlayback
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="amb-overlay" aria-hidden="true" />
    </>
  );
}
