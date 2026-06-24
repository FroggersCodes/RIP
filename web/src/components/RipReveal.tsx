import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PARALLEL_MAP, rarityDescForSet, SETS } from '@rip/shared';
import { Card, type CardData } from './Card';
import { money } from '../lib/format';
import './RipReveal.css';

export interface RevealCard extends CardData {
  isHit: boolean;
}

interface Props {
  cards: RevealCard[];
  /** Cards per pack — for boxes this drives the pack-by-pack flow. Defaults to one pack. */
  packSize?: number;
  title?: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

export function RipReveal({ cards, packSize, title, subtitle, footer, onClose }: Props) {
  const size = packSize && packSize > 0 ? packSize : cards.length || 1;
  const packCount = Math.max(1, Math.ceil(cards.length / size));

  const [opened, setOpened] = useState(false);
  const [tearing, setTearing] = useState(false);
  const [shown, setShown] = useState(0); // index of the card on top of the stack
  const [finished, setFinished] = useState(false);
  const [betweenPacks, setBetweenPacks] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flash, setFlash] = useState(false);
  const [tally, setTally] = useState(0);
  const startRef = useRef<{ x: number; moved: boolean } | null>(null);
  const dragXRef = useRef(0);
  const targetRef = useRef(0);
  const timers = useRef<number[]>([]);

  // The sealed pack glows in the color of the best card inside (rainbow for a refractor).
  const order = rarityDescForSet(cards[0]?.setKey);
  let bestIdx = order.length;
  let anyRefractor = false;
  for (const c of cards) {
    const i = order.indexOf(c.parallel);
    if (i >= 0 && i < bestIdx) bestIdx = i;
    if (c.refractor) anyRefractor = true;
  }
  const glowColor = PARALLEL_MAP[order[bestIdx] ?? 'BASE']?.color ?? '#8b94a3';

  // Tier-based animation speed: Spark (1) = snappy, Reliquary (5) = dramatic and slow.
  const TIER_MULT: Record<number, number> = { 1: 0.45, 2: 0.75, 3: 1.0, 4: 1.5, 5: 2.2 };
  const tierLevel = SETS[cards[0]?.setKey ?? '']?.tierLevel ?? 1;
  // Reliquary opens like a flawless case: a hinged gold lid swings open instead of a torn pack.
  const isCase = cards[0]?.setKey === 'reliquary';
  const tearMult = TIER_MULT[tierLevel] ?? 1.0;
  const tearCss = {
    '--shake-dur':  `${(0.32 * tearMult).toFixed(2)}s`,
    '--tear-dur':   `${(0.7  * tearMult).toFixed(2)}s`,
    '--tear-delay': `${(0.3  * tearMult).toFixed(2)}s`,
    '--burst-dur':  `${(0.55 * tearMult).toFixed(2)}s`,
    '--burst-delay':`${(0.4  * tearMult).toFixed(2)}s`,
  } as React.CSSProperties;

  const rip = () => {
    if (tearing || opened) return;
    setTearing(true);
    timers.current.push(window.setTimeout(() => setOpened(true), Math.round(950 * tearMult)));
  };

