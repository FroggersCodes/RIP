// Single source of truth shared by the server (authoritative) and the web client
// (display only). The server never trusts the client; these constants exist so the
// UI can show odds, role eligibility, and card styling that match server behavior.

export type Position = 'QB' | 'RB' | 'WR' | 'TE';
export type ParallelName =
  // Generic lineup (Spark, Momentum, Gold Standard, Reliquary, legacy sets)
  | 'BASE'
  | 'BLUE'
  | 'PURPLE'
  | 'GOLD'
  | 'PATCH'
  | 'BLACK'
  | 'AUTOGRAPH'
  | 'PATCH_AUTO'
  | 'EMERALD'
  | 'SUPERFRACTOR'
  // Artistry set — its own numbered rainbow
  | 'ART_RED'
  | 'ART_BLUE'
  | 'ART_GREEN'
  | 'ART_BLUE_ICE'
  | 'ART_RAINBOW'
  | 'ART_PURPLE_ICE'
  | 'ART_GOLD'
  | 'ART_WHITE'
  | 'ART_BLACK'
  // Artistry "base autographs" — the same rainbow, signed
  | 'ART_RED_AUTO'
  | 'ART_BLUE_AUTO'
  | 'ART_GREEN_AUTO'
  | 'ART_BLUE_ICE_AUTO'
  | 'ART_RAINBOW_AUTO'
  | 'ART_PURPLE_ICE_AUTO'
  | 'ART_GOLD_AUTO'
  | 'ART_WHITE_AUTO'
  | 'ART_BLACK_AUTO'
  // Artistry Rookie Patch Autos
  | 'ART_RPA_50'
  | 'ART_RPA_35'
  | 'ART_RPA_25'
  | 'ART_RPA_10'
  | 'ART_RPA_3'
  | 'ART_RPA_1';
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
  /** Combined patch + auto card with the dedicated RPA layout. */
  rpa?: boolean;
  /** Counts as a "HIT" — drives the reveal flash and box hit guarantees. */
  hit?: boolean;
  /** Visual finish class suffix (`finish-<x>`) the web card renders. */
  finish?: string;
  /** Which lineup a parallel belongs to (gates the per-set fallback walk). */
  group?: 'generic' | 'artistry';
  color: string;
}

