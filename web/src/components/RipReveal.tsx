import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PARALLEL_MAP, PARALLELS_BY_RARITY_DESC } from '@rip/shared';
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
  const [opened, setOpened] = useState(false);
  const [tearing, setTearing] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [flash, setFlash] = useState(false);
  const [tally, setTally] = useState(0);
  const timers = useRef<number[]>([]);
  const targetRef = useRef(0);

  // The pack glows in the color of the best card inside — rainbow for a refractor.
  const order = PARALLELS_BY_RARITY_DESC;
  let bestIdx = order.length;
  let anyRefractor = false;
  for (const c of cards) {
    const i = order.indexOf(c.parallel);
    if (i >= 0 && i < bestIdx) bestIdx = i;
    if (c.refractor) anyRefractor = true;
  }
  const bestParallel = order[bestIdx] ?? 'BASE';
  const glowColor = PARALLEL_MAP[bestParallel]?.color ?? '#8b94a3';

  const rip = () => {
    if (tearing || opened) return;
    setTearing(true);
    timers.current.push(window.setTimeout(() => setOpened(true), 950));
  };

  // Reveal the cards one at a time once the pack is torn open.
  useEffect(() => {
    if (!opened) return;
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
      if (i < cards.length) timers.current.push(window.setTimeout(step, c?.isHit ? 1150 : 600));
    };
    timers.current.push(window.setTimeout(step, 350));
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [opened, cards]);

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

      {!opened ? (
        <div className="pack-stage" style={{ ['--glow' as string]: glowColor }}>
          <div className={`pack ${anyRefractor ? 'holo' : ''} ${tearing ? 'tearing' : ''}`} onClick={rip}>
            <div className="pack-half pack-top">
              <div className="pack-art">
                <span className="pack-logo">RIP<span className="gold">.</span></span>
                <span className="pack-name">{title ?? 'Pack'}</span>
              </div>
            </div>
            <div className="pack-half pack-bottom">
              <div className="pack-art">
                <span className="pack-logo">RIP<span className="gold">.</span></span>
                <span className="pack-name">{title ?? 'Pack'}</span>
              </div>
            </div>
            <div className="pack-burst" />
          </div>
          {!tearing && (
            <>
              <button className="btn btn-gold btn-lg" onClick={rip} style={{ marginTop: 28 }}>
                Rip it open
              </button>
              {subtitle && <div className="reveal-sub muted" style={{ marginTop: 10 }}>{subtitle}</div>}
            </>
          )}
        </div>
      ) : (
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
                    <span className="flip-logo">RIP<span className="gold">.</span></span>
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
      )}
    </div>
  );
}
