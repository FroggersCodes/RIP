// Deterministic, style-diverse autograph generator.
// Each player is assigned one of five distinct signing styles based on their name hash.
// All randomness is seeded from the name so every player has a stable, unique autograph.

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
const BASE = 62; // baseline y within a 100-tall viewbox

export interface Signature {
  d: string;
  width: number;
  slant: number;
  ink: string;
  strokeWidth: number;
}

// ─── Style 0: flowing cursive ────────────────────────────────────────────────
// Looks like a real first name written in script — connected loops, some
// ascenders/descenders, trailing flourish, single underline swoosh.
function cursiveStyle(rng: () => number): { d: string; endX: number } {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const n = (v: number) => v.toFixed(1);
  let x = 12;
  let d = `M ${n(x)} ${n(BASE)}`;

  // Decorative capital
  const capH = r(30, 48);
  const capW = r(22, 32);
  d += ` C ${n(x + 4)} ${n(BASE - capH)}, ${n(x + capW - 4)} ${n(BASE - capH + 6)}, ${n(x + capW)} ${n(BASE - 8)}`;
  d += ` C ${n(x + capW + 6)} ${n(BASE - 2)}, ${n(x + capW - 6)} ${n(BASE + 9)}, ${n(x + capW + 14)} ${n(BASE)}`;
  x += capW + 14;

  // Connected letter bumps
  const letters = 4 + Math.floor(rng() * 5);
  for (let i = 0; i < letters; i++) {
    const lw = r(14, 24);
    const lh = r(10, 20);
    const kind = rng();
    if (kind < 0.2) {
      // Ascender (tall upstroke, like l/h/b/d)
      d += ` C ${n(x + 2)} ${n(BASE - lh * 2.1)}, ${n(x + lw - 2)} ${n(BASE - lh * 2)}, ${n(x + lw)} ${n(BASE)}`;
    } else if (kind < 0.32) {
      // Descender loop (like g/y/p)
      d += ` C ${n(x + 3)} ${n(BASE + 14)}, ${n(x + lw - 3)} ${n(BASE + 18)}, ${n(x + lw)} ${n(BASE)}`;
    } else {
      // Mid-height bump
      d += ` C ${n(x + 3)} ${n(BASE - lh)}, ${n(x + lw - 3)} ${n(BASE - lh * 0.7)}, ${n(x + lw)} ${n(BASE - r(0, 7))}`;
    }
    x += lw;
  }

  // Trailing flourish
  const fx = x + r(16, 32);
  d += ` C ${n(x + 8)} ${n(BASE - r(16, 28))}, ${n(fx - 5)} ${n(BASE - r(10, 22))}, ${n(fx)} ${n(BASE)}`;

  // Underline swoosh
  const uy = BASE + r(14, 22);
  d += ` M 8 ${n(uy)} Q ${n(fx * 0.5)} ${n(uy + r(6, 14))} ${n(fx + 6)} ${n(uy - r(4, 10))}`;

  return { d, endX: fx + 6 };
}

// ─── Style 1: big initial + long horizontal streak ───────────────────────────
// A large, ornate capital letter followed by a flat wavy line — like how many
// real athletes sign (big first letter, quick trailing mark).
function initialStreakStyle(rng: () => number): { d: string; endX: number } {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const n = (v: number) => v.toFixed(1);
  let x = 14;
  let d = `M ${n(x)} ${n(BASE)}`;

  // Ornate capital — 4 distinct shapes
  const capH = r(42, 58);
  const cap = Math.floor(rng() * 4);
  if (cap === 0) {
    // Sweeping closed curve (B / D / P)
    d += ` C ${n(x - 10)} ${n(BASE - capH)}, ${n(x + 42)} ${n(BASE - capH - 8)}, ${n(x + 36)} ${n(BASE - capH * 0.5)}`;
    d += ` S ${n(x + 46)} ${n(BASE + 2)}, ${n(x + 30)} ${n(BASE + 4)}`;
    x += 32;
  } else if (cap === 1) {
    // Tall stroke + crossbar (L / F / E)
    d += ` L ${n(x + 7)} ${n(BASE - capH)}`;
    d += ` C ${n(x + 9)} ${n(BASE - capH + 5)}, ${n(x + 36)} ${n(BASE - capH - 4)}, ${n(x + 32)} ${n(BASE - 5)}`;
    d += ` Q ${n(x + 30)} ${n(BASE + 7)}, ${n(x + 26)} ${n(BASE)}`;
    x += 28;
  } else if (cap === 2) {
    // Oval/circle (O / G / C)
    d += ` C ${n(x - 14)} ${n(BASE - capH - 4)}, ${n(x + 46)} ${n(BASE - capH - 4)}, ${n(x + 40)} ${n(BASE - 2)}`;
    d += ` Q ${n(x + 38)} ${n(BASE + 11)}, ${n(x + 20)} ${n(BASE + 2)}`;
    x += 22;
  } else {
    // Angular peaks (M / W / N)
    d += ` L ${n(x + 10)} ${n(BASE - capH)} L ${n(x + 22)} ${n(BASE - capH * 0.32)} L ${n(x + 34)} ${n(BASE - capH)} L ${n(x + 44)} ${n(BASE)}`;
    x += 46;
  }

  // Long, nearly flat streak
  const len = r(80, 140);
  const endX = x + len;
  d += ` C ${n(x + len * 0.3)} ${n(BASE - r(4, 12))}, ${n(x + len * 0.7)} ${n(BASE + r(2, 10))}, ${n(endX)} ${n(BASE - r(0, 8))}`;

  // Small tail dip (sometimes)
  if (rng() < 0.6) {
    const tx = endX + r(6, 20);
    d += ` Q ${n(endX + 10)} ${n(BASE + r(10, 22))}, ${n(tx)} ${n(BASE - r(0, 6))}`;
    return { d, endX: tx };
  }

  return { d, endX: endX + 14 };
}

