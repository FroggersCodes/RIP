// Generate a unique, hand-signed-looking signature for each player. Everything
// (capital style, stroke count, amplitude, loops, flourish, underline, slant, ink
// color, stroke width) is seeded from the player's name, so each player has their
// own distinct, stable autograph.

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

const INKS = ['#ffffff', '#e6edf8', '#5b8cff', '#ffd479', '#8be0ff', '#c9b3ff'];

export interface Signature {
  d: string;
  width: number;
  slant: number;
  ink: string;
  strokeWidth: number;
}

export function signaturePath(name: string): Signature {
  const rng = mulberry32(hash(name));
  const r = (a: number, b: number) => a + rng() * (b - a);
  const n = (v: number) => v.toFixed(1);
  const y = 62;
  let x = 14;
  let d = `M ${n(x)} ${n(y)}`;

  // Capital initial — one of a few shapes.
  const cap = Math.floor(rng() * 3);
  const capH = r(34, 54);
  if (cap === 0) {
    d += ` C ${n(x - 10)} ${n(y - capH)}, ${n(x + 30)} ${n(y - capH - 8)}, ${n(x + 22)} ${n(y - 4)}`;
    d += ` S ${n(x + 8)} ${n(y + 10)}, ${n(x + 28)} ${n(y)}`;
    x += 30;
  } else if (cap === 1) {
    d += ` Q ${n(x + 6)} ${n(y - capH - 6)}, ${n(x + 26)} ${n(y - 10)} T ${n(x + 42)} ${n(y)}`;
    x += 44;
  } else {
    d += ` L ${n(x + 10)} ${n(y - capH)} L ${n(x + 20)} ${n(y)} L ${n(x + 30)} ${n(y - capH * 0.6)}`;
    x += 32;
  }

  // Wavy run, with occasional mid-stroke loops.
  const strokes = 4 + Math.floor(rng() * 6);
  const amp = r(16, 38);
  for (let i = 0; i < strokes; i++) {
    const x2 = x + r(13, 28);
    const up = y - r(amp * 0.4, amp);
    const dn = y + r(0, 16);
    if (rng() < 0.22) d += ` c ${n(r(2, 8))} ${n(-r(18, 30))}, ${n(-r(4, 10))} ${n(-r(18, 30))}, 2 2`;
    d += ` C ${n(x + r(2, 9))} ${n(up)}, ${n(x2 - r(2, 9))} ${n(dn)}, ${n(x2)} ${n(y - r(0, 10))}`;
    x = x2;
  }

  // Trailing flourish.
  const fx = x + r(18, 50);
  if (rng() < 0.7) d += ` C ${n(x + 12)} ${n(y - r(20, 34))}, ${n(fx)} ${n(y - r(20, 36))}, ${n(fx)} ${n(y + 2)}`;
  else d += ` L ${n(fx)} ${n(y - r(6, 18))}`;

  // Underline swoosh (sometimes).
  if (rng() < 0.6) {
    const uy = y + r(16, 24);
    d += ` M 8 ${n(uy)} q ${n(fx / 2)} ${n(r(8, 20))} ${n(fx - 2)} ${n(r(-10, 2))}`;
  }

  return {
    d,
    width: Math.max(150, fx + 18),
    slant: r(-9, 2),
    ink: INKS[Math.floor(rng() * INKS.length)]!,
    strokeWidth: r(2.4, 3.6),
  };
}
