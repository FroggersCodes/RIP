import { describe, expect, it } from 'vitest';
import { computeMarketValue, isEligibleForRole, serialPremium } from '@rip/shared';
import { applyValueChange, WEEKLY_CAP } from '../src/league/valuation';
import { tierForStreak } from '../src/daily/dailyConfig';

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
