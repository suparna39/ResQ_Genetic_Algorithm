'use client';

import { Bell, Search, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface TopbarProps {
  title: string;
  subtitle?: string;
  /** Optional — enables the profile capsule. Admin pages omit it gracefully. */
  userName?: string;
  role?: string;
  /** Live connection indicator. Defaults to true (online). */
  live?: boolean;
}

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || 'U';

export default function Topbar({ title, subtitle, userName, role, live = true }: TopbarProps) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // Scroll awareness — drives the premium dissolve + bar condensation.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <div className={`topbar ${scrolled ? 'is-scrolled' : ''}`}>
        {/* ── Brand + title block ───────────────────────────── */}
        <motion.div
          className="topbar-brand"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="brand-mark">
            Res<span>Q</span>
          </div>
          <div className="topbar-sep" />
          <div className="topbar-titles">
            <h1 className="topbar-title">{title}</h1>
            {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
          </div>
        </motion.div>

        {/* ── Search (visual) ───────────────────────────────── */}
        <motion.div
          className="topbar-search-wrap"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08, duration: 0.3 }}
        >
          <label className="topbar-search">
            <Search size={15} strokeWidth={1.75} className="topbar-search-icon" />
            <input type="text" placeholder="Search requests, units, status…" aria-label="Search" />
          </label>
        </motion.div>

        {/* ── Right cluster ─────────────────────────────────── */}
        <motion.div
          className="topbar-actions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12, duration: 0.3 }}
        >
          {/* Live indicator */}
          <div className="topbar-live">
            <span className={`topbar-live-dot ${live ? 'on' : 'off'}`} />
            {live ? 'LIVE' : 'OFFLINE'}
            <span className="topbar-live-time">· {timeStr}</span>
          </div>

          {/* Bell */}
          <button type="button" className="icon-orb" aria-label="Notifications">
            <Bell size={15} strokeWidth={1.75} />
            <span className="notif-dot" />
          </button>

          {/* Profile capsule */}
          {userName && (
            <button type="button" className="profile-capsule" title={`${userName}${role ? ` · ${role}` : ''}`}>
              <div className="profile-avatar">{initials(userName)}</div>
              <div className="profile-meta">
                <div className="profile-name">{userName}</div>
                {role && <div className="profile-role">{role}</div>}
              </div>
              <ChevronDown size={13} strokeWidth={2} className="profile-chevron" />
            </button>
          )}
        </motion.div>
      </div>

      {/* Premium scroll dissolve — content softly fades into the background
          as it scrolls up beneath the header. Pure overlay, never blocks input. */}
      <div className={`scroll-fade ${scrolled ? 'visible' : ''}`} aria-hidden />
    </>
  );
}
