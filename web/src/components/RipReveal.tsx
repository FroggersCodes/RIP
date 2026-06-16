import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Card, type CardData } from './Card';
import { money } from '../lib/format';
import './RipReveal.css';

export interface RevealCard extends CardData {
  isHit: boolean;
}

interface Props {
  cards: RevealCard[];
  title?: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function RipReveal({ cards, title, subtitle, footer, onClose }: Props) {
  const [revealed, setRevealed] = useState(0);
  const [flash, setFlash] = useState(false);
  const [tally, setTally] = useState(0);
  const timers = useRef<number[]>([]);
  const targetRef = useRef(0);

  // Reveal cards one at a time; hits linger and flash the screen.
  useEffect(() => {
    setRevealed(0);
    setTally(0);
    let i = 0;
    const step = () => {
      i += 1;
      setRevealed(i);
      const c = cards[i - 1];
      if (c?.isHit) {
        setFlash(true);
        window.setTimeout(() => setFlash(false), 700);
      }
      if (i < cards.length) {
        const t = window.setTimeout(step, c?.isHit ? 1150 : 600);
        timers.current.push(t);
      }
    };
    const t0 = window.setTimeout(step, 450);
    timers.current.push(t0);
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [cards]);

  // Count the running pack value up smoothly toward the revealed total.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setTally((d) => {
        const diff = targetRef.current - d;
        if (Math.abs(diff) < 0.02) return targetRef.current;
        return d + diff * 0.16;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  targetRef.current = cards.slice(0, revealed).reduce((a, c) => a + c.marketValue, 0);

  const allDone = revealed >= cards.length;
  const revealAll = () => {
    timers.current.forEach(clearTimeout);
    setRevealed(cards.length);
  };

  return (
    <div className="reveal-overlay">
      <div className={`reveal-flash ${flash ? 'on' : ''}`} />
      <div className="reveal-stage">
        <div className="reveal-top">
          <div>
            <div className="reveal-title">{title ?? 'Pack opened'}</div>
            {subtitle && <div className="reveal-sub muted">{subtitle}</div>}
          </div>
          <div className="reveal-tally">
            <span className="muted">Pack value</span>
            <span className="mono tally-num">{money(tally)}</span>
          </div>
        </div>

        <div className={`reveal-grid count-${cards.length}`}>
          {cards.map((c, idx) => (
            <div key={idx} className={`flip ${idx < revealed ? 'is-revealed' : ''} ${c.isHit ? 'is-hit' : ''}`}>
              <div className="flip-card">
                <div className="flip-back">
                  <span className="flip-logo">
                    RIP<span className="gold">.</span>
                  </span>
                </div>
                <div className="flip-front">
                  <Card card={c} size="sm" />
                  {c.isHit && idx < revealed && <div className="hit-badge">HIT</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="reveal-actions">
          {!allDone ? (
            <button className="btn btn-ghost" onClick={revealAll}>
              Reveal all
            </button>
          ) : (
            <>
              {footer}
              <button className="btn btn-gold btn-lg" onClick={onClose}>
                Continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
