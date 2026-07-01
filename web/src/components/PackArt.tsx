import { setOf } from '@rip/shared';
import './PackArt.css';

interface Props {
  setKey: string;
  /** Overrides the set label as the pack name shown across the foil (defaults to the set label). */
  name?: string;
  size?: 'sm' | 'lg';
  className?: string;
}

/**
 * A static, themed "picture" of a sealed pack — one distinct look per set. Used
 * in the rip gallery (small) and the pack detail hero (large). The sealed-pack
 * animation lives in RipReveal; this is purely the cover art.
 */
export function PackArt({ setKey, name, size = 'sm', className = '' }: Props) {
  const set = setOf(setKey);
  return (
    <div className={`pack-art-tile set-${set.key} pack-art-${size} ${className}`}>
      <div className="pat-foil" />
      <div className="pat-shine" />
      <div className="pat-inner">
        <span className="pat-logo">
          RIP<span className="pat-dot">.</span>
        </span>
        <span className="pat-wordmark">{set.wordmark}</span>
        <span className="pat-name">{name ?? set.label}</span>
      </div>
      <span className="pat-notches" aria-hidden="true" />
    </div>
  );
}
