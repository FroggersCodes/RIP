import { describe, expect, it } from 'vitest';
import { computeMarketValue, isEligibleForRole, serialPremium } from '@rip/shared';
import { applyValueChange, WEEKLY_CAP } from '../src/league/valuation';
import { tierForStreak } from '../src/daily/dailyConfig';
import {
  HOURLY_CAP_HOURS,
  HOURLY_MAX_COINS,
  HOURLY_RATE,
  HOUR_MS,
  LOGIN_MAX_COINS,
  hourlyState,
  loginReward,
  nextLoginStreak,
  upcomingLoginRewards,
} from '../src/rewards/rewardsConfig';

describe('valuation caps', () => {
  it('caps weekly gains at +15%', () => {
    const r = applyValueChange(100, 1000, 5); // enormous beat vs expectation
    expect(r.pct).toBeCloseTo(WEEKLY_CAP);
    expect(r.newValue).toBeCloseTo(115);
  });
  it('caps weekly losses at -15% and never drops below 1', () => {
    const r = applyValueChange(100, 0, 50);
    expect(r.pct).toBeCloseTo(-WEEKLY_CAP);
    expect(r.newValue).toBeCloseTo(85);
    expect(applyValueChange(1, 0, 50).newValue).toBeGreaterThanOrEqual(1);
  });
});

describe('daily tier milestones', () => {
  it('upgrades at day 7 and day 30', () => {
    expect(tierForStreak(1).name).toBe('Daily Standard');
    expect(tierForStreak(6).name).toBe('Daily Standard');
    expect(tierForStreak(7).name).toBe('Daily Hot Streak');
    expect(tierForStreak(29).name).toBe('Daily Hot Streak');
    expect(tierForStreak(30).name).toBe('Daily Legend');
    expect(tierForStreak(100).name).toBe('Daily Legend');
  });
});

describe('lineup eligibility', () => {
  it('restricts slots to eligible positions; FLEX excludes QB', () => {
    expect(isEligibleForRole('QB', 'QB')).toBe(true);
    expect(isEligibleForRole('RB', 'QB')).toBe(false);
    expect(isEligibleForRole('WR1', 'WR')).toBe(true);
    expect(isEligibleForRole('FLEX', 'RB')).toBe(true);
    expect(isEligibleForRole('FLEX', 'WR')).toBe(true);
    expect(isEligibleForRole('FLEX', 'TE')).toBe(true);
    expect(isEligibleForRole('FLEX', 'QB')).toBe(false);
  });
});

describe('market value', () => {
  it('applies the low-serial premium', () => {
    expect(serialPremium(1, 250)).toBe(1.5);
    expect(serialPremium(5, 250)).toBe(1.15);
    expect(serialPremium(null, null)).toBe(1);
    expect(computeMarketValue(10, 15, 1, 250)).toBe(225); // 10 * 15 * 1.5
    expect(computeMarketValue(10, 1, null, null)).toBe(10);
  });
});

describe('hourly coins', () => {
  const base = new Date('2026-06-30T00:00:00Z');

  it('pays nothing until a whole hour passes', () => {
    expect(hourlyState(base, new Date(base.getTime() + 59 * 60 * 1000)).canClaim).toBe(false);
    const oneHour = hourlyState(base, new Date(base.getTime() + HOUR_MS));
    expect(oneHour.canClaim).toBe(true);
    expect(oneHour.coins).toBe(HOURLY_RATE);
  });

  it('accrues per whole hour and preserves the sub-hour remainder', () => {
    const s = hourlyState(base, new Date(base.getTime() + 3 * HOUR_MS + 40 * 60 * 1000));
    expect(s.bankedHours).toBe(3);
    expect(s.coins).toBe(3 * HOURLY_RATE);
    // baseline advances exactly 3h, leaving the 40m remainder still counting.
    expect(s.newBaseline.getTime()).toBe(base.getTime() + 3 * HOUR_MS);
    expect(s.maxedOut).toBe(false);
  });

  it('caps the bank and forfeits overflow by restarting the clock at now', () => {
    const now = new Date(base.getTime() + 30 * HOUR_MS);
    const s = hourlyState(base, now);
    expect(s.bankedHours).toBe(HOURLY_CAP_HOURS);
    expect(s.coins).toBe(HOURLY_MAX_COINS);
    expect(s.maxedOut).toBe(true);
    expect(s.newBaseline.getTime()).toBe(now.getTime());
    expect(s.nextClaimAt).toBeNull();
  });
});

describe('daily login reward', () => {
  it('grows with the streak and caps the coins', () => {
    expect(loginReward(1).coins).toBe(100);
    expect(loginReward(2).coins).toBe(125);
    expect(loginReward(100).coins).toBe(LOGIN_MAX_COINS);
  });

  it('drops gems every 7th day, escalating by 5 then holding past 30 days', () => {
    expect(loginReward(6).gems).toBe(0);
    expect(loginReward(7).gems).toBe(5);
    expect(loginReward(14).gems).toBe(10);
    expect(loginReward(21).gems).toBe(15);
    expect(loginReward(28).gems).toBe(20);
    expect(loginReward(35).gems).toBe(20); // past 30 days -> holds flat
    expect(loginReward(70).gems).toBe(20);
  });

  it('awards an escalating pack every 4th day, never past Artistry', () => {
    expect(loginReward(1).packSetKey).toBeNull();
    expect(loginReward(3).packSetKey).toBeNull();
    expect(loginReward(4).packSetKey).toBe('spark');
    expect(loginReward(8).packSetKey).toBe('momentum');
    expect(loginReward(12).packSetKey).toBe('artistry');
    expect(loginReward(16).packSetKey).toBe('artistry'); // capped at artistry
    expect(loginReward(100).packSetKey).toBe('artistry');
  });

  it('continues the streak within the window and resets after a missed day', () => {
    const last = new Date('2026-06-30T00:00:00Z');
    expect(nextLoginStreak(null, 0, last)).toBe(1);
    expect(nextLoginStreak(last, 4, new Date(last.getTime() + 25 * HOUR_MS))).toBe(5); // next day
    expect(nextLoginStreak(last, 4, new Date(last.getTime() + 50 * HOUR_MS))).toBe(1); // missed a day
  });

  it('previews the upcoming days starting from the next claim', () => {
    const days = upcomingLoginRewards(3, 5); // days 3,4,5,6,7
    expect(days.map((d) => d.day)).toEqual([3, 4, 5, 6, 7]);
    expect(days[1]!.reward.packSetKey).toBe('spark'); // day 4
    expect(days[4]!.reward.gems).toBe(5); // day 7
    expect(days).toHaveLength(5);
  });
});
