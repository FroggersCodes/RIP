// Single source of truth shared by the server (authoritative) and the web client
// (display only). The server never trusts the client; these constants exist so the
// UI can show odds, role eligibility, and card styling that match server behavior.

export type Position = 'QB' | 'RB' | 'WR' | 'TE';
export type ParallelName =
  | 'BASE'
  | 'BLUE'
  | 'PURPLE'
  | 'GOLD'
  | 'PATCH'
  | 'BLACK'
  | 'AUTOGRAPH'
  | 'PATCH_AUTO'
  | 'EMERALD'
  | 'SUPERFRACTOR';
export type LineupRoleName = 'QB' | 'WR1' | 'WR2' | 'RB' | 'TE' | 'FLEX';

export interface ParallelDef {
  name: ParallelName;
  displayName: string;
  /** null = unlimited (Base). Otherwise the finite print run (max 5000). */
  printRun: number | null;
  valueMultiplier: number;
  /** Holographic refractor treatment — reserved for the rarest pulls only. */
  refractor: boolean;
  /** Autograph treatment (signature flourish). */
  signed?: boolean;
  /** Game-worn patch swatch embedded in the card. */
  patched?: boolean;
  color: string;
}

// Ordered most common -> rarest.
export const PARALLELS: ParallelDef[] = [
  { name: 'BASE', displayName: 'Base', printRun: null, valueMultiplier: 1, refractor: false, color: '#8b94a3' },
  { name: 'BLUE', displayName: 'Blue /5000', printRun: 5000, valueMultiplier: 2.5, refractor: false, color: '#3b82f6' },
  { name: 'PURPLE', displayName: 'Purple /999', printRun: 999, valueMultiplier: 6, refractor: false, color: '#a855f7' },
  { name: 'GOLD', displayName: 'Gold /250', printRun: 250, valueMultiplier: 15, refractor: false, color: '#f5b53d' },
  { name: 'PATCH', displayName: 'Patch /99', printRun: 99, valueMultiplier: 30, refractor: false, patched: true, color: '#94a3b8' },
  { name: 'BLACK', displayName: 'Black /50', printRun: 50, valueMultiplier: 50, refractor: true, color: '#0c0e12' },
  { name: 'AUTOGRAPH', displayName: 'Autograph /25', printRun: 25, valueMultiplier: 120, refractor: false, signed: true, color: '#e8c87a' },
  { name: 'PATCH_AUTO', displayName: 'RPA /5', printRun: 5, valueMultiplier: 400, refractor: false, signed: true, patched: true, color: '#f0c060' },
  { name: 'EMERALD', displayName: 'Emerald /10', printRun: 10, valueMultiplier: 150, refractor: true, color: '#10b981' },
  { name: 'SUPERFRACTOR', displayName: 'Superfractor 1/1', printRun: 1, valueMultiplier: 600, refractor: true, color: '#f5b53d' },
];

export const PARALLEL_NAMES: ParallelName[] = PARALLELS.map((p) => p.name);

/** Rarest first — used for the sold-out fallback walk down toward Base. */
export const PARALLELS_BY_RARITY_DESC: ParallelName[] = [...PARALLEL_NAMES].reverse();

export const PARALLEL_MAP: Record<ParallelName, ParallelDef> = Object.fromEntries(
  PARALLELS.map((p) => [p.name, p]),
) as Record<ParallelName, ParallelDef>;

export function isRefractor(parallel: ParallelName): boolean {
  return PARALLEL_MAP[parallel]?.refractor ?? false;
}

/** Parallels considered a "HIT" worthy of the screen-flash reveal moment. */
export function isHit(parallel: ParallelName): boolean {
  return (
    parallel === 'GOLD' ||
    parallel === 'PATCH' ||
    parallel === 'BLACK' ||
    parallel === 'AUTOGRAPH' ||
    parallel === 'PATCH_AUTO' ||
    parallel === 'EMERALD' ||
    parallel === 'SUPERFRACTOR'
  );
}

