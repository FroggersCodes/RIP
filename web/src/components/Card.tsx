import { PARALLEL_MAP, type ParallelName, type Position } from '@rip/shared';
import { money } from '../lib/format';
import { PlayerPortrait } from './PlayerPortrait';
import './Card.css';

export interface CardData {
  player: { id: string; name: string; position: Position; teamAbbr: string; overallRating?: number };
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  marketValue: number;
  refractor: boolean;
}

interface Props {
  card: CardData;
  size?: 'sm' | 'md' | 'lg';
  faded?: boolean;
  onClick?: () => void;
}

export function Card({ card, size = 'md', faded, onClick }: Props) {
  const def = PARALLEL_MAP[card.parallel];
  const tier = card.refractor ? 'refractor' : card.parallel === 'GOLD' ? 'tier-gold' : 'tier-plain';
  const shortName = def.displayName.replace(/\s*\/.*/, '').replace(/\s*1\/1/, '');
  return (
    <div
      className={`card card-${size} ${tier} ${faded ? 'faded' : ''} ${onClick ? 'clickable' : ''}`}
      style={{ ['--accent' as string]: def.color }}
      onClick={onClick}
    >
      <div className="card-frame">
        <div className="card-inner">
          <div className="card-photo">
            <PlayerPortrait player={card.player} fill />
          </div>
          <div className="card-photo-scrim" />
          <div className="sheen" />
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
