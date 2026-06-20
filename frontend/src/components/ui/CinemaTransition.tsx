'use client';

/**
 * CinemaTransition
 * ─────────────────
 * Wraps any clickable child. On click it:
 * 1. Slides two letterbox bars in from top + bottom (100ms)
 * 2. Briefly holds (200ms) — gives a "film crop" feel
 * 3. Navigates via router.push
 * 4. On the new page the bars slide back out + page entry animation plays
 *
 * Usage:
 *   <CinemaTransition href="/login">
 *     <button>Sign in</button>
 *   </CinemaTransition>
 *
 * Or without a wrapping element (renders an <a>):
 *   <CinemaTransition href="/register" className="cta-primary">
 *     Register
 *   </CinemaTransition>
 */

import { useRouter } from 'next/navigation';
import { useCallback, type ReactNode, type MouseEvent } from 'react';

interface CinemaTransitionProps {
  href: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** render as a plain <a> instead of wrapping children */
  asLink?: boolean;
}

// Inject the overlay CSS once — safe to call multiple times
let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    /* ── Cinema letterbox overlay ───────────────────────────── */
    #_ct-overlay {
      position: fixed; inset: 0; z-index: 99999;
      pointer-events: none;
      display: flex; flex-direction: column;
      justify-content: space-between;
    }
    #_ct-overlay .ct-bar {
      background: #08060e;
      height: 0;
      transition: height 0s;
      will-change: height;
    }
    /* Active — bars slide in */
    #_ct-overlay.ct-in .ct-bar {
      height: 22vh;
      transition: height 0.38s cubic-bezier(0.76, 0, 0.24, 1);
    }
    /* Out — bars slide away */
    #_ct-overlay.ct-out .ct-bar {
      height: 0;
      transition: height 0.42s cubic-bezier(0.76, 0, 0.24, 1);
    }
    /* Page zoom-in during letterbox */
    body.ct-zooming > *:not(#_ct-overlay) {
      transform: scale(1.035);
      transition: transform 0.52s cubic-bezier(0.76, 0, 0.24, 1);
      transform-origin: center center;
    }
  `;
  document.head.appendChild(s);
}

function getOrCreateOverlay(): HTMLElement {
  let el = document.getElementById('_ct-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = '_ct-overlay';
    el.innerHTML = '<div class="ct-bar"></div><div class="ct-bar"></div>';
    document.body.appendChild(el);
  }
  return el;
}

export function useCinemaTransition() {
  const router = useRouter();

  return useCallback((href: string) => {
    injectCSS();
    const overlay = getOrCreateOverlay();

    // Bars slide IN + page zooms
    overlay.className = 'ct-in';
    document.body.classList.add('ct-zooming');

    setTimeout(() => {
      router.push(href);

      // After navigation starts, slide bars OUT
      setTimeout(() => {
        overlay.className = 'ct-out';
        document.body.classList.remove('ct-zooming');
        setTimeout(() => { overlay.className = ''; }, 450);
      }, 160);
    }, 340);
  }, [router]);
}

export default function CinemaTransition({
  href, children, className = '', style, asLink,
}: CinemaTransitionProps) {
  const navigate = useCinemaTransition();

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    navigate(href);
  }, [navigate, href]);

  if (asLink) {
    return (
      <a href={href} onClick={handleClick} className={className} style={style}>
        {children}
      </a>
    );
  }

  return (
    <span
      onClick={handleClick}
      className={className}
      style={{ cursor: 'pointer', display: 'contents', ...style }}
    >
      {children}
    </span>
  );
}
