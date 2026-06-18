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
  const shortName = def.displayName.replace(/\s*\/.*/, '').replace(/\s*1\/1/, '');
  const set = setOf(card.setKey);
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
          <span className="card-set-mark">{set.wordmark}</span>
          {sig && (
            <div className="card-sig">
              <svg className="card-sig-svg" viewBox={`0 0 ${sig.width} 100`} preserveAspectRatio="xMidYMid meet">
                <path d={sig.d} />
              </svg>
              <span className="auto-badge">✒ AUTO</span>
            </div>
          )}
          <div className="card-head">
            <span className="card-parallel" style={{ color: card.parallel === 'BLACK' ? '#cfd6e2' : def.color }}>
              {shortName}
            </span>
            <span className="card-serial mono">
              {card.serial != null ? `#${card.serial}${card.printRun ? '/' + card.printRun : ''}` : 'BASE'}
            </span>
          </div>
          <div className="card-plate">
            <div className="card-pos">
              <span className="pos-badge">{card.player.position}</span>
              <span className="card-team mono">{card.player.teamAbbr}</span>
            </div>
            <div className="card-name">{card.player.name}</div>
            <div className="card-foot">
              <span className="card-value mono">{money(card.marketValue)}</span>
              {card.player.overallRating != null && <span className="card-ovr mono">OVR {card.player.overallRating}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