// ─── Style 2: tight chaotic scrawl ───────────────────────────────────────────
// Quick, compressed back-and-forth strokes with tight loops — the kind of
// illegible signature that's clearly signed a thousand times in 30 seconds.
function scrawlStyle(rng: () => number): { d: string; endX: number } {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const n = (v: number) => v.toFixed(1);
  let x = 10;
  let d = `M ${n(x)} ${n(BASE)}`;

  const segments = 9 + Math.floor(rng() * 8);
  const amp = r(12, 24);

  for (let i = 0; i < segments; i++) {
    const dx = r(8, 18);
    const x2 = x + dx;
    const flip = rng() < 0.5 ? 1 : -1;
    d += ` C ${n(x + r(1, 5))} ${n(BASE + flip * r(amp * 0.5, amp))}, ${n(x2 - r(1, 5))} ${n(BASE - flip * r(amp * 0.4, amp))}, ${n(x2)} ${n(BASE + r(-7, 7))}`;
    // Tight mid-stroke loop (common in rushed signatures)
    if (rng() < 0.28) {
      d += ` c ${n(r(2, 6))} ${n(-r(10, 20))}, ${n(-r(3, 8))} ${n(-r(10, 20))}, 0 0`;
    }
    x = x2;
  }

  // Sharp quick ending stroke
  const endX = x + r(12, 28);
  d += ` C ${n(x + 6)} ${n(BASE - r(8, 18))}, ${n(endX - 4)} ${n(BASE - r(4, 14))}, ${n(endX)} ${n(BASE + r(-4, 6))}`;

  return { d, endX };
}

// ─── Style 3: block initials ─────────────────────────────────────────────────
// Two (sometimes three) large, distinct initial shapes drawn separately —
// like a deliberate "J.B." style signature with clear letter forms.
function initialsStyle(rng: () => number): { d: string; endX: number } {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const n = (v: number) => v.toFixed(1);
  let x = 10;
  let d = '';

  const count = rng() < 0.38 ? 3 : 2;

  for (let i = 0; i < count; i++) {
    const kind = Math.floor(rng() * 5);
    const h = r(30, 50);
    const w = r(22, 36);

    d += ` M ${n(x)} ${n(BASE)}`;

    if (kind === 0) {
      // Oval (O / D / Q)
      d += ` C ${n(x)} ${n(BASE - h * 1.1)}, ${n(x + w)} ${n(BASE - h * 1.1)}, ${n(x + w)} ${n(BASE - h * 0.5)}`;
      d += ` C ${n(x + w)} ${n(BASE + 5)}, ${n(x)} ${n(BASE + 5)}, ${n(x)} ${n(BASE - h * 0.5)}`;
    } else if (kind === 1) {
      // Angular tent (A / M / N)
      d += ` L ${n(x + w * 0.5)} ${n(BASE - h)} L ${n(x + w)} ${n(BASE)}`;
      d += ` M ${n(x + w * 0.18)} ${n(BASE - h * 0.5)} L ${n(x + w * 0.82)} ${n(BASE - h * 0.5)}`;
    } else if (kind === 2) {
      // Vertical with top loop (B / P / R)
      d += ` L ${n(x + 5)} ${n(BASE - h)}`;
      d += ` C ${n(x + 5)} ${n(BASE - h + 2)}, ${n(x + w + 8)} ${n(BASE - h + 2)}, ${n(x + w + 6)} ${n(BASE - h * 0.52)}`;
      d += ` C ${n(x + w + 4)} ${n(BASE - h * 0.08)}, ${n(x + 5)} ${n(BASE - h * 0.08)}, ${n(x + 5)} ${n(BASE)}`;
    } else if (kind === 3) {
      // S-curve (S / Z / 5)
      d += ` C ${n(x + w * 0.1)} ${n(BASE - h * 0.55)}, ${n(x + w)} ${n(BASE - h * 0.55)}, ${n(x + w * 0.5)} ${n(BASE - h * 0.5)}`;
      d += ` C ${n(x)} ${n(BASE - h * 0.45)}, ${n(x + w * 0.9)} ${n(BASE - h * 0.45)}, ${n(x + w)} ${n(BASE - h * 0.95)}`;
    } else {
      // Cross / T / I with serifs
      d += ` L ${n(x + w * 0.5)} ${n(BASE - h)}`;
      d += ` M ${n(x)} ${n(BASE - h)} L ${n(x + w)} ${n(BASE - h)}`;
      d += ` M ${n(x + w * 0.22)} ${n(BASE)} L ${n(x + w * 0.78)} ${n(BASE)}`;
    }

    x += w + 26;
  }

  const endX = x - 14;

  // Dot after initials (like "J.B.") — zero-length segment renders as a circle via strokeLinecap="round"
  if (rng() < 0.55) {
    const dx = endX + 2;
    d += ` M ${n(dx)} ${n(BASE - 5)} L ${n(dx)} ${n(BASE - 5)}`;
  }

  return { d, endX: endX + 10 };
}

