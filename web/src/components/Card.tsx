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

export function Card({ card, size = 'md', faded, onClick }: Props) {
  const [flipped, setFlipped] = useState(false);

  const def = PARALLEL_MAP[card.parallel];
  const isRpa = card.parallel === 'PATCH_AUTO';
  const tier = card.refractor
    ? 'refractor'
    : isRpa
      ? 'tier-rpa'
      : card.parallel === 'AUTOGRAPH'
        ? 'tier-auto'
        : card.parallel === 'PATCH'
          ? 'tier-patch'
          : card.parallel === 'GOLD'
            ? 'tier-gold'
            : 'tier-plain';

  const set = setOf(card.setKey);
  const shortName = def.displayName.replace(/\s*\/.*/, '').replace(/\s*1\/1/, '');
  const hasSig = card.parallel === 'AUTOGRAPH' || isRpa;
  const sig = hasSig ? signaturePath(card.player.id) : null;
  const teamPrimary = card.player.teamPrimaryColor ?? '#1a2a4a';
  const teamSecondary = card.player.teamSecondaryColor ?? '#0c1422';
  const hasPatch = card.parallel === 'PATCH' || isRpa;

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
            <div className="card-inner">
              <div className="card-set-bg" />
              <div className="card-photo">
                <PlayerPortrait player={card.player} fill />
              </div>
              <div className="card-photo-scrim" />
              <div className="card-set-fx" />
              <div className="sheen" />
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
                <div style={{ display: 'flex', gap: 4 }}>
                  {card.player.isRookie && <span className="card-rc-badge">RC</span>}
                </div>
              </div>
              <div className="card-plate">
                <div className="card-name">{card.player.name}</div>
                <div className="card-sub">{card.player.position} · {card.player.teamAbbr}</div>
                <div className="card-plate-row">
                  <span className="card-serial mono">
                    {card.serial != null ? `#${card.serial}${card.printRun ? '/' + card.printRun : ''}` : 'BASE'}
                  </span>
                </div>
              </div>
            </div>
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
                  <span className="card-parallel-pill" style={{ color: card.parallel === 'BLACK' ? '#cfd6e2' : def.color }}>
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
