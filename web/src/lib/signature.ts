// Generate a deterministic, signature-looking SVG path from a player's name.
// Each player gets a consistent, unique scrawl (a capital loop, a wavy run, a
// trailing flourish, and an underline) — looks hand-signed, not like typed cursive.

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function signaturePath(name: string): { d: string; width: number } {
  const rng = mulberry32(hash(name));
  const r = (a: number, b: number) => a + rng() * (b - a);
  const y = 64;
  let x = 14;
  const n = (v: number) => v.toFixed(1);

  // Capital initial loop.
  const capH = r(34, 52);
  let d = `M ${n(x)} ${n(y)}`;
  d += ` C ${n(x - 8)} ${n(y - capH)}, ${n(x + 28)} ${n(y - capH - 8)}, ${n(x + 22)} ${n(y - 4)}`;
  d += ` S ${n(x + 8)} ${n(y + 10)}, ${n(x + 26)} ${n(y)}`;
  x += 28;

  // Wavy scrawl.
  const strokes = 5 + Math.floor(rng() * 5);
  for (let i = 0; i < strokes; i++) {
    const x2 = x + r(15, 30);
    const up = y - r(14, 42);
    const dn = y + r(0, 14);
    d += ` C ${n(x + r(2, 9))} ${n(up)}, ${n(x2 - r(2, 9))} ${n(dn)}, ${n(x2)} ${n(y - r(0, 10))}`;
    x = x2;
  }

  // Trailing flourish + underline swoosh.
  const fx = x + r(22, 48);
  d += ` C ${n(x + 12)} ${n(y - 28)}, ${n(fx)} ${n(y - 32)}, ${n(fx)} ${n(y + 2)}`;
  d += ` M 10 ${n(y + 20)} q ${n(x / 2)} ${n(r(10, 20))} ${n(x + 28)} ${n(r(-8, 2))}`;

  return { d, width: Math.max(150, fx + 20) };
}
