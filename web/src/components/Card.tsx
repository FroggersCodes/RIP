import { useState } from 'react';
import { PARALLEL_MAP, setOf, type ParallelName, type Position } from '@rip/shared';
import { money } from '../lib/format';
import { signaturePath } from '../lib/signature';
import { PlayerPortrait } from './PlayerPortrait';
import './Card.css';

export interface CardData {
  player: {
    id: string;
    name: string;
    position: Position;
    teamAbbr: string;
    overallRating?: number;
    teamPrimaryColor?: string;
    teamSecondaryColor?: string;
    isRookie?: boolean;
  };
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  marketValue: number;
  refractor: boolean;
  setKey?: string;
}

interface Props {
  card: CardData;
  size?: 'sm' | 'md' | 'lg';
  faded?: boolean;
  onClick?: () => void;
}

function PatchSwatch({ primary, secondary }: { primary: string; secondary: string }) {
  return (
    <svg className="card-patch-swatch" viewBox="0 0 88 56" xmlns="http://www.w3.org/2000/svg">
      <rect width="88" height="56" fill={primary} />
      <rect y="14" width="88" height="11" fill={secondary} opacity="0.85" />
      <rect y="31" width="88" height="11" fill={secondary} opacity="0.85" />
      {[5, 12, 19, 26, 33, 40, 47, 54].map((y) => (
        <line key={y} x1="0" y1={y} x2="88" y2={y} stroke="rgba(255,255,255,0.1)" strokeWidth="0.7" strokeDasharray="3,3" />
      ))}
      <line x1="0" y1="14" x2="88" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4,2" />
      <line x1="0" y1="25" x2="88" y2="25" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4,2" />
      <line x1="0" y1="31" x2="88" y2="31" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4,2" />
      <line x1="0" y1="42" x2="88" y2="42" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="4,2" />
    </svg>
  );
}

/**
 * Reliquary gold-foil frame — ported 1:1 from the approved reference design (a
 * white card with a gold line-art frame): a double rounded border, a segmented
 * fan in each top corner, a swag curve linking them, inward-bowing side rails and
 * a curved white nameplate at the foot. Drawn in the reference's own 360×504
 * coordinate space (5:7), stretched to fill the card without distortion.
 */
