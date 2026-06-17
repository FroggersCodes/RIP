// Player portraits are baked once (see server/scripts/bakePortraits.ts + the
// GitHub Action) into web/public/players/<slug>.jpg, keyed by name slug so they
// match any reseed of the deterministic roster. PlayerPortrait falls back to a
// monogram if a file is missing (e.g. before the bake has run).

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Set VITE_PORTRAITS=off to skip image loading and always use monograms.
export const PORTRAITS_ENABLED = (import.meta.env.VITE_PORTRAITS ?? 'on') !== 'off';

export function nameSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function portraitFile(name: string): string {
  return `/players/${nameSlug(name)}.jpg`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const ACCENTS = ['#3b82f6', '#a855f7', '#10b981', '#f5b53d', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
export function accentFromId(id: string): string {
  return ACCENTS[hashStr(id + 'c') % ACCENTS.length]!;
}