// Card sets — each product belongs to a set with its own on-card visual treatment.
export type SetKey = 'chrome' | 'prizm' | 'vault' | 'spark' | 'momentum' | 'artistry' | 'gold-standard' | 'reliquary';
export interface SetDef {
  key: SetKey;
  label: string;
  wordmark: string;
  /** 1 (entry/Spark) → 5 (ultra/Reliquary). Drives rip animation speed: lower = snappier. */
  tierLevel: number;
}
export const SETS: Record<string, SetDef> = {
  // Legacy sets (kept for existing cards)
  chrome:        { key: 'chrome',        label: 'Topps Chrome',  wordmark: 'CHROME',   tierLevel: 1 },
  prizm:         { key: 'prizm',         label: 'Prizm Legacy',  wordmark: 'PRIZM',    tierLevel: 2 },
  vault:         { key: 'vault',         label: 'Premier Vault', wordmark: 'VAULT',    tierLevel: 4 },
  // 5-tier product lineup
  spark:         { key: 'spark',         label: 'Spark',         wordmark: 'SPARK',    tierLevel: 1 },
  momentum:      { key: 'momentum',      label: 'Momentum',      wordmark: 'MNTM',     tierLevel: 2 },
  artistry:      { key: 'artistry',      label: 'Artistry',      wordmark: 'ARTISTRY', tierLevel: 3 },
  'gold-standard': { key: 'gold-standard', label: 'Gold Standard', wordmark: 'GLD STD', tierLevel: 4 },
  reliquary:     { key: 'reliquary',     label: 'Reliquary',     wordmark: 'RLQ',      tierLevel: 5 },
};
export function setOf(key: string | null | undefined): SetDef {
  return SETS[key ?? 'spark'] ?? SETS.spark!;
}

export const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];

export const LINEUP_ROLES: LineupRoleName[] = ['QB', 'WR1', 'WR2', 'RB', 'TE', 'FLEX'];

export const ROLE_ELIGIBILITY: Record<LineupRoleName, Position[]> = {
  QB: ['QB'],
  WR1: ['WR'],
  WR2: ['WR'],
  RB: ['RB'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
};

export function isEligibleForRole(role: LineupRoleName, position: Position): boolean {
  return ROLE_ELIGIBILITY[role]?.includes(position) ?? false;
}

/** Small premium for desirable low serials (#1, single digits, very low). */
export function serialPremium(serial: number | null | undefined, printRun: number | null | undefined): number {
  if (serial == null) return 1;
  if (serial === 1) return 1.5;
  if (serial <= 10) return 1.15;
  if (printRun && serial <= Math.max(1, Math.floor(printRun * 0.05))) return 1.05;
  return 1;
}

export function computeMarketValue(
  currentValue: number,
  valueMultiplier: number,
  serial: number | null | undefined,
  printRun: number | null | undefined,
): number {
  const raw = currentValue * valueMultiplier * serialPremium(serial, printRun);
  return Math.round(raw * 100) / 100;
}

export interface StatLine {
  passYds?: number;
  passTd?: number;
  interceptions?: number;
  rushYds?: number;
  rushTd?: number;
  receptions?: number;
  recYds?: number;
  recTd?: number;
  fumbles?: number;
}

/** PPR-style fantasy scoring. */
export function fantasyPoints(s: StatLine): number {
  const pts =
    (s.passYds ?? 0) * 0.04 +
    (s.passTd ?? 0) * 4 +
    (s.interceptions ?? 0) * -2 +
    (s.rushYds ?? 0) * 0.1 +
    (s.rushTd ?? 0) * 6 +
    (s.receptions ?? 0) * 1 +
    (s.recYds ?? 0) * 0.1 +
    (s.recTd ?? 0) * 6 +
    (s.fumbles ?? 0) * -2;
  return Math.round(pts * 100) / 100;
}

export function normalizeOdds(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) out[k] = v / total;
  return out;
}

// Dust returned when a card is broken down — scales with its market value, so
// breaking down a hit pays far more than base filler. Used by server and client.
export function dustForBreakdown(marketValue: number): number {
  return Math.max(3, Math.round(marketValue * 0.3));
}

// Competitive rank ladder derived from rating.
export function division(rating: number): string {
  if (rating >= 1600) return 'Diamond';
  if (rating >= 1400) return 'Platinum';
  if (rating >= 1200) return 'Gold';
  if (rating >= 1050) return 'Silver';
  return 'Bronze';
}
