import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PARALLEL_MAP, rarityDescForSet, SETS } from '@rip/shared';
import { Card, type CardData } from './Card';
import { GoldStandardOpening } from './GoldStandardOpening';
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
  // Reliquary opens from a sealed gold briefcase that hinges back before the pack
  // ever appears. 'done' means the cinematic has handed off to the sealed pack;
  // every other set skips straight to 'done'.
  const [caseStage, setCaseStage] = useState<'closed' | 'open' | 'top' | 'done'>(
    cards[0]?.setKey === 'reliquary' ? 'closed' : 'done',
  );
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
  // Reliquary is the flawless case: a sealed gold briefcase plays a cinematic
  // open, then hands off to a gold-foil pack that rips like any other.
  const isReliquary = cards[0]?.setKey === 'reliquary';
  // Gold Standard plays its own box-opening cinematic in place of the
  // tap-to-rip pack stage, then hands straight off to the card reveal.
  const isGoldStandard = cards[0]?.setKey === 'gold-standard';
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

  // The briefcase cinematic: break the wax seal, the lid hinges back, the camera
  // tilts top-down as the sealed pack rises out, then a flash hands off to the
  // pack stage where the usual rip takes over.
  const openCase = () => {
    if (caseStage !== 'closed') return;
    setCaseStage('open');
    timers.current.push(window.setTimeout(() => setCaseStage('top'), 1100));
    timers.current.push(window.setTimeout(() => setFlash(true), 2950));
    timers.current.push(
      window.setTimeout(() => {
        setCaseStage('done');
        setFlash(false);
      }, 3350),
    );
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
        isReliquary && caseStage !== 'done' ? (
          <ReliquaryCase stage={caseStage} title={title} subtitle={subtitle} onOpen={openCase} />
        ) : isGoldStandard ? (
          <GoldStandardOpening
            title={title}
            subtitle={subtitle}
            onDone={() => {
              setFlash(true);
              setOpened(true);
              timers.current.push(window.setTimeout(() => setFlash(false), 420));
            }}
          />
        ) : (
        <div className="pack-stage" style={{ ['--glow' as string]: glowColor }}>
          <div className={`pack ${anyRefractor ? 'holo' : ''} ${isReliquary ? 'gold' : ''} ${tearing ? 'tearing' : ''}`} style={tearCss} onClick={rip}>
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
                {packCount > 1 ? 'Open the box' : 'Rip it open'}
              </button>
              {subtitle && <div className="reveal-sub muted" style={{ marginTop: 10 }}>{subtitle}</div>}
            </>
          )}
        </div>
        )
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

/**
 * The Reliquary briefcase cinematic. A sealed gold case floats in; tapping it
 * cracks the wax seal, hinges the lid back, tilts the camera top-down and lifts
 * the sealed pack out toward the viewer before handing off to the pack rip.
 * Stage transforms mirror the three steps driven by RipReveal.openCase().
 */
