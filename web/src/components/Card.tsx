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

export function Card({ card, size = 'md', faded, onClick }: Props) {
  const def = PARALLEL_MAP[card.parallel];
  const tier = card.refractor
    ? 'refractor'
    : card.parallel === 'AUTOGRAPH'
      ? 'tier-auto'
      : card.parallel === 'PATCH'
        ? 'tier-patch'
        : card.parallel === 'GOLD'
          ? 'tier-gold'
          : 'tier-plain';
  const set = setOf(card.setKey);
  const shortName = def.displayName.replace(/\s*\/.*/, '').replace(/\s*1\/1/, '');
  const sig = card.parallel === 'AUTOGRAPH' ? signaturePath(card.player.id) : null;
  const patch =
    card.parallel === 'PATCH'
      ? { primary: card.player.teamPrimaryColor ?? '#4a5568', secondary: card.player.teamSecondaryColor ?? '#1a202c' }
      : null;

  return (
    <div
      className={`card card-${size} ${tier} set-${set.key} ${faded ? 'faded' : ''} ${onClick ? 'clickable' : ''}`}
      style={{
        ['--accent' as string]: def.color,
        ...(patch && {
          ['--patch-primary' as string]: patch.primary,
          ['--patch-secondary' as string]: patch.secondary,
        }),
      }}
      onClick={onClick}
    >
      <div className="card-frame">
        <div className="card-inner">
          <div className="card-set-bg" />
          <div className="card-photo">
            <PlayerPortrait player={card.player} fill />
          </div>
          <div className="card-photo-scrim" />
          <div className="card-set-fx" />
          <div className="sheen" />
          {sig && (
            <div className="card-sig">
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
              <span className="auto-badge">✒ AUTO</span>
            </div>
          )}
          {patch && (
            <div className="card-patch">
              <svg className="card-patch-swatch" viewBox="0 0 88 56" xmlns="http://www.w3.org/2000/svg">
                {/* Base fabric */}
                <rect width="88" height="56" rx="4" fill={patch.primary} />
                {/* Jersey number stripe bands */}
                <rect y="14" width="88" height="11" fill={patch.secondary} opacity="0.85" />
                <rect y="31" width="88" height="11" fill={patch.secondary} opacity="0.85" />
                {/* Horizontal knit-stitch lines */}
                {[6, 13, 20, 27, 34, 41, 48].map((y) => (
                  <line key={y} x1="2" y1={y} x2="86" y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="3,3" />
                ))}
                {/* Seam stitching on stripe edges */}
                <line x1="0" y1="14" x2="88" y2="14" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4,2" />
                <line x1="0" y1="25" x2="88" y2="25" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4,2" />
                <line x1="0" y1="31" x2="88" y2="31" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4,2" />
                <line x1="0" y1="42" x2="88" y2="42" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="4,2" />
                {/* Border frame */}
                <rect width="88" height="56" rx="4" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              </svg>
              <span className="patch-badge">⬛ PATCH</span>
            </div>
          )}
          <div className="card-head">
            <span className="card-setmark">
              {set.wordmark} <span className="card-setyear">· '26</span>
            </span>
            <span className="card-parallel-pill" style={{ color: card.parallel === 'BLACK' ? '#cfd6e2' : def.color }}>
              {shortName}
            </span>
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
  );
}
