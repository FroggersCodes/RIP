// The daily pack is free but server-rolled with real serial allocation. Tier
// improves at streak milestones (day 7, day 30).

export interface DailyTier {
  name: string;
  minStreak: number;
  cards: number;
  tokenReward: number;
  caseReward: number;
  topPlayerBias: number;
  pullRates: Record<string, number>;
}

export const DAILY_TIERS: DailyTier[] = [
  {
    name: 'Daily Standard',
    minStreak: 0,
    cards: 3,
    tokenReward: 60,
    caseReward: 0,
    topPlayerBias: 0.35,
    pullRates: { BASE: 860, BLUE: 100, PURPLE: 28, GOLD: 8, BLACK: 2.5, EMERALD: 0.7, SUPERFRACTOR: 0.15 },
  },
  {
    name: 'Daily Hot Streak',
    minStreak: 7,
    cards: 4,
    tokenReward: 90,
    caseReward: 0,
    topPlayerBias: 0.5,
    pullRates: { BASE: 780, BLUE: 140, PURPLE: 45, GOLD: 18, BLACK: 7, EMERALD: 2.5, SUPERFRACTOR: 0.4 },
  },
  {
    name: 'Daily Legend',
    minStreak: 30,
    cards: 5,
    tokenReward: 150,
    caseReward: 1,
    topPlayerBias: 0.65,
    pullRates: { BASE: 640, BLUE: 200, PURPLE: 95, GOLD: 45, BLACK: 16, EMERALD: 5, SUPERFRACTOR: 1.2 },
  },
];

export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const STREAK_RESET_WINDOW_MS = 48 * 60 * 60 * 1000;

export function tierForStreak(streak: number): DailyTier {
  let chosen = DAILY_TIERS[0]!;
  for (const tier of DAILY_TIERS) if (streak >= tier.minStreak) chosen = tier;
  return chosen;
}

export function nextTier(streak: number): DailyTier | null {
  return DAILY_TIERS.find((t) => t.minStreak > streak) ?? null;
}