function ReliquaryFrame({ idBase }: { idBase: string }) {
  const gid = `rlq-gold-${idBase}`;
  return (
    <svg className="reliquary-frame" viewBox="0 0 360 504" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5e18" />
          <stop offset=".18" stopColor="#d9b349" />
          <stop offset=".34" stopColor="#fff4c4" />
          <stop offset=".5" stopColor="#c79f34" />
          <stop offset=".68" stopColor="#f0d27e" />
          <stop offset=".85" stopColor="#a8852a" />
          <stop offset="1" stopColor="#7a5e18" />
        </linearGradient>
      </defs>
      {/* white nameplate fill */}
      <path d="M12 432 Q180 400 348 432 L348 480 Q348 487 341 487 L19 487 Q12 487 12 480 Z" fill="#fffdf6" />
      <g fill="none" stroke={`url(#${gid})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="342" height="486" rx="9" />
        <rect x="17" y="17" width="326" height="470" rx="6" strokeWidth="1.1" opacity="0.5" />
        {/* top-left corner fan */}
        <path d="M 104 14 A 90 90 0 0 1 14 104" />
        <path d="M 72 14 A 58 58 0 0 1 14 72" />
        <line x1="72" y1="14" x2="104" y2="14" />
        <line x1="70.02" y1="29.01" x2="100.93" y2="37.29" />
        <line x1="64.23" y1="43" x2="91.94" y2="59" />
        <line x1="55.01" y1="55.01" x2="77.64" y2="77.64" />
        <line x1="43" y1="64.23" x2="59" y2="91.94" />
        <line x1="29.01" y1="70.02" x2="37.29" y2="100.93" />
        <line x1="14" y1="72" x2="14" y2="104" />
        {/* top-right corner fan */}
        <path d="M 346 104 A 90 90 0 0 1 256 14" />
        <path d="M 346 72 A 58 58 0 0 1 288 14" />
        <line x1="346" y1="72" x2="346" y2="104" />
        <line x1="330.99" y1="70.02" x2="322.71" y2="100.93" />
        <line x1="317" y1="64.23" x2="301" y2="91.94" />
        <line x1="304.99" y1="55.01" x2="282.36" y2="77.64" />
        <line x1="295.77" y1="43" x2="268.06" y2="59" />
        <line x1="289.98" y1="29.01" x2="259.07" y2="37.29" />
        <line x1="288" y1="14" x2="256" y2="14" />
        {/* swag + side rails + nameplate top */}
        <path d="M80 75 Q180 141 280 75" />
        <path d="M14 104 C 14 196, 60 250, 24 426" />
        <path d="M346 104 C 346 196, 300 250, 336 426" />
        <path d="M12 432 Q180 400 348 432" />
      </g>
    </svg>
  );
}

/** A gold-framed game-worn relic window: a colored swatch with woven texture, a
 *  dashed inset border and (optionally) a dashed centre seam. */
function RlqWindow({ color, seam, className }: { color: string; seam?: boolean; className: string }) {
  return (
    <div className={`rlq-win ${className}`}>
      <div className="rlq-swatch" style={{ backgroundColor: color }}>
        <div className="rlq-swatch-dash" />
        {seam && <div className="rlq-swatch-seam" />}
      </div>
    </div>
  );
}

export function Card({ card, size = 'md', faded, onClick }: Props) {
  const [flipped, setFlipped] = useState(false);

  const def = PARALLEL_MAP[card.parallel];
  const isRpa = !!def.rpa;
  // Each parallel's `finish` maps to a frame treatment; RPA owns its own layout,
  // and a refractor frame trumps the plain finish.
  const FINISH_TIER: Record<string, string> = {
    plain: 'tier-plain',
    gold: 'tier-gold',
    autogold: 'tier-auto',
    patch: 'tier-patch',
    ice: 'finish-ice',
    white: 'finish-white',
    black: 'finish-black',
    ofl: 'finish-ofl',
    'canvas-kings': 'finish-canvas-kings',
  };
  const isCanvasKings = def.finish === 'canvas-kings';
  const tier = isRpa
    ? 'tier-rpa'
    : isCanvasKings
      ? 'finish-canvas-kings'
      : card.refractor
        ? 'refractor'
        : FINISH_TIER[def.finish ?? 'plain'] ?? 'tier-plain';

  const set = setOf(card.setKey);
  const isArtistry = set.key === 'artistry';
  const isReliquary = set.key === 'reliquary';
  const shortName = def.displayName
    .replace(/\s*1\/1.*$/, '')
    .replace(/\s*\/\d.*$/, '')
    .replace(/\s*Finite$/, '')
    .trim();
  const isDarkPill = def.finish === 'black';
  const isOfl = def.finish === 'ofl';
  const hasSig = !!def.signed;
  const sig = hasSig ? signaturePath(card.player.id) : null;
  const teamPrimary = card.player.teamPrimaryColor ?? '#1a2a4a';
  const teamSecondary = card.player.teamSecondaryColor ?? '#0c1422';
  const hasPatch = !!def.patched;
  const ckGradId = `ck-rb-${card.player.id}`;
  // Reliquary maps each parallel onto one of the reference layouts:
  // RPA → relic (photo + 1 patch + sig), patch → dual (2 patches), auto → sig.
  const rlqVariant = isRpa ? 'relic' : hasPatch ? 'dual' : hasSig ? 'auto' : 'base';
  const rlqShowSig = rlqVariant === 'auto' || rlqVariant === 'relic';

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setFlipped((f) => !f);
    }
  };

  const sigSvg = sig ? (
    <svg
      className="card-sig-svg"
      viewBox={`0 0 ${sig.width} 100`}
      preserveAspectRatio="xMidYMid meet"
      style={{ transform: `rotate(${sig.slant}deg)` }}
    >
      <path
        d={sig.d}
        fill="none"
        stroke={sig.ink}
        strokeWidth={sig.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : null;

  const cssVars = {
    ['--accent' as string]: def.color,
    ['--team-primary' as string]: teamPrimary,
    ['--team-secondary' as string]: teamSecondary,
  };

  return (
    <div
      className={`card card-${size} ${tier} set-${set.key} ${faded ? 'faded' : ''} ${flipped ? 'is-flipped' : ''} ${onClick ? 'clickable' : ''}`}
      style={cssVars}
    >
      <div className="card-flip-inner" onClick={handleClick}>

        {/* ── FRONT ── clean: photo + name + position + serial + hit type badges */}
        <div className="card-face card-face-front">
          <div className="card-frame">
            {isReliquary ? (
              /* Reliquary — white card with a gold foil line-art frame (1:1 with
                 the approved reference). Base/Auto/Dual share a wide photo; Relic
                 (RPA) uses a narrow photo beside a single patch window. */
              <div className="card-inner rlq-inner">
                {/* gold sunburst + glow behind the cut-out player */}
                <div className="rlq-detail" aria-hidden="true" />
                <div className={`rlq-photo ${rlqVariant === 'relic' ? 'rlq-photo-relic' : ''}`}>
                  <PlayerPortrait player={card.player} fill />
                </div>

                {rlqVariant === 'relic' && (
                  <RlqWindow color={teamPrimary} seam className="rlq-win-relic" />
                )}
                {rlqVariant === 'dual' && (
                  <>
                    <RlqWindow color={teamPrimary} className="rlq-win-dual-a" />
                    <RlqWindow color={teamSecondary} className="rlq-win-dual-b" />
                  </>
                )}
                {rlqShowSig && (
                  <div className="rlq-sig">{card.player.name}</div>
                )}

                <ReliquaryFrame idBase={card.player.id} />

                <div className="rlq-wordmark">Reliquary</div>
                <div className="rlq-name">{card.player.name}</div>
                <div className="rlq-team">{card.player.teamAbbr}</div>
              </div>
            ) : isCanvasKings ? (
              /* Canvas Kings — marquee case-hit insert: graph-paper canvas, the
                 player set into a dashed cut-out window, a rainbow paint swash, and
                 a black plate with the gold-foil wordmark. */
              <div className="card-inner ck-inner">
                <div className="ck-bg" />
                <div className="ck-top">Artistry 2026 · Case Hit</div>
                <div className="ck-window">
                  <PlayerPortrait player={card.player} fill />
                </div>
                <svg className="ck-swash" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id={ckGradId} x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7b2ff7" />
                      <stop offset="18%" stopColor="#2f6df7" />
                      <stop offset="36%" stopColor="#23c1c9" />
                      <stop offset="52%" stopColor="#3fbf54" />
                      <stop offset="68%" stopColor="#f2c41d" />
                      <stop offset="84%" stopColor="#f2811d" />
                      <stop offset="100%" stopColor="#e23b3b" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M-10 150 C 80 90, 150 200, 230 120 S 360 70, 420 110"
                    fill="none"
                    stroke={`url(#${ckGradId})`}
                    strokeWidth="46"
                    strokeLinecap="round"
                    opacity="0.92"
                  />
                  <path
                    d="M-10 150 C 80 90, 150 200, 230 120 S 360 70, 420 110"
                    fill="none"
                    stroke={`url(#${ckGradId})`}
                    strokeWidth="13"
                    strokeLinecap="round"
                    opacity="0.6"
                    transform="translate(0,-24)"
                  />
                </svg>
                <div className="ck-plate">
                  <div className="ck-wordmark">Canvas Kings</div>
                  <div className="ck-player">
                    <span className="ck-name">{card.player.name}</span>
                    <span className="ck-pos">{card.player.position} · {card.player.teamAbbr}</span>
                  </div>
                </div>
                <div className="sheen" />
              </div>
            ) : (
            <div className="card-inner">
              <div className="card-set-bg" />
              <div className="card-photo">
                <PlayerPortrait player={card.player} fill />
              </div>
              {isArtistry && <div className="card-art-halftone" />}
              {isArtistry && <div className="card-art-wave" />}
              <div className="card-photo-scrim" />
              <div className="card-set-fx" />
              <div className="sheen" />
              {isOfl && (
                <div className="card-ofl-emblem">
                  <img src="/ofl-logo.jpeg" alt="OFL" />
                </div>
              )}
              {hasPatch && !isRpa && (
                <div className="card-patch">
                  <div className="card-patch-window">
                    <PatchSwatch primary={teamPrimary} secondary={teamSecondary} />
                  </div>
                  <span className="patch-badge">PATCH</span>
                </div>
              )}

              {sig && !isRpa && (
                <div className="card-sig">
                  {sigSvg}
                  <span className="auto-badge">✒ AUTO</span>
                </div>
              )}

              {isRpa && sig && (
                <>
                  <div className="card-rpa-patch">
                    <div className="card-patch-window">
                      <PatchSwatch primary={teamPrimary} secondary={teamSecondary} />
                    </div>
                    <span className="patch-badge">PATCH</span>
                  </div>
                  <div className="card-rpa-sig">
                    {sigSvg}
                    <span className="auto-badge">✒ RPA</span>
                  </div>
                </>
              )}

              <div className="card-head">
                {isArtistry ? (
                  <>
                    <span className="card-art-brand">
                      Artistry<span className="card-art-year">2026 · Football</span>
                    </span>
                    {card.serial != null ? (
                      <span className="card-art-serial">{card.serial} / {card.printRun}</span>
                    ) : (
                      card.player.isRookie && <span className="card-rc-badge">RC</span>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {card.player.isRookie && <span className="card-rc-badge">RC</span>}
                  </div>
                )}
              </div>
              <div className="card-plate">
                {isArtistry && <span className="card-art-spotlight" />}
                <div className="card-name">{card.player.name}</div>
                <div className="card-sub">{card.player.position} · {card.player.teamAbbr}</div>
                <div className="card-plate-row">
                  <span className="card-serial mono">
                    {card.serial != null ? `#${card.serial}${card.printRun ? '/' + card.printRun : ''}` : 'BASE'}
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* ── BACK ── full detail: set info, patch, sig, value */}
        <div className="card-face card-face-back">
          <div className="card-frame">
            <div className="card-inner">
              <div className="card-set-bg" />
              <div className="card-set-fx" />
              <div className="sheen" />

              <div className="card-head">
                <span className="card-setmark">
                  {set.wordmark} <span className="card-setyear">· '26</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {card.player.isRookie && <span className="card-rc-badge">RC</span>}
                  <span className="card-parallel-pill" style={{ color: isDarkPill ? '#cfd6e2' : def.color }}>
                    {shortName}
                  </span>
                </div>
              </div>

              <div className="card-plate">
                <div className="card-name">{card.player.name}</div>
                <div className="card-sub">
                  {card.player.position} · {card.player.teamAbbr}
                  {card.player.overallRating != null ? ` · OVR ${card.player.overallRating}` : ''}
                </div>
                <div className="card-plate-row">
                  <span className="card-serial mono">
                    {card.serial != null ? `#${card.serial}${card.printRun ? '/' + card.printRun : ''}` : 'BASE'}
                  </span>
                  <span className="card-value-pill mono">{money(card.marketValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
