'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  LayoutDashboard,
  Truck,
  Activity,
  ClipboardList,
  LogOut,
  Menu,
  X,
  HeartPulse,
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const patientNav: NavItem[] = [
  { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/patient/request',   label: 'New Emergency', icon: AlertTriangle },
];

const driverNav: NavItem[] = [
  { href: '/driver/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/driver/task',      label: 'Active Task', icon: Truck },
];

const adminNav: NavItem[] = [
  { href: '/admin/dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/requests',    label: 'Requests',    icon: ClipboardList },
  { href: '/admin/ambulances',  label: 'Ambulances',  icon: Truck },
  { href: '/admin/assignments', label: 'Assignments', icon: Activity },
];

interface SidebarProps {
  role: 'patient' | 'driver' | 'admin';
  userName: string;
  onLogout?: () => void;
}

const roleInitial = (name: string) => name.charAt(0).toUpperCase();

export default function Sidebar({ role, userName, onLogout }: SidebarProps) {
  const pathname = usePathname();
  // `open` is the ONLY interactive state — it only changes on mobile toggle,
  // so the desktop rail never re-renders on hover (hover is pure CSS now).
  const [open, setOpen] = useState(false);

  const nav = role === 'patient' ? patientNav : role === 'driver' ? driverNav : adminNav;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* ── Mobile toggle ─────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mobile-menu-btn"
        aria-label="Toggle navigation"
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* ── Mobile drawer ─────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="mobile-scrim"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="mobile-drawer"
            >
              <div className="mobile-drawer-head">
                <div className="sidebar-logo">
                  <HeartPulse size={15} color="var(--text-primary)" strokeWidth={2} />
                </div>
                <div>
                  <div className="brand-mark" style={{ fontSize: '1.0625rem' }}>Res<span>Q</span></div>
                  <div className="mobile-drawer-role">{role}</div>
                </div>
              </div>

              <nav className="mobile-nav">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`mobile-nav-link ${active ? 'active' : ''}`}
                    >
                      <Icon size={16} strokeWidth={active ? 2 : 1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="mobile-drawer-foot">
                <div className="mobile-user">
                  <div className="mobile-user-name">{userName}</div>
                  <div className="mobile-user-role">{role}</div>
                </div>
                {onLogout && (
                  <button type="button" onClick={onLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.5rem' }}>
                    <LogOut size={14} />
                    Sign out
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop floating dock (inline — never remounts on hover) ── */}
      <motion.aside
        className="sidebar"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Top cluster */}
        <div className="sidebar-cluster">
          <div className="sidebar-logo" aria-hidden>
            <HeartPulse size={17} color="var(--text-primary)" strokeWidth={2} />
          </div>

          <div className="sidebar-divider" />

          <nav className="sidebar-nav">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <div className="nav-item" key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-icon-chip ${active ? 'active' : ''}`}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                  </Link>
                  <span className="nav-tooltip" role="tooltip">{item.label}</span>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bottom cluster */}
        <div className="sidebar-cluster">
          <div className="sidebar-divider" />

          <div className="sidebar-avatar" aria-label={`${userName} · ${role}`}>
            {roleInitial(userName)}
          </div>

          {onLogout && (
            <div className="nav-item">
              <button
                type="button"
                onClick={onLogout}
                className="nav-icon-chip"
                aria-label="Sign out"
              >
                <LogOut size={16} strokeWidth={1.75} />
              </button>
              <span className="nav-tooltip" role="tooltip">Sign out</span>
            </div>
          )}
        </div>
      </motion.aside>
    </>
  );
}
