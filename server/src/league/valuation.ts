import type { Position } from '@rip/shared';

// Per-position expected fantasy output, scaled by rating. Performance above
// expectation pushes value up; below pushes it down.
const EXPECTED_BASE: Record<Position, number> = { QB: 14, RB: 10, WR: 9, TE: 6 };

export function expectedFantasy(position: Position, rating: number): number {
  return Math.max(0, (EXPECTED_BASE[position] ?? 8) + (rating - 75) * 0.35);
}

// Per-week change is capped so values move but don't whipsaw.
export const WEEKLY_CAP = 0.15;
const SENSITIVITY = 0.012; // a ~12.5pt beat/miss vs expectation hits the cap
const MIN_VALUE = 1;

export function applyValueChange(
  currentValue: number,
  performanceScore: number,
  expected: number,
): { newValue: number; pct: number } {
  const delta = performanceScore - expected;
  const pct = Math.max(-WEEKLY_CAP, Math.min(WEEKLY_CAP, delta * SENSITIVITY));
  const newValue = Math.max(MIN_VALUE, Math.round(currentValue * (1 + pct) * 100) / 100);
  return { newValue, pct };
}

// Rating-implied baseline value (mirrors the seed). Used to mean-revert values
// at season rollover so they move during a season but don't run away over years.
export function baselineValue(rating: number): number {
  return Math.round((Math.pow(Math.max(rating - 55, 1) / 44, 2.2) * 75 + 3) * 100) / 100;
}

export const OFFSEASON_REGRESSION = 0.25;