function ReliquaryCase({
  stage,
  title,
  subtitle,
  onOpen,
}: {
  stage: 'closed' | 'open' | 'top';
  title?: string;
  subtitle?: ReactNode;
  onOpen: () => void;
}) {
  const closed = stage === 'closed';
  const top = stage === 'top';

  const caseXform = top
    ? 'rotateX(-52deg) rotateY(-2deg) translateY(78px) scale(0.9)'
    : 'rotateX(-26deg) rotateY(-30deg)';
  const lidXform = `translateY(-39px) translateZ(-125px) rotateX(${closed ? 0 : 118}deg)`;
  const sealScale = closed ? 1 : 1.7;
  const sealOpacity = closed ? 1 : 0;
  const caseObjOpacity = top ? 0.16 : 1;
  const packRiseXform = top ? 'translateY(-18px) scale(1)' : 'translateY(58px) scale(0.4)';
  const packRiseOpacity = top ? 1 : 0;
  const dustOpacity = closed ? 0 : 1;
  const promptOpacity = closed ? 1 : 0;
  const floatAnim = closed ? 'cbFloat 4.5s ease-in-out infinite' : 'none';
  const glow = closed ? 0.55 : top ? 1 : 0.85;

  const GOLD_FOIL =
    'linear-gradient(135deg,#6e4a14 0%,#e7c878 15%,#fff4cf 27%,#a07d2a 44%,#3a1a08 60%,#e7c878 82%,#7a5418 100%)';

  return (
    <div className="rlq-case-stage">
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 620,
          height: 620,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(199,154,62,.18) 0%, transparent 62%)',
          pointerEvents: 'none',
          opacity: glow,
          transition: 'opacity .6s ease',
        }}
      />

      <div className="rlq-case-head">
        <div className="rlq-kicker">{title ?? 'Reliquary'}</div>
        <div className="rlq-title">Sealed Briefcase</div>
        {subtitle && <div className="reveal-sub muted" style={{ marginTop: 6 }}>{subtitle}</div>}
      </div>

      {/* dust motes drifting up once the seal breaks */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          width: 340,
          height: 240,
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          opacity: dustOpacity,
          transition: 'opacity .5s ease',
        }}
      >
        {[
          { l: '16%', t: '80%', s: 5, d: 2.6, delay: 0 },
          { l: '34%', t: '86%', s: 4, d: 3.1, delay: 0.5 },
          { l: '52%', t: '90%', s: 6, d: 2.3, delay: 0.9 },
          { l: '68%', t: '84%', s: 4, d: 2.9, delay: 0.3 },
          { l: '82%', t: '88%', s: 5, d: 3.4, delay: 1.2 },
        ].map((m, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: m.l,
              top: m.t,
              width: m.s,
              height: m.s,
              borderRadius: '50%',
              background: 'radial-gradient(circle,#fff4cf,#c79a3e)',
              boxShadow: '0 0 6px #e7c878',
              animation: `cbDust ${m.d}s linear infinite ${m.delay}s`,
            }}
          />
        ))}
      </div>

      {/* 3D scene */}
      <div style={{ position: 'relative', width: 560, height: 460, perspective: 1350, perspectiveOrigin: '50% 38%' }}>
        <div
          onClick={onOpen}
          style={{ position: 'absolute', left: '50%', top: '54%', width: 0, height: 0, cursor: closed ? 'pointer' : 'default' }}
        >
          <div style={{ animation: floatAnim, transformStyle: 'preserve-3d', opacity: caseObjOpacity, transition: 'opacity .8s ease' }}>
            <div style={{ position: 'relative', width: 0, height: 0, transformStyle: 'preserve-3d', transform: caseXform, transition: 'transform 1s cubic-bezier(.4,.05,.2,1)' }}>
              {/* velvet floor */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 380, height: 250, transform: 'translate(-50%,-50%) rotateX(90deg) translateZ(39px)', background: 'radial-gradient(130% 120% at 50% 36%, #4a1820 0%, #2a1016 52%, #160a0d 100%)', boxShadow: 'inset 0 0 0 2px rgba(199,154,62,.3), inset 0 0 60px rgba(0,0,0,.7)' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.5, background: 'repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 2px, transparent 2px 5px)' }} />
              </div>
              {/* inner + outer case walls */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 380, height: 78, transform: 'translate(-50%,-50%) translateZ(-125px) rotateY(180deg)', background: 'radial-gradient(130% 150% at 50% 120%, #4a1820, #240e13 70%, #160a0d)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 78, transform: 'translate(-50%,-50%) rotateY(90deg) translateZ(-188px)', background: 'radial-gradient(130% 150% at 50% 120%, #3a1620, #200d12 75%)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 78, transform: 'translate(-50%,-50%) rotateY(-90deg) translateZ(-188px)', background: 'radial-gradient(130% 150% at 50% 120%, #3a1620, #200d12 75%)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 78, transform: 'translate(-50%,-50%) rotateY(-90deg) translateZ(190px)', background: 'linear-gradient(160deg,#120c0f,#070405)', boxShadow: 'inset 0 0 0 1px rgba(199,154,62,.25)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 78, transform: 'translate(-50%,-50%) rotateY(90deg) translateZ(190px)', background: 'linear-gradient(160deg,#1c1217,#0b0709)', boxShadow: 'inset 0 0 0 1px rgba(199,154,62,.35)' }} />
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 380, height: 78, transform: 'translate(-50%,-50%) translateZ(-125px)', background: 'linear-gradient(160deg,#120c0f,#070405)' }} />
              {/* front face: latches + wax seal */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 380, height: 78, transform: 'translate(-50%,-50%) translateZ(125px)', background: 'linear-gradient(150deg,#1a1218 0%,#0d0809 60%,#0a0607 100%)', boxShadow: 'inset 0 0 0 2px rgba(20,8,9,.9), inset 0 0 0 4px rgba(199,154,62,.5), inset 0 0 0 5px rgba(20,8,9,.85), inset 0 0 26px rgba(0,0,0,.7)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.16, background: 'repeating-conic-gradient(from 0deg at 22px 22px, rgba(231,200,120,.4) 0deg 6deg, transparent 6deg 24deg)', backgroundSize: '44px 44px' }} />
                <div style={{ position: 'absolute', top: 13, left: 74, width: 40, height: 30, borderRadius: 5, background: 'linear-gradient(160deg,#fff4cf,#c79a3e 48%,#7a5418)', boxShadow: '0 2px 5px rgba(0,0,0,.5), inset 0 0 0 1px rgba(20,8,9,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 22, height: 7, borderRadius: 2, background: 'linear-gradient(180deg,#2a1206,#0a0604)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.6)' }} />
                </div>
                <div style={{ position: 'absolute', top: 13, right: 74, width: 40, height: 30, borderRadius: 5, background: 'linear-gradient(160deg,#fff4cf,#c79a3e 48%,#7a5418)', boxShadow: '0 2px 5px rgba(0,0,0,.5), inset 0 0 0 1px rgba(20,8,9,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 22, height: 7, borderRadius: 2, background: 'linear-gradient(180deg,#2a1206,#0a0604)', boxShadow: 'inset 0 1px 1px rgba(0,0,0,.6)' }} />
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${sealScale})`, opacity: sealOpacity, transition: 'transform .4s ease, opacity .4s ease', zIndex: 3 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, #e7c878, #b5121f 46%, #7a0c15)', boxShadow: 'inset 0 0 0 3px rgba(255,244,207,.45), 0 4px 12px rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontStyle: 'italic', fontSize: 20, color: '#fff4cf' }}>GL</span>
                  </div>
                </div>
                <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.28em', fontSize: 8, color: '#9a8e7e' }}>2026 · SEALED CASE</div>
              </div>

              {/* lid, hinged at the back edge */}
              <div style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, transform: lidXform, transition: 'transform 1s cubic-bezier(.35,.7,.2,1)', transformStyle: 'preserve-3d' }}>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 380, height: 250, transform: 'translate(-50%,-50%) translateY(-46px) translateZ(125px) rotateX(90deg)', background: 'linear-gradient(150deg,#1a1218 0%,#0d0809 58%,#0b0708 100%)', boxShadow: 'inset 0 0 0 2px rgba(20,8,9,.9), inset 0 0 0 4px rgba(199,154,62,.5), inset 0 0 0 5px rgba(20,8,9,.85)', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.14, background: 'repeating-conic-gradient(from 0deg at 26px 26px, rgba(231,200,120,.4) 0deg 6deg, transparent 6deg 24deg)', backgroundSize: '52px 52px' }} />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, #fff4cf, #c79a3e 52%, #6e4a14)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px rgba(20,8,9,.5), 0 0 0 5px rgba(199,154,62,.5), 0 6px 18px rgba(0,0,0,.5)' }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontStyle: 'italic', fontSize: 26, color: '#2a1206' }}>GL</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '.4em', fontSize: 13, color: '#e7c878' }}>RELIQUARY</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: '.3em', fontSize: 8, color: '#9a8e7e' }}>PREMIUM RELIC CASE</div>
                  </div>
                </div>
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 380, height: 46, transform: 'translate(-50%,-50%) translateZ(250px) translateY(-23px)', background: 'linear-gradient(180deg,#1f151c,#0c0809)', boxShadow: 'inset 0 1px 0 rgba(199,154,62,.5), inset 0 0 0 1px rgba(20,8,9,.8)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 46, transform: 'translate(-50%,-50%) translateX(-190px) translateZ(125px) translateY(-23px) rotateY(-90deg)', background: 'linear-gradient(180deg,#170f15,#090607)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 250, height: 46, transform: 'translate(-50%,-50%) translateX(190px) translateZ(125px) translateY(-23px) rotateY(90deg)', background: 'linear-gradient(180deg,#1f151c,#0b0709)', boxShadow: 'inset 0 1px 0 rgba(199,154,62,.4)' }} />
                <div style={{ position: 'absolute', left: '50%', top: '50%', width: 128, height: 46, transform: 'translate(-50%,-50%) translateY(-46px) translateZ(125px) translateY(-21px)', border: '9px solid', borderImage: 'linear-gradient(160deg,#fff4cf,#c79a3e 50%,#7a5418) 1', borderBottom: 'none', borderRadius: '26px 26px 0 0', background: 'transparent', boxShadow: '0 3px 8px rgba(0,0,0,.5)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* the sealed pack rising out of the open case */}
        <div style={{ position: 'absolute', left: '50%', top: '46%', width: 190, height: 262, transform: `translate(-50%,-50%) ${packRiseXform}`, opacity: packRiseOpacity, transition: 'transform 1.1s cubic-bezier(.25,.7,.2,1), opacity .8s ease', zIndex: 40, pointerEvents: 'none' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 13, background: GOLD_FOIL, backgroundSize: '200% 200%', animation: 'poGold 13s linear infinite', boxShadow: '0 28px 56px -14px rgba(0,0,0,.85), 0 0 40px rgba(199,154,62,.4), inset 0 0 0 1px rgba(255,245,205,.5)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 20, background: 'repeating-linear-gradient(90deg,#3a1a08 0 7px,#6e4a14 7px 14px)', borderRadius: '13px 13px 0 0', boxShadow: 'inset 0 -3px 5px rgba(0,0,0,.4)' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 17, background: 'repeating-linear-gradient(90deg,#3a1a08 0 7px,#6e4a14 7px 14px)', borderRadius: '0 0 13px 13px', boxShadow: 'inset 0 3px 5px rgba(0,0,0,.4)' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: 13, pointerEvents: 'none', background: 'linear-gradient(115deg, transparent 40%, rgba(255,255,255,.55) 48%, transparent 56%)', backgroundSize: '250% 100%', mixBlendMode: 'overlay', animation: 'poSheen 5s linear infinite' }} />
            <div style={{ position: 'absolute', top: 30, left: 16, right: 16, bottom: 28, borderRadius: 7, background: 'radial-gradient(120% 90% at 50% 12%, #3a161a 0%, #1a0c0e 60%, #120809 100%)', boxShadow: 'inset 0 0 0 1.5px rgba(199,154,62,.6), inset 0 0 22px rgba(0,0,0,.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '.4em', fontSize: 9, color: '#e7c878' }}>RELIQUARY</div>
              <div style={{ width: 78, height: 78, borderRadius: '50%', background: 'radial-gradient(circle at 38% 32%, #fff4cf, #c79a3e 52%, #6e4a14 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 3px rgba(20,8,9,.5), 0 0 0 5px rgba(199,154,62,.5), 0 8px 24px rgba(0,0,0,.6)' }}>
                <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontStyle: 'italic', fontSize: 32, color: '#2a1206' }}>GL</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '.24em', fontSize: 8, color: '#cbb389' }}>2026 PREMIUM RELIC</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontStyle: 'italic', fontSize: 15, color: '#f3ead6', marginTop: 2 }}>Four Cards · One Hit</div>
              </div>
            </div>
          </div>
        </div>

        {/* prompt */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: -6, textAlign: 'center', opacity: promptOpacity, transition: 'opacity .4s ease' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
            <div style={{ height: 1, width: 30, background: 'linear-gradient(90deg,transparent,#c79a3e)' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '.26em', fontSize: 11, color: '#c79a3e' }}>TAP THE CASE TO BREAK THE SEAL</div>
            <div style={{ height: 1, width: 30, background: 'linear-gradient(90deg,#c79a3e,transparent)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
