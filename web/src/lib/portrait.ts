// Deterministic AI portraits for fictional players. Each player's id seeds a
// stable prompt + image so the same face appears every time. Rendered in the
// user's browser; PlayerPortrait falls back to a monogram if the image fails.

const POSITION_TITLE: Record<string, string> = {
  QB: 'quarterback',
  RB: 'running back',
  WR: 'wide receiver',
  TE: 'tight end',
};

const LOOKS = ['Black', 'white', 'Hispanic', 'Samoan', 'East Asian', 'South Asian'];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Set VITE_PORTRAITS=off to use monograms only (no external image calls).
export const PORTRAITS_ENABLED = (import.meta.env.VITE_PORTRAITS ?? 'on') !== 'off';

export function portraitUrl(player: { id: string; position: string }, w = 480, h = 600): string {
  const seed = hashStr(player.id) % 1_000_000;
  const look = LOOKS[hashStr(player.id + 'L') % LOOKS.length];
  const age = 22 + (hashStr(player.id + 'A') % 13);
  const title = POSITION_TITLE[player.position] ?? 'player';
  const prompt =
    `professional studio headshot portrait of a ${age} year old ${look} male american football ${title}, ` +
    `athletic build, neutral confident expression, plain dark charcoal studio background, dramatic rim lighting, ` +
    `photorealistic, sharp focus, 85mm`;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&model=flux`;
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
