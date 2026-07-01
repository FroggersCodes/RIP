// Weekly lineup-league prizes. The league is the skill-based earn loop: finishing
// near the top of the weekly fantasy standings is the main way to win cases and —
// crucially — gems (the premium currency you otherwise only trickle in from daily
// rewards and set completion). Fielding any lineup at all pays a small floor.

export interface Payout {
  tokens: number;
  cases: number;
  gems: number;
}

export const ZERO_PAYOUT: Payout = { tokens: 0, cases: 0, gems: 0 };

/**
 * Prize for finishing `rank` (1-indexed) out of `totalPlayers` scored lineups
 * this week. Everyone who fielded a lineup and put up points gets at least the
 * participation floor.
 */
export function weeklyPayout(rank: number, _totalPlayers: number): Payout {
  if (rank === 1) return { tokens: 1000, cases: 3, gems: 3 };
  if (rank === 2) return { tokens: 600, cases: 2, gems: 2 };
  if (rank === 3) return { tokens: 400, cases: 1, gems: 1 };
  if (rank <= 5) return { tokens: 250, cases: 1, gems: 0 };
  if (rank <= 10) return { tokens: 150, cases: 0, gems: 0 };
  return { tokens: 60, cases: 0, gems: 0 };
}

/** Human-readable prize summary, e.g. "1,000🪙 · 3 cases · 3💎". */
export function payoutLabel(p: Payout): string {
  const parts = [
    p.tokens ? `${p.tokens.toLocaleString()}🪙` : null,
    p.cases ? `${p.cases} case${p.cases > 1 ? 's' : ''}` : null,
    p.gems ? `${p.gems}💎` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

/** Rating-ladder movement for finishing `rank` of `totalPlayers`. Top third climbs,
 * bottom third slides, middle holds roughly flat. */
export function ratingDelta(rank: number, totalPlayers: number): number {
  const frac = totalPlayers > 1 ? (rank - 1) / (totalPlayers - 1) : 0;
  return frac <= 0.34 ? 12 : frac >= 0.66 ? -8 : 2;
}
