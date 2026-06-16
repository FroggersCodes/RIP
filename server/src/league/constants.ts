export const REGULAR_SEASON_WEEKS = 14;
export const PLAYOFF_TEAMS = 8;

// Playoff rounds in order, one per week after the regular season.
export const PLAYOFF_ROUNDS = ['QF', 'SF', 'FINAL'] as const;
export type Round = 'REGULAR' | (typeof PLAYOFF_ROUNDS)[number];

export const SEASON_WEEKS = REGULAR_SEASON_WEEKS + PLAYOFF_ROUNDS.length; // 17

export const ROUND_LABEL: Record<string, string> = {
  REGULAR: 'Regular Season',
  QF: 'Quarterfinal',
  SF: 'Semifinal',
  FINAL: 'Championship',
};

export function weekPhase(weekNumber: number): 'REGULAR' | 'PLAYOFFS' {
  return weekNumber <= REGULAR_SEASON_WEEKS ? 'REGULAR' : 'PLAYOFFS';
}

/** QF/SF/FINAL for a playoff week, or null for a regular-season week. */
export function playoffRoundForWeek(weekNumber: number): Exclude<Round, 'REGULAR'> | null {
  const idx = weekNumber - REGULAR_SEASON_WEEKS - 1;
  if (idx < 0 || idx >= PLAYOFF_ROUNDS.length) return null;
  return PLAYOFF_ROUNDS[idx]!;
}
