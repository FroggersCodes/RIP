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
export const HOURLY_RATE = 50;
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
// Every 7th consecutive day also drops a case.
export const LOGIN_CASE_EVERY = 7;

export interface LoginReward {
  coins: number;
  cases: number;
}

/** Coins (and the occasional case) for landing on a given streak day. */
export function loginReward(streak: number): LoginReward {
  const day = Math.max(1, streak);
  const coins = Math.min(LOGIN_BASE_COINS + (day - 1) * LOGIN_COINS_PER_DAY, LOGIN_MAX_COINS);
  const cases = day % LOGIN_CASE_EVERY === 0 ? 1 : 0;
  return { coins, cases };
}

/** The streak you'd land on by claiming now, given your last claim + streak. */
export function nextLoginStreak(last: Date | null, currentStreak: number, now: Date): number {
  if (!last) return 1;
  return now.getTime() - last.getTime() < LOGIN_STREAK_RESET_MS ? currentStreak + 1 : 1;
}