// ─── Style 4: tall loopy cursive ─────────────────────────────────────────────
// Very tall ascenders, exaggerated loops, dramatic double-underline — the kind
// of signature that looks like it belongs on a Declaration of Independence.
function loopyStyle(rng: () => number): { d: string; endX: number } {
  const r = (a: number, b: number) => a + rng() * (b - a);
  const n = (v: number) => v.toFixed(1);
  let x = 12;
  let d = `M ${n(x)} ${n(BASE)}`;

  // Very tall ornate capital with internal cross-loop
  const capH = r(44, 58);
  d += ` C ${n(x - 14)} ${n(BASE - capH)}, ${n(x + 50)} ${n(BASE - capH - 12)}, ${n(x + 40)} ${n(BASE - capH * 0.42)}`;
  d += ` C ${n(x + 32)} ${n(BASE + 2)}, ${n(x + 18)} ${n(BASE - capH * 0.28)}, ${n(x + 44)} ${n(BASE - capH * 0.58)}`;
  d += ` C ${n(x + 54)} ${n(BASE - 4)}, ${n(x + 40)} ${n(BASE + 9)}, ${n(x + 52)} ${n(BASE)}`;
  x += 54;

  // Tall exaggerated loops
  const loops = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < loops; i++) {
    const lw = r(20, 34);
    const lh = r(22, 42);
    const kind = rng();
    if (kind < 0.4) {
      // High loop
      d += ` C ${n(x + 4)} ${n(BASE - lh - 8)}, ${n(x + lw - 4)} ${n(BASE - lh)}, ${n(x + lw)} ${n(BASE)}`;
    } else if (kind < 0.6) {
      // Below-baseline loop
      d += ` C ${n(x + 4)} ${n(BASE + lh * 0.5)}, ${n(x + lw - 4)} ${n(BASE + lh * 0.5)}, ${n(x + lw)} ${n(BASE)}`;
    } else {
      // Swinging curve
      d += ` C ${n(x + 5)} ${n(BASE - lh)}, ${n(x + lw - 5)} ${n(BASE + 9)}, ${n(x + lw)} ${n(BASE - r(4, 14))}`;
    }
    x += lw;
  }

  // Dramatic ending flourish
  const fx = x + r(24, 48);
  d += ` C ${n(x + 10)} ${n(BASE - r(28, 46))}, ${n(fx - 8)} ${n(BASE - r(22, 40))}, ${n(fx)} ${n(BASE + r(6, 16))}`;
  d += ` Q ${n(fx + 14)} ${n(BASE - r(14, 28))}, ${n(fx + r(6, 22))} ${n(BASE - 4)}`;

  // Double underline
  const totalW = fx + 28;
  const uy = BASE + r(14, 20);
  d += ` M 6 ${n(uy)} Q ${n(totalW * 0.5)} ${n(uy + r(6, 13))} ${n(totalW - 5)} ${n(uy - r(3, 8))}`;
  const uy2 = uy + r(5, 9);
  d += ` M 6 ${n(uy2)} Q ${n(totalW * 0.5)} ${n(uy2 + r(4, 10))} ${n(totalW - 5)} ${n(uy2 - r(2, 6))}`;

  return { d, endX: totalW };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function signaturePath(name: string): Signature {
  const rng = mulberry32(hash(name));

  // Meta-properties consumed first so they're stable regardless of style length
  const slant = -9 + rng() * 11;
  const ink = INKS[Math.floor(rng() * INKS.length)]!;
  const strokeWidth = 2.4 + rng() * 1.2;

  const style = Math.floor(rng() * 5);
  let result: { d: string; endX: number };
  switch (style) {
    case 0: result = cursiveStyle(rng); break;
    case 1: result = initialStreakStyle(rng); break;
    case 2: result = scrawlStyle(rng); break;
    case 3: result = initialsStyle(rng); break;
    default: result = loopyStyle(rng); break;
  }

  return {
    d: result.d,
    width: Math.max(150, result.endX + 22),
    slant,
    ink,
    strokeWidth,
  };
}