  // Flash the screen when the card now on top is a rare hit.
  useEffect(() => {
    if (!opened || finished) return;
    if (cards[shown]?.isHit) {
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 700);
      return () => clearTimeout(t);
    }
  }, [opened, shown, finished, cards]);

  // Ease the running pack value up toward the revealed total.
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
  const tallyCount = finished ? cards.length : Math.min(shown + 1, cards.length);
  targetRef.current = cards.slice(0, tallyCount).reduce((a, c) => a + c.marketValue, 0);

  const advance = () => {
    if (betweenPacks) return;
    if (shown >= cards.length - 1) {
      setFinished(true);
      return;
    }
    const lastOfPack = shown % size === size - 1;
    if (lastOfPack && packCount > 1) {
      setBetweenPacks(true);
      return;
    }
    setShown((s) => s + 1);
  };
  const continuePack = () => {
    setBetweenPacks(false);
    setShown((s) => s + 1);
  };
  const revealAll = () => {
    setBetweenPacks(false);
    setFinished(true);
  };

  const flyAndAdvance = (dir: number) => {
    dragXRef.current = dir * 700;
    setDragX(dir * 700);
    timers.current.push(
      window.setTimeout(() => {
        setDragX(0);
        dragXRef.current = 0;
        advance();
      }, 230),
    );
  };

  // Drag-to-swipe on the top card.
  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => {
      if (!startRef.current) return;
      const dx = e.clientX - startRef.current.x;
      if (Math.abs(dx) > 6) startRef.current.moved = true;
      dragXRef.current = dx;
      setDragX(dx);
    };
    const up = () => {
      setDragging(false);
      const moved = startRef.current?.moved;
      const dx = dragXRef.current;
      startRef.current = null;
      if (Math.abs(dx) > 90) flyAndAdvance(dx > 0 ? 1 : -1);
      else if (!moved) flyAndAdvance(1); // a tap counts as a swipe
      else {
        setDragX(0);
        dragXRef.current = 0;
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const onDown = (e: ReactPointerEvent) => {
    if (finished || betweenPacks) return;
    startRef.current = { x: e.clientX, moved: false };
    setDragging(true);
  };

  const currentPack = Math.floor(shown / size) + 1;
  const posInPack = shown % size;

  return (
    <div className="reveal-overlay">
      <div className={`reveal-flash ${flash ? 'on' : ''}`} />

      {!opened ? (
        <div className="pack-stage" style={{ ['--glow' as string]: glowColor }}>
          <div className={`pack ${anyRefractor ? 'holo' : ''} ${isCase ? 'case' : ''} ${tearing ? 'tearing' : ''}`} style={tearCss} onClick={rip}>
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
                {isCase ? 'Unlatch the case' : packCount > 1 ? 'Open the box' : 'Rip it open'}
              </button>
              {subtitle && <div className="reveal-sub muted" style={{ marginTop: 10 }}>{subtitle}</div>}
            </>
          )}
        </div>
      ) : finished ? (
        <div className="reveal-stage">
          <div className="reveal-top">
            <div>
              <div className="reveal-title">{title ?? 'Opened'}</div>
              <div className="reveal-sub muted">{cards.length} cards{packCount > 1 ? ` · ${packCount} packs` : ''}</div>
            </div>
            <div className="reveal-tally">
              <span className="muted">Total value</span>
              <span className="mono tally-num">{money(tally)}</span>
            </div>
          </div>
          <div className={`reveal-grid count-${cards.length} ${cards.length > 6 ? 'box' : ''}`}>
            {cards.map((c, idx) => (
              <div className={`flip is-revealed ${c.isHit ? 'is-hit' : ''}`} key={idx}>
                <div className="flip-card">
                  <div className="flip-back" />
                  <div className="flip-front">
                    <Card card={c} size="sm" />
                    {c.isHit && <div className="hit-badge">HIT</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="reveal-actions">
            {footer}
            <button className="btn btn-gold btn-lg" onClick={onClose}>
              Continue
            </button>
          </div>
        </div>
      ) : (
        <div className="swipe-stage">
          <div className="swipe-top">
            <div className="swipe-counter">
              {packCount > 1 && <span className="pack-pill">Pack {currentPack}/{packCount}</span>}
              <span className="muted mono">
                card {posInPack + 1}/{size}
              </span>
            </div>
            <div className="reveal-tally">
              <span className="muted">Value</span>
              <span className="mono tally-num">{money(tally)}</span>
            </div>
          </div>

          {betweenPacks ? (
            <div className="pack-gate">
              <div className="pack-gate-title">Pack {currentPack} done</div>
              <button className="btn btn-gold btn-lg" onClick={continuePack}>
                Open pack {currentPack + 1} of {packCount}
              </button>
            </div>
          ) : (
            <div className="stack">
              {[2, 1].map((d) => {
                const c = cards[shown + d];
                if (!c || posInPack + d >= size) return null;
                return (
                  <div
                    className="stack-card stack-behind"
                    key={`b${d}`}
                    style={{ transform: `translateY(${d * 12}px) scale(${1 - d * 0.05})`, zIndex: 3 - d }}
                  >
                    <div className="stack-back">
                      <span className="flip-logo">RIP<span className="gold">.</span></span>
                    </div>
                  </div>
                );
              })}
              <div
                className={`stack-card stack-top ${dragging ? 'dragging' : ''}`}
                style={{ transform: `translateX(${dragX}px) rotate(${dragX * 0.05}deg)`, transition: dragging ? 'none' : 'transform 0.23s ease' }}
                onPointerDown={onDown}
              >
                <div className="stack-pop" key={shown}>
                  <Card card={cards[shown]!} size="md" />
                  {cards[shown]?.isHit && <div className="hit-badge">HIT</div>}
                </div>
              </div>
            </div>
          )}

          {!betweenPacks && (
            <div className="swipe-hint muted">swipe or tap the card →</div>
          )}
          <div className="reveal-actions">
            <button className="btn btn-ghost" onClick={revealAll}>
              Reveal all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
