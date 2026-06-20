'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import AmbientNav, { AmbientVideoBg, AMBIENT_STYLES } from '@/components/layout/AmbientNav';
import CinemaTransition from '@/components/ui/CinemaTransition';

export default function LandingPage() {
  return (
    <>
      <style>{AMBIENT_STYLES}</style>
      <style>{`
        .hero-wrap {
          position: relative; z-index: 10;
          min-height: 100svh;
          padding: 24px clamp(20px, 4vw, 58px);
          display: flex; flex-direction: column;
          font-family: 'Instrument Sans', system-ui, sans-serif;
          color: #eefaff; overflow: hidden;
        }
        .hero-bottom {
          margin-top: auto;
          display: grid; grid-template-columns: 1.1fr .9fr;
          gap: 64px; align-items: end;
          padding-bottom: clamp(36px, 7vh, 82px);
        }
        .hero-brand {
          font-family: 'Archivo', system-ui, sans-serif;
          font-size: clamp(72px, 11.5vw, 168px);
          letter-spacing: -.08em; line-height: .78; font-weight: 800; color: #eefaff;
        }
        .hero-tag {
          font-family: 'Cormorant Garamond', serif;
          font-size: clamp(20px, 2.2vw, 34px);
          color: rgba(238,250,255,.76); margin-top: 20px;
          line-height: 1.2; font-weight: 500; letter-spacing: -.01em;
        }
        .hero-right {
          border-top: 1px solid rgba(238,250,255,.26); padding-top: 24px;
          max-width: 540px; justify-self: end;
        }
        .hero-right p { color: rgba(238,250,255,.68); line-height: 1.68; font-size: 15px; margin: 0 0 26px; }
        .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .hero-foot {
          position: relative; z-index: 10;
          display: flex; justify-content: space-between; align-items: center;
          font: 500 10px 'IBM Plex Mono', monospace;
          color: rgba(238,250,255,.4); letter-spacing: .08em; padding-bottom: 10px;
          text-transform: uppercase; margin-top: 16px;
        }
        @media (max-width: 780px) {
          .hero-bottom { grid-template-columns: 1fr; gap: 28px; padding-top: 28vh; }
          .hero-right { justify-self: start; max-width: 100%; }
          .hero-foot { display: none; }
        }
      `}</style>

      <AmbientVideoBg />
      <AmbientNav active="home" />

      <main className="hero-wrap">
        <div className="hero-bottom">
          <div>
            <div className="hero-brand">ResQ</div>
            <div className="hero-tag">
              The fastest route<br />to every emergency.
            </div>
          </div>

          <div className="hero-right">
            <p>
              AI-powered emergency dispatch combining Machine Learning urgency
              prediction with Genetic Algorithm optimization — connecting patients
              to the right ambulance in seconds, not minutes.
            </p>
            <div className="hero-actions">
              <CinemaTransition href="/register?role=patient" asLink className="cta-primary">
                Request Emergency
                <ArrowRight size={15} strokeWidth={2.5} />
              </CinemaTransition>
              <CinemaTransition href="/register?role=driver" asLink className="cta-ghost">
                Driver Portal
              </CinemaTransition>
            </div>
          </div>
        </div>

        <div className="hero-foot" aria-hidden="true">
          <span>AI · ML · Genetic Algorithm · Real-Time GPS</span>
          <span>ResQ — Emergency Dispatch System</span>
        </div>
      </main>
    </>
  );
}
