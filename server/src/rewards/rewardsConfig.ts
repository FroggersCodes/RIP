// Two lightweight coin faucets that sit alongside the daily *pack* (see
// daily/dailyConfig.ts): an hourly coin drip and a once-a-day login reward that
// grows with a consecutive-day login streak. Coins == tokens, the soft currency.
//
// Everything here is pure so it can be unit-tested without a database; the route
// layer (http/routes/rewards.ts) does the race-safe persistence.

export const HOUR_MS = 60 * 60 * 1000;

// ---- Hourly coins -------------------------------------------------------------
// You earn HOURLY_RATE coins per elapsed hour, accruing while you're away up to
// HOURLY_CAP_HOURS so logging back in feels rewarding without being farmable.
export const HOURLY_RATE = 100;
export const HOURLY_CAP_HOURS = 12;
export const HOURLY_MAX_COINS = HOURLY_RATE * HOURLY_CAP_HOURS;

export interface HourlyState {
  /** Coins available to claim right now. */
  coins: number;
  /** Whole hours that have accrued (capped). */
  bankedHours: number;
  /** True once the bank is at the cap — overflow beyond this is forfeited. */
  maxedOut: boolean;
  canClaim: boolean;
  /** Where the accrual clock should be set to after claiming what's available. */
  newBaseline: Date;
  /** ISO time the next whole hour finishes accruing (null when already maxed). */
  nextClaimAt: Date | null;
}

/**
 * Compute hourly accrual. `baseline` is the user's lastHourlyClaimAt, or their
 * account createdAt when they've never claimed (so a brand-new clock starts at
 * sign-up rather than handing out a free bank).
 */
export function hourlyState(baseline: Date, now: Date): HourlyState {
  const elapsedMs = Math.max(0, now.getTime() - baseline.getTime());
  const elapsedHours = Math.floor(elapsedMs / HOUR_MS);
  const bankedHours = Math.min(elapsedHours, HOURLY_CAP_HOURS);
  const maxedOut = elapsedHours >= HOURLY_CAP_HOURS;

  // When over the cap we forfeit the overflow and restart the clock at `now`.
  // Otherwise advance by the whole hours claimed, preserving the sub-hour
  // remainder so partial progress isn't lost.
  const newBaseline = maxedOut
    ? new Date(now.getTime())
    : new Date(baseline.getTime() + bankedHours * HOUR_MS);

  const nextClaimAt = maxedOut ? null : new Date(newBaseline.getTime() + HOUR_MS);

  return {
    coins: bankedHours * HOURLY_RATE,
    bankedHours,
    maxedOut,
    canClaim: bankedHours >= 1,
    newBaseline,
    nextClaimAt,
  };
}

// ---- Daily login reward -------------------------------------------------------
export const DAILY_LOGIN_COOLDOWN_MS = 24 * HOUR_MS;
// Miss a full day (no claim within this window of the last) and the streak resets.
export const LOGIN_STREAK_RESET_MS = 48 * HOUR_MS;

export const LOGIN_BASE_COINS = 100;
export const LOGIN_COINS_PER_DAY = 25;
export const LOGIN_MAX_COINS = 500;

// Gems land every 7th consecutive day, starting at 5 and climbing by 5 each
// milestone (day 7 → 5, 14 → 10, 21 → 15, 28 → 20) and then holding flat once
// the streak passes 30 days.
export const GEM_EVERY = 7;
export const GEM_STEP = 5;
export const GEM_ESCALATE_UNTIL_DAY = 30;
const GEM_MAX_STEPS = Math.floor(GEM_ESCALATE_UNTIL_DAY / GEM_EVERY); // 4 → caps at 20 gems

// A free pack drops every 4th consecutive day. The set escalates with the streak
// but never climbs past Artistry: day 4 → Spark, day 8 → Momentum, day 12+ → Artistry.
export const PACK_EVERY = 4;
export const PACK_LADDER = ['spark', 'momentum', 'artistry'] as const;

export interface LoginReward {
  coins: number;
  gems: number;
  /** Set key of the free pack this day awards, or null on non-pack days. */
  packSetKey: string | null;
}

/** Gems awarded on a given streak day (0 on non-milestone days). */
export function loginGems(day: number): number {
  if (day <= 0 || day % GEM_EVERY !== 0) return 0;
  return GEM_STEP * Math.min(day / GEM_EVERY, GEM_MAX_STEPS);
}

/** The set key of the free pack for a given streak day, or null on non-pack days. */
export function loginPackSetKey(day: number): string | null {
  if (day <= 0 || day % PACK_EVERY !== 0) return null;
  const rung = Math.min(day / PACK_EVERY - 1, PACK_LADDER.length - 1);
  return PACK_LADDER[rung]!;
}

/** Coins, gems, and any free pack for landing on a given streak day. */
export function loginReward(streak: number): LoginReward {
  const day = Math.max(1, streak);
  const coins = Math.min(LOGIN_BASE_COINS + (day - 1) * LOGIN_COINS_PER_DAY, LOGIN_MAX_COINS);
  return { coins, gems: loginGems(day), packSetKey: loginPackSetKey(day) };
}

/** The streak you'd land on by claiming now, given your last claim + streak. */
export function nextLoginStreak(last: Date | null, currentStreak: number, now: Date): number {
  if (!last) return 1;
  return now.getTime() - last.getTime() < LOGIN_STREAK_RESET_MS ? currentStreak + 1 : 1;
}
