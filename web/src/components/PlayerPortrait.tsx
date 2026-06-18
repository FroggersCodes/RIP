import { useState } from 'react';
import type { Position } from '@rip/shared';
import { PORTRAITS_ENABLED, accentFromId, initials, portraitFile, portraitFallbackUrl } from '../lib/portrait';
import './PlayerPortrait.css';

interface Props {
  player: { id: string; name: string; position: Position };
  /** Fill a positioned parent (used as card art). Otherwise renders a sized box. */
  fill?: boolean;
  size?: number;
  round?: boolean;
}

export function PlayerPortrait({ player, fill, size = 48, round = true }: Props) {
  // 0 = try local baked file, 1 = try DiceBear, 2 = show initials
  const [stage, setStage] = useState(PORTRAITS_ENABLED ? 0 : 2);
  const accent = accentFromId(player.id);
  const style: React.CSSProperties = fill
    ? { position: 'absolute', inset: 0 }
    : { width: size, height: size, borderRadius: round ? '50%' : 12 };

  const src =
    stage === 0 ? portraitFile(player.name) :
    stage === 1 ? portraitFallbackUrl(player.name) :
    null;

  return (
    <div className={`portrait${fill ? ' portrait-fill' : ''}`} style={{ ...style, ['--pa' as string]: accent }}>
      <div className="portrait-bg" />
      {src && (
        <img
          className="portrait-img"
          src={src}
          alt={player.name}
          loading="lazy"
          onError={() => setStage((s) => s + 1)}
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
