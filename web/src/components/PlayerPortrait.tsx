import { useState } from 'react';
import type { Position } from '@rip/shared';
import { PORTRAITS_ENABLED, accentFromId, initials, portraitFile } from '../lib/portrait';
import './PlayerPortrait.css';

interface Props {
  player: { id: string; name: string; position: Position };
  /** Fill a positioned parent (used as card art). Otherwise renders a sized box. */
  fill?: boolean;
  size?: number;
  round?: boolean;
}

export function PlayerPortrait({ player, fill, size = 48, round = true }: Props) {
  const [failed, setFailed] = useState(!PORTRAITS_ENABLED);
  const accent = accentFromId(player.id);
  const style: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0 }
    : { width: size, height: size, borderRadius: round ? '50%' : 12 };

  return (
    <div className={`portrait${fill ? ' portrait-fill' : ''}`} style={{ ...style, ['--pa' as string]: accent }}>
      <div className="portrait-bg" />
      {!failed && (
        <img
          className="portrait-img"
          src={player.position === 'QB' ? '/players/qb-default.jpg' : portraitFile(player.name)}
          alt={player.name}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      <div className="portrait-fallback">
        <span className="portrait-initials" style={{ fontSize: fill ? 44 : Math.round(size * 0.36) }}>
          {initials(player.name)}
        </span>
      </div>
    </div>
  );
}