// Ordered most common -> rarest. The `group` field keeps each set's fallback
// walk inside its own lineup (see parallelOrderForSet).
export const PARALLELS: ParallelDef[] = [
  // ---- Generic lineup ----
  { name: 'BASE', displayName: 'Base', printRun: null, valueMultiplier: 1, refractor: false, finish: 'plain', group: 'generic', color: '#8b94a3' },
  { name: 'BLUE', displayName: 'Blue /5000', printRun: 5000, valueMultiplier: 2.5, refractor: false, finish: 'plain', group: 'generic', color: '#3b82f6' },
  { name: 'PURPLE', displayName: 'Purple /999', printRun: 999, valueMultiplier: 6, refractor: false, finish: 'plain', group: 'generic', color: '#a855f7' },
  { name: 'GOLD', displayName: 'Gold /250', printRun: 250, valueMultiplier: 15, refractor: false, hit: true, finish: 'gold', group: 'generic', color: '#f5b53d' },
  { name: 'PATCH', displayName: 'Patch /99', printRun: 99, valueMultiplier: 30, refractor: false, patched: true, hit: true, finish: 'patch', group: 'generic', color: '#94a3b8' },
  { name: 'BLACK', displayName: 'Black /50', printRun: 50, valueMultiplier: 50, refractor: true, hit: true, finish: 'black', group: 'generic', color: '#0c0e12' },
  { name: 'AUTOGRAPH', displayName: 'Autograph /25', printRun: 25, valueMultiplier: 120, refractor: false, signed: true, hit: true, finish: 'autogold', group: 'generic', color: '#e8c87a' },
  { name: 'PATCH_AUTO', displayName: 'RPA /5', printRun: 5, valueMultiplier: 400, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'generic', color: '#f0c060' },
  { name: 'EMERALD', displayName: 'Emerald /10', printRun: 10, valueMultiplier: 150, refractor: true, hit: true, finish: 'plain', group: 'generic', color: '#10b981' },
  { name: 'SUPERFRACTOR', displayName: 'Superfractor 1/1', printRun: 1, valueMultiplier: 600, refractor: true, hit: true, finish: 'plain', group: 'generic', color: '#f5b53d' },

  // ---- Artistry: base numbered rainbow ----
  { name: 'ART_RED', displayName: 'Red /299', printRun: 299, valueMultiplier: 2, refractor: false, finish: 'plain', group: 'artistry', color: '#e0564f' },
  { name: 'ART_BLUE', displayName: 'Blue /199', printRun: 199, valueMultiplier: 3, refractor: false, finish: 'plain', group: 'artistry', color: '#4f8fe0' },
  { name: 'ART_GREEN', displayName: 'Green /149', printRun: 149, valueMultiplier: 4, refractor: false, finish: 'plain', group: 'artistry', color: '#4fb06a' },
  { name: 'ART_BLUE_ICE', displayName: 'Blue Cracked Ice /50', printRun: 50, valueMultiplier: 12, refractor: false, hit: true, finish: 'ice', group: 'artistry', color: '#6fd0e8' },
  { name: 'ART_RAINBOW', displayName: 'Rainbow /35', printRun: 35, valueMultiplier: 20, refractor: true, hit: true, finish: 'plain', group: 'artistry', color: '#c07ad6' },
  { name: 'ART_PURPLE_ICE', displayName: 'Purple Cracked Ice /25', printRun: 25, valueMultiplier: 30, refractor: false, hit: true, finish: 'ice', group: 'artistry', color: '#a07ad6' },
  { name: 'ART_GOLD', displayName: 'Gold /10', printRun: 10, valueMultiplier: 60, refractor: false, hit: true, finish: 'gold', group: 'artistry', color: '#f5b53d' },
  { name: 'ART_WHITE', displayName: 'White /3', printRun: 3, valueMultiplier: 150, refractor: false, hit: true, finish: 'white', group: 'artistry', color: '#eef2f8' },
  { name: 'ART_BLACK', displayName: 'Black Finite 1/1', printRun: 1, valueMultiplier: 400, refractor: false, hit: true, finish: 'black', group: 'artistry', color: '#aeb6c4' },

  // ---- Artistry: base autographs (same rainbow, signed) ----
  { name: 'ART_RED_AUTO', displayName: 'Red Auto /299', printRun: 299, valueMultiplier: 6, refractor: false, signed: true, hit: true, finish: 'plain', group: 'artistry', color: '#e0564f' },
  { name: 'ART_BLUE_AUTO', displayName: 'Blue Auto /199', printRun: 199, valueMultiplier: 8, refractor: false, signed: true, hit: true, finish: 'plain', group: 'artistry', color: '#4f8fe0' },
  { name: 'ART_GREEN_AUTO', displayName: 'Green Auto /149', printRun: 149, valueMultiplier: 10, refractor: false, signed: true, hit: true, finish: 'plain', group: 'artistry', color: '#4fb06a' },
  { name: 'ART_BLUE_ICE_AUTO', displayName: 'Blue Cracked Ice Auto /50', printRun: 50, valueMultiplier: 30, refractor: false, signed: true, hit: true, finish: 'ice', group: 'artistry', color: '#6fd0e8' },
  { name: 'ART_RAINBOW_AUTO', displayName: 'Rainbow Auto /35', printRun: 35, valueMultiplier: 50, refractor: true, signed: true, hit: true, finish: 'plain', group: 'artistry', color: '#c07ad6' },
  { name: 'ART_PURPLE_ICE_AUTO', displayName: 'Purple Cracked Ice Auto /25', printRun: 25, valueMultiplier: 75, refractor: false, signed: true, hit: true, finish: 'ice', group: 'artistry', color: '#a07ad6' },
  { name: 'ART_GOLD_AUTO', displayName: 'Gold Auto /10', printRun: 10, valueMultiplier: 150, refractor: false, signed: true, hit: true, finish: 'gold', group: 'artistry', color: '#f5b53d' },
  { name: 'ART_WHITE_AUTO', displayName: 'White Auto /3', printRun: 3, valueMultiplier: 350, refractor: false, signed: true, hit: true, finish: 'white', group: 'artistry', color: '#eef2f8' },
  { name: 'ART_BLACK_AUTO', displayName: 'Black Finite Auto 1/1', printRun: 1, valueMultiplier: 800, refractor: false, signed: true, hit: true, finish: 'black', group: 'artistry', color: '#aeb6c4' },

  // ---- Artistry: Rookie Patch Autos (rookie-only; 1/1 is a team patch) ----
  { name: 'ART_RPA_50', displayName: 'RPA /50', printRun: 50, valueMultiplier: 40, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'artistry', color: '#6fd0e8' },
  { name: 'ART_RPA_35', displayName: 'RPA /35', printRun: 35, valueMultiplier: 60, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'artistry', color: '#c07ad6' },
  { name: 'ART_RPA_25', displayName: 'RPA /25', printRun: 25, valueMultiplier: 90, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'artistry', color: '#a07ad6' },
  { name: 'ART_RPA_10', displayName: 'RPA /10', printRun: 10, valueMultiplier: 180, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'artistry', color: '#f5b53d' },
  { name: 'ART_RPA_3', displayName: 'RPA /3', printRun: 3, valueMultiplier: 400, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'artistry', color: '#eef2f8' },
  { name: 'ART_RPA_1', displayName: 'RPA Team Patch 1/1', printRun: 1, valueMultiplier: 1000, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'artistry', color: '#e0b85a' },
];

