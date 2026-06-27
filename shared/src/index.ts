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
  | 'ART_RPA_1'
  // Reliquary — its own four-tier checklist (base / patch / auto / RPA rainbows)
  // Base rainbow
  | 'RLQ_RC'
  | 'RLQ_GREEN'
  | 'RLQ_ORANGE'
  | 'RLQ_RED'
  | 'RLQ_OFL'
  | 'RLQ_WHITE'
  | 'RLQ_PINK'
  | 'RLQ_GOLD'
  | 'RLQ_GOLD_SHIMMER'
  | 'RLQ_GREEN_SHIMMER'
  | 'RLQ_BLACK'
  // Patch rainbow
  | 'RLQ_PATCH'
  | 'RLQ_PATCH_RC'
  | 'RLQ_PATCH_GREEN'
  | 'RLQ_PATCH_ORANGE'
  | 'RLQ_PATCH_RED'
  | 'RLQ_PATCH_OFL'
  | 'RLQ_PATCH_WHITE'
  | 'RLQ_PATCH_PINK'
  | 'RLQ_PATCH_GOLD'
  | 'RLQ_PATCH_GOLD_SHIMMER'
  | 'RLQ_PATCH_GREEN_SHIMMER'
  | 'RLQ_PATCH_BLACK'
  // Autograph rainbow
  | 'RLQ_AUTO'
  | 'RLQ_AUTO_ORANGE'
  | 'RLQ_AUTO_RED'
  | 'RLQ_AUTO_OFL'
  | 'RLQ_AUTO_GOLD'
  | 'RLQ_AUTO_GREEN_SHIMMER'
  | 'RLQ_AUTO_BLACK'
  // RPA rainbow
  | 'RLQ_RPA'
  | 'RLQ_RPA_OFL'
  | 'RLQ_RPA_WHITE'
  | 'RLQ_RPA_RED'
  | 'RLQ_RPA_GOLD'
  | 'RLQ_RPA_GOLD_SHIMMER'
  | 'RLQ_RPA_GREEN_SHIMMER'
  | 'RLQ_RPA_BLACK'
  // Gold Standard — its own checklist (base RC + numbered / auto / patch / RPA rainbows)
  | 'GS_RC'
  | 'GS_GOLD'
  | 'GS_GREEN'
  | 'GS_BLUE'
  | 'GS_PURPLE'
  | 'GS_RED'
  | 'GS_ORANGE'
  | 'GS_BLACK'
  | 'GS_GOLD_VINYL'
  | 'GS_SUPER'
  | 'GS_AUTO'
  | 'GS_AUTO_RED'
  | 'GS_AUTO_GOLD'
  | 'GS_AUTO_BLACK'
  | 'GS_AUTO_VINYL'
  | 'GS_AUTO_1OF1'
  | 'GS_PATCH'
  | 'GS_PATCH_RED'
  | 'GS_PATCH_GOLD'
  | 'GS_PATCH_BLACK'
  | 'GS_PATCH_VINYL'
  | 'GS_PATCH_1OF1'
  | 'GS_RPA'
  | 'GS_RPA_GOLD'
  | 'GS_RPA_BLACK'
  | 'GS_RPA_VINYL'
  | 'GS_RPA_1OF1';
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
  /** Rookie-only parallel (forces a rookie player, e.g. the RC base/patch). */
  rookie?: boolean;
  /** Counts as a "HIT" — drives the reveal flash and box hit guarantees. */
  hit?: boolean;
  /** Visual finish class suffix (`finish-<x>`) the web card renders. */
  finish?: string;
  /** Which lineup a parallel belongs to (gates the per-set fallback walk). */
  group?: 'generic' | 'artistry' | 'reliquary' | 'gold-standard';
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

  // ---- Reliquary: base rainbow ----
  { name: 'RLQ_RC', displayName: 'Base RC /99', printRun: 99, valueMultiplier: 2, refractor: false, rookie: true, finish: 'plain', group: 'reliquary', color: '#9aa3b2' },
  { name: 'RLQ_GREEN', displayName: 'Green /99', printRun: 99, valueMultiplier: 2.5, refractor: false, finish: 'plain', group: 'reliquary', color: '#3fae5e' },
  { name: 'RLQ_ORANGE', displayName: 'Orange /60', printRun: 60, valueMultiplier: 4, refractor: false, finish: 'plain', group: 'reliquary', color: '#f08a3c' },
  { name: 'RLQ_RED', displayName: 'Red /50', printRun: 50, valueMultiplier: 6, refractor: false, finish: 'plain', group: 'reliquary', color: '#e0564f' },
  { name: 'RLQ_OFL', displayName: 'OFL Logo /35', printRun: 35, valueMultiplier: 12, refractor: false, hit: true, finish: 'ofl', group: 'reliquary', color: '#c9a227' },
  { name: 'RLQ_WHITE', displayName: 'White /25', printRun: 25, valueMultiplier: 18, refractor: false, hit: true, finish: 'white', group: 'reliquary', color: '#eef2f8' },
  { name: 'RLQ_PINK', displayName: 'Pink /18', printRun: 18, valueMultiplier: 26, refractor: false, hit: true, finish: 'plain', group: 'reliquary', color: '#ec7fb0' },
  { name: 'RLQ_GOLD', displayName: 'Gold /10', printRun: 10, valueMultiplier: 45, refractor: false, hit: true, finish: 'gold', group: 'reliquary', color: '#f5b53d' },
  { name: 'RLQ_GOLD_SHIMMER', displayName: 'Gold Shimmer /8', printRun: 8, valueMultiplier: 70, refractor: true, hit: true, finish: 'gold', group: 'reliquary', color: '#ffcf6b' },
  { name: 'RLQ_GREEN_SHIMMER', displayName: 'Green Shimmer /3', printRun: 3, valueMultiplier: 150, refractor: true, hit: true, finish: 'plain', group: 'reliquary', color: '#6ee7a8' },
  { name: 'RLQ_BLACK', displayName: 'Black Finite 1/1', printRun: 1, valueMultiplier: 450, refractor: true, hit: true, finish: 'black', group: 'reliquary', color: '#0c0e12' },

  // ---- Reliquary: patch rainbow ----
  { name: 'RLQ_PATCH', displayName: 'Patch', printRun: null, valueMultiplier: 14, refractor: false, patched: true, hit: true, finish: 'patch', group: 'reliquary', color: '#94a3b8' },
  { name: 'RLQ_PATCH_RC', displayName: 'Patch RC /99', printRun: 99, valueMultiplier: 18, refractor: false, patched: true, rookie: true, hit: true, finish: 'patch', group: 'reliquary', color: '#9aa3b2' },
  { name: 'RLQ_PATCH_GREEN', displayName: 'Patch Green /99', printRun: 99, valueMultiplier: 20, refractor: false, patched: true, hit: true, finish: 'patch', group: 'reliquary', color: '#3fae5e' },
  { name: 'RLQ_PATCH_ORANGE', displayName: 'Patch Orange /60', printRun: 60, valueMultiplier: 28, refractor: false, patched: true, hit: true, finish: 'patch', group: 'reliquary', color: '#f08a3c' },
  { name: 'RLQ_PATCH_RED', displayName: 'Patch Red /50', printRun: 50, valueMultiplier: 36, refractor: false, patched: true, hit: true, finish: 'patch', group: 'reliquary', color: '#e0564f' },
  { name: 'RLQ_PATCH_OFL', displayName: 'Patch OFL Logo /35', printRun: 35, valueMultiplier: 55, refractor: false, patched: true, hit: true, finish: 'ofl', group: 'reliquary', color: '#c9a227' },
  { name: 'RLQ_PATCH_WHITE', displayName: 'Patch White /25', printRun: 25, valueMultiplier: 75, refractor: false, patched: true, hit: true, finish: 'white', group: 'reliquary', color: '#eef2f8' },
  { name: 'RLQ_PATCH_PINK', displayName: 'Patch Pink /18', printRun: 18, valueMultiplier: 100, refractor: false, patched: true, hit: true, finish: 'patch', group: 'reliquary', color: '#ec7fb0' },
  { name: 'RLQ_PATCH_GOLD', displayName: 'Patch Gold /10', printRun: 10, valueMultiplier: 150, refractor: false, patched: true, hit: true, finish: 'gold', group: 'reliquary', color: '#f5b53d' },
  { name: 'RLQ_PATCH_GOLD_SHIMMER', displayName: 'Patch Gold Shimmer /8', printRun: 8, valueMultiplier: 220, refractor: true, patched: true, hit: true, finish: 'gold', group: 'reliquary', color: '#ffcf6b' },
  { name: 'RLQ_PATCH_GREEN_SHIMMER', displayName: 'Patch Green Shimmer /3', printRun: 3, valueMultiplier: 400, refractor: true, patched: true, hit: true, finish: 'patch', group: 'reliquary', color: '#6ee7a8' },
  { name: 'RLQ_PATCH_BLACK', displayName: 'Black Finite OFL Patch 1/1', printRun: 1, valueMultiplier: 900, refractor: true, patched: true, hit: true, finish: 'black', group: 'reliquary', color: '#0c0e12' },

  // ---- Reliquary: autograph rainbow ----
  { name: 'RLQ_AUTO', displayName: 'Auto /99', printRun: 99, valueMultiplier: 120, refractor: false, signed: true, hit: true, finish: 'autogold', group: 'reliquary', color: '#e8c87a' },
  { name: 'RLQ_AUTO_ORANGE', displayName: 'Auto Orange /60', printRun: 60, valueMultiplier: 160, refractor: false, signed: true, hit: true, finish: 'autogold', group: 'reliquary', color: '#f08a3c' },
  { name: 'RLQ_AUTO_RED', displayName: 'Auto Red /50', printRun: 50, valueMultiplier: 200, refractor: false, signed: true, hit: true, finish: 'autogold', group: 'reliquary', color: '#e0564f' },
  { name: 'RLQ_AUTO_OFL', displayName: 'Auto OFL Logo /35', printRun: 35, valueMultiplier: 280, refractor: false, signed: true, hit: true, finish: 'ofl', group: 'reliquary', color: '#c9a227' },
  { name: 'RLQ_AUTO_GOLD', displayName: 'Auto Gold /10', printRun: 10, valueMultiplier: 450, refractor: false, signed: true, hit: true, finish: 'gold', group: 'reliquary', color: '#f5b53d' },
  { name: 'RLQ_AUTO_GREEN_SHIMMER', displayName: 'Auto Green Shimmer /3', printRun: 3, valueMultiplier: 800, refractor: true, signed: true, hit: true, finish: 'autogold', group: 'reliquary', color: '#6ee7a8' },
  { name: 'RLQ_AUTO_BLACK', displayName: 'Auto Black Finite 1/1', printRun: 1, valueMultiplier: 1400, refractor: true, signed: true, hit: true, finish: 'black', group: 'reliquary', color: '#0c0e12' },

  // ---- Reliquary: Rookie Patch Auto rainbow ----
  { name: 'RLQ_RPA', displayName: 'RPA /50', printRun: 50, valueMultiplier: 300, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#cdd5e2' },
  { name: 'RLQ_RPA_OFL', displayName: 'RPA OFL Logo /35', printRun: 35, valueMultiplier: 420, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#c9a227' },
  { name: 'RLQ_RPA_WHITE', displayName: 'RPA White /25', printRun: 25, valueMultiplier: 560, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#eef2f8' },
  { name: 'RLQ_RPA_RED', displayName: 'RPA Red /15', printRun: 15, valueMultiplier: 750, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#e0564f' },
  { name: 'RLQ_RPA_GOLD', displayName: 'RPA Gold /10', printRun: 10, valueMultiplier: 950, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#f5b53d' },
  { name: 'RLQ_RPA_GOLD_SHIMMER', displayName: 'RPA Gold Shimmer /8', printRun: 8, valueMultiplier: 1200, refractor: true, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#ffcf6b' },
  { name: 'RLQ_RPA_GREEN_SHIMMER', displayName: 'RPA Green Shimmer /3', printRun: 3, valueMultiplier: 1800, refractor: true, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#6ee7a8' },
  { name: 'RLQ_RPA_BLACK', displayName: 'RPA Black Finite OFL Patch 1/1', printRun: 1, valueMultiplier: 3000, refractor: true, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'reliquary', color: '#0c0e12' },

  // ---- Gold Standard: base RC + numbered colour rainbow ----
  { name: 'GS_RC', displayName: 'Rookie /399', printRun: 399, valueMultiplier: 2.5, refractor: false, rookie: true, finish: 'plain', group: 'gold-standard', color: '#cdd5e2' },
  { name: 'GS_GOLD', displayName: 'Gold /299', printRun: 299, valueMultiplier: 2, refractor: false, finish: 'gold', group: 'gold-standard', color: '#f5b53d' },
  { name: 'GS_GREEN', displayName: 'Green /199', printRun: 199, valueMultiplier: 3, refractor: false, finish: 'plain', group: 'gold-standard', color: '#3fae5e' },
  { name: 'GS_BLUE', displayName: 'Blue /149', printRun: 149, valueMultiplier: 4, refractor: false, finish: 'plain', group: 'gold-standard', color: '#4f8fe0' },
  { name: 'GS_PURPLE', displayName: 'Purple /99', printRun: 99, valueMultiplier: 6, refractor: false, finish: 'plain', group: 'gold-standard', color: '#a855f7' },
  { name: 'GS_RED', displayName: 'Red /49', printRun: 49, valueMultiplier: 12, refractor: false, finish: 'plain', group: 'gold-standard', color: '#e0564f' },
  { name: 'GS_ORANGE', displayName: 'Orange /25', printRun: 25, valueMultiplier: 20, refractor: false, hit: true, finish: 'plain', group: 'gold-standard', color: '#f08a3c' },
  { name: 'GS_BLACK', displayName: 'Black /10', printRun: 10, valueMultiplier: 45, refractor: false, hit: true, finish: 'black', group: 'gold-standard', color: '#0c0e12' },
  { name: 'GS_GOLD_VINYL', displayName: 'Gold Vinyl /5', printRun: 5, valueMultiplier: 90, refractor: true, hit: true, finish: 'gold', group: 'gold-standard', color: '#ffcf6b' },
  { name: 'GS_SUPER', displayName: 'Superfractor 1/1', printRun: 1, valueMultiplier: 400, refractor: true, hit: true, finish: 'gold', group: 'gold-standard', color: '#f5b53d' },

  // ---- Gold Standard: autograph rainbow ----
  { name: 'GS_AUTO', displayName: 'Auto /99', printRun: 99, valueMultiplier: 60, refractor: false, signed: true, hit: true, finish: 'autogold', group: 'gold-standard', color: '#e8c87a' },
  { name: 'GS_AUTO_RED', displayName: 'Auto Red /49', printRun: 49, valueMultiplier: 100, refractor: false, signed: true, hit: true, finish: 'autogold', group: 'gold-standard', color: '#e0564f' },
  { name: 'GS_AUTO_GOLD', displayName: 'Auto Gold /25', printRun: 25, valueMultiplier: 150, refractor: false, signed: true, hit: true, finish: 'gold', group: 'gold-standard', color: '#f5b53d' },
  { name: 'GS_AUTO_BLACK', displayName: 'Auto Black /10', printRun: 10, valueMultiplier: 250, refractor: false, signed: true, hit: true, finish: 'black', group: 'gold-standard', color: '#0c0e12' },
  { name: 'GS_AUTO_VINYL', displayName: 'Auto Gold Vinyl /5', printRun: 5, valueMultiplier: 450, refractor: true, signed: true, hit: true, finish: 'gold', group: 'gold-standard', color: '#ffcf6b' },
  { name: 'GS_AUTO_1OF1', displayName: 'Auto Superfractor 1/1', printRun: 1, valueMultiplier: 900, refractor: true, signed: true, hit: true, finish: 'black', group: 'gold-standard', color: '#0c0e12' },

  // ---- Gold Standard: patch rainbow ----
  { name: 'GS_PATCH', displayName: 'Patch /99', printRun: 99, valueMultiplier: 30, refractor: false, patched: true, hit: true, finish: 'patch', group: 'gold-standard', color: '#94a3b8' },
  { name: 'GS_PATCH_RED', displayName: 'Patch Red /49', printRun: 49, valueMultiplier: 50, refractor: false, patched: true, hit: true, finish: 'patch', group: 'gold-standard', color: '#e0564f' },
  { name: 'GS_PATCH_GOLD', displayName: 'Patch Gold /25', printRun: 25, valueMultiplier: 80, refractor: false, patched: true, hit: true, finish: 'gold', group: 'gold-standard', color: '#f5b53d' },
  { name: 'GS_PATCH_BLACK', displayName: 'Patch Black /10', printRun: 10, valueMultiplier: 150, refractor: false, patched: true, hit: true, finish: 'black', group: 'gold-standard', color: '#0c0e12' },
  { name: 'GS_PATCH_VINYL', displayName: 'Patch Gold Vinyl /5', printRun: 5, valueMultiplier: 280, refractor: true, patched: true, hit: true, finish: 'gold', group: 'gold-standard', color: '#ffcf6b' },
  { name: 'GS_PATCH_1OF1', displayName: 'Patch Superfractor 1/1', printRun: 1, valueMultiplier: 600, refractor: true, patched: true, hit: true, finish: 'black', group: 'gold-standard', color: '#0c0e12' },

  // ---- Gold Standard: Rookie Patch Auto rainbow (random slot only) ----
  { name: 'GS_RPA', displayName: 'RPA /49', printRun: 49, valueMultiplier: 120, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'gold-standard', color: '#cdd5e2' },
  { name: 'GS_RPA_GOLD', displayName: 'RPA Gold /25', printRun: 25, valueMultiplier: 200, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'gold-standard', color: '#f5b53d' },
  { name: 'GS_RPA_BLACK', displayName: 'RPA Black /10', printRun: 10, valueMultiplier: 350, refractor: false, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'gold-standard', color: '#0c0e12' },
  { name: 'GS_RPA_VINYL', displayName: 'RPA Gold Vinyl /5', printRun: 5, valueMultiplier: 600, refractor: true, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'gold-standard', color: '#ffcf6b' },
  { name: 'GS_RPA_1OF1', displayName: 'RPA Superfractor 1/1', printRun: 1, valueMultiplier: 1200, refractor: true, signed: true, patched: true, rpa: true, hit: true, finish: 'rpa', group: 'gold-standard', color: '#e0b85a' },
];

export const PARALLEL_NAMES: ParallelName[] = PARALLELS.map((p) => p.name);

/** Rarest first — used for the sold-out fallback walk down toward Base. */
export const PARALLELS_BY_RARITY_DESC: ParallelName[] = [...PARALLEL_NAMES].reverse();

// Per-set parallel lineups (most common -> rarest). A set not listed here uses
// the generic lineup. Artistry runs its own numbered rainbow + auto + RPA tiers.
const GENERIC_ORDER: ParallelName[] = PARALLELS.filter((p) => p.group === 'generic').map((p) => p.name);
const ARTISTRY_ORDER: ParallelName[] = ['BASE', ...PARALLELS.filter((p) => p.group === 'artistry').map((p) => p.name)];
const RELIQUARY_ORDER: ParallelName[] = ['BASE', ...PARALLELS.filter((p) => p.group === 'reliquary').map((p) => p.name)];
const GOLD_STANDARD_ORDER: ParallelName[] = ['BASE', ...PARALLELS.filter((p) => p.group === 'gold-standard').map((p) => p.name)];
export const SET_PARALLEL_ORDER: Record<string, ParallelName[]> = {
  artistry: ARTISTRY_ORDER,
  reliquary: RELIQUARY_ORDER,
  'gold-standard': GOLD_STANDARD_ORDER,
};

// Reliquary packs aren't a flat weighted roll — each pack is a fixed run of
// slots, every slot drawing from its own category sub-pool.
export type ReliquarySlot = 'base' | 'base_rookie' | 'numbered' | 'auto' | 'patch' | 'rpa';
export const RELIQUARY_PACK: ReliquarySlot[] = [
  'base', 'base_rookie', 'numbered', 'numbered', 'numbered', 'auto', 'auto', 'patch', 'patch', 'rpa',
];
const rlqPool = (pred: (p: ParallelDef) => boolean): ParallelName[] =>
  PARALLELS.filter((p) => p.group === 'reliquary' && pred(p)).map((p) => p.name);
/** The parallels each Reliquary pack slot can yield. */
export const RELIQUARY_SLOT_POOLS: Record<ReliquarySlot, ParallelName[]> = {
  base: ['BASE'],
  base_rookie: ['RLQ_RC'],
  numbered: rlqPool((p) => !p.signed && !p.patched && !p.rpa), // base colour rainbow (incl. RC)
  auto: rlqPool((p) => !!p.signed && !p.patched),              // autograph rainbow
  patch: rlqPool((p) => !!p.patched && !p.signed),             // patch rainbow
  rpa: rlqPool((p) => !!p.rpa),                                // rookie patch auto rainbow
};

// Gold Standard pack: also a fixed slot run (8 cards) drawing from its own
// checklist — base x2, a rookie RC /399, two numbered, an auto, a patch, and a
// "random" finale that can be any auto / patch / RPA.
export const GOLD_STANDARD_PACK: string[] = [
  'base', 'base', 'rookie', 'numbered', 'numbered', 'auto', 'patch', 'random',
];
const gsPool = (pred: (p: ParallelDef) => boolean): ParallelName[] =>
  PARALLELS.filter((p) => p.group === 'gold-standard' && pred(p)).map((p) => p.name);
export const GOLD_STANDARD_SLOT_POOLS: Record<string, ParallelName[]> = {
  base: ['BASE'],
  rookie: gsPool((p) => !!p.rookie),                                // GS_RC /399
  numbered: gsPool((p) => !p.signed && !p.patched && !p.rookie),    // numbered colour rainbow
  auto: gsPool((p) => !!p.signed && !p.patched),                    // autograph rainbow
  patch: gsPool((p) => !!p.patched && !p.signed),                   // patch rainbow
  random: gsPool((p) => !!p.signed || !!p.patched),                 // any auto / patch / RPA
};

// Sets that open as a fixed slot run (vs a flat weighted roll). The engine reads
// this to pick each slot's parallel from its own category sub-pool.
export interface SetPackStructure {
  pack: string[];
  pools: Record<string, ParallelName[]>;
}
export const SET_PACK_STRUCTURE: Record<string, SetPackStructure> = {
  reliquary: { pack: RELIQUARY_PACK, pools: RELIQUARY_SLOT_POOLS },
  'gold-standard': { pack: GOLD_STANDARD_PACK, pools: GOLD_STANDARD_SLOT_POOLS },
};
export function packStructureForSet(setKey: string | null | undefined): SetPackStructure | null {
  return SET_PACK_STRUCTURE[setKey ?? ''] ?? null;
}

/**
 * Box cap for the limited Reliquary print run. Each pack draws a fixed number of
 * cards from each category, so the supply that runs out first sets the cap: for
 * every constraining (fully-numbered) category we take floor(players * supply /
 * draws-per-pack) and keep the smallest. Categories with an unnumbered member
 * (the base Patch) never constrain. This keeps the chase from being drained into
 * base-card fallback before the boxes sell out.
 */
export function reliquaryBoxCap(playerCount: number): number {
  const drawsPerSlot: Record<string, number> = {};
  for (const slot of RELIQUARY_PACK) drawsPerSlot[slot] = (drawsPerSlot[slot] ?? 0) + 1;
  // base_rookie draws from the same base-rainbow supply as the numbered slots.
  const groups: { pool: ParallelName[]; draws: number }[] = [
    { pool: RELIQUARY_SLOT_POOLS.numbered, draws: (drawsPerSlot.numbered ?? 0) + (drawsPerSlot.base_rookie ?? 0) },
    { pool: RELIQUARY_SLOT_POOLS.auto, draws: drawsPerSlot.auto ?? 0 },
    { pool: RELIQUARY_SLOT_POOLS.patch, draws: drawsPerSlot.patch ?? 0 },
    { pool: RELIQUARY_SLOT_POOLS.rpa, draws: drawsPerSlot.rpa ?? 0 },
  ];
  let cap = Infinity;
  for (const { pool, draws } of groups) {
    if (draws <= 0) continue;
    const defs = pool.map((n) => PARALLELS.find((p) => p.name === n)!);
    if (defs.some((d) => d.printRun == null)) continue; // unlimited member -> no constraint
    const supply = defs.reduce((s, d) => s + (d.printRun ?? 0), 0);
    cap = Math.min(cap, Math.floor((playerCount * supply) / draws));
  }
  return Number.isFinite(cap) ? cap : 0;
}

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

// ---- Set completion (the Collection / "Sets" tracker) ----
// Completion is tracked per TEAM within a set: own the BASE card of every player
// on a team (in that set's theme) to claim that team's small gem reward. Gems are
// the only way to earn the premium currency, and deliberately hard to accrue.
// Reliquary (no base cards) and the legacy sets are intentionally not tracked.
export const TRACKED_SETS: SetKey[] = ['spark', 'momentum', 'artistry', 'gold-standard'];

/** Gems awarded for completing one team's base checklist within a set. Kept small
 * on purpose — finishing a whole set is a long grind. Tunable economy knob. */
export const TEAM_SET_GEMS: Record<string, number> = {
  spark: 2,
  momentum: 3,
  artistry: 5,
  'gold-standard': 8,
};

export function gemsForTeamSet(setKey: string | null | undefined): number {
  return TEAM_SET_GEMS[setKey ?? ''] ?? 0;
}

export function isTrackedSet(setKey: string | null | undefined): boolean {
  return TRACKED_SETS.includes((setKey ?? '') as SetKey);
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

// Competitive rank ladder derived from rating.
export function division(rating: number): string {
  if (rating >= 1600) return 'Diamond';
  if (rating >= 1400) return 'Platinum';
  if (rating >= 1200) return 'Gold';
  if (rating >= 1050) return 'Silver';
  return 'Bronze';
}
