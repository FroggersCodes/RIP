import { PARALLEL_MAP, setOf, type ParallelName, type Position } from '@rip/shared';
import { money } from '../lib/format';
import { signaturePath } from '../lib/signature';
import { PlayerPortrait } from './PlayerPortrait';
import './Card.css';

export interface CardData {
  player: { id: string; name: string; position: Position; teamAbbr: string; overallRating?: number };
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
      : card.parallel === 'GOLD'
        ? 'tier-gold'
        : 'tier-plain';
  const set = setOf(card.setKey);
  const shortName = def.displayName.replace(/\s*\/.*/, '').replace(/\s*1\/1/, '');
  const sig = card.parallel === 'AUTOGRAPH' ? signaturePath(card.player.name) : null;
  return (
    <div
      className={`card card-${size} ${tier} set-${set.key} ${faded ? 'faded' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ ['--accent' as string]: def.color }}
      onClick={onClick}
    >
      <div className="card-frame">
        <div className="card-inner">
          <div className="card-photo">
            <PlayerPortrait player={card.player} fill />
          </div>
          <div className="card-photo-scrim" />
          <div className="card-set-fx" />
          <div className="sheen" />
          {sig && (
            <div className="card-sig">
              <svg className="card-sig-svg" viewBox={`0 0 ${sig.width} 100`} preserveAspectRatio="xMidYMid meet">
                <path d={sig.d} />
              </svg>
              <span className="auto-badge">✒ AUTO</span>
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