export const PARALLEL_NAMES: ParallelName[] = PARALLELS.map((p) => p.name);

/** Rarest first — used for the sold-out fallback walk down toward Base. */
export const PARALLELS_BY_RARITY_DESC: ParallelName[] = [...PARALLEL_NAMES].reverse();

// Per-set parallel lineups (most common -> rarest). A set not listed here uses
// the generic lineup. Artistry runs its own numbered rainbow + auto + RPA tiers.
const GENERIC_ORDER: ParallelName[] = PARALLELS.filter((p) => p.group !== 'artistry').map((p) => p.name);
const ARTISTRY_ORDER: ParallelName[] = ['BASE', ...PARALLELS.filter((p) => p.group === 'artistry').map((p) => p.name)];
export const SET_PARALLEL_ORDER: Record<string, ParallelName[]> = {
  artistry: ARTISTRY_ORDER,
};

/** The parallels a set can yield, ordered most common -> rarest. */
export function parallelOrderForSet(setKey: string | null | undefined): ParallelName[] {
  return SET_PARALLEL_ORDER[setKey ?? ''] ?? GENERIC_ORDER;
}

/** Rarest -> Base for a set, used by the sold-out fallback walk. */
export function rarityDescForSet(setKey: string | null | undefined): ParallelName[] {
  return [...parallelOrderForSet(setKey)].reverse();
}

export const PARALLEL_MAP: Record<ParallelName, ParallelDef> = Object.fromEntries(
  PARALLELS.map((p) => [p.name, p]),
) as Record<ParallelName, ParallelDef>;

export function isRefractor(parallel: ParallelName): boolean {
  return PARALLEL_MAP[parallel]?.refractor ?? false;
}

/** Parallels considered a "HIT" worthy of the screen-flash reveal moment. */
export function isHit(parallel: ParallelName): boolean {
  return PARALLEL_MAP[parallel]?.hit ?? false;
}

export function isSigned(parallel: ParallelName): boolean {
  return PARALLEL_MAP[parallel]?.signed ?? false;
}
export function isPatched(parallel: ParallelName): boolean {
  return PARALLEL_MAP[parallel]?.patched ?? false;
}
/** Combined patch + auto card (RPA layout). */
export function isRpa(parallel: ParallelName): boolean {
  return PARALLEL_MAP[parallel]?.rpa ?? false;
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
