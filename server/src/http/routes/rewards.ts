import { Router } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { withTxRetry } from '../../db/withTxRetry';
import { grant } from '../../economy/wallet';
import { publicUser } from '../serialize';
import {
  DAILY_LOGIN_COOLDOWN_MS,
  HOURLY_CAP_HOURS,
  HOURLY_MAX_COINS,
  HOURLY_RATE,
  hourlyState,
  loginReward,
  nextLoginStreak,
} from '../../rewards/rewardsConfig';

const router = Router();

/** lastHourlyClaimAt, or createdAt for users who've never claimed. */
function hourlyBaseline(user: User): Date {
  return user.lastHourlyClaimAt ?? user.createdAt;
}

function statusFor(user: User) {
  const now = new Date();
  const hourly = hourlyState(hourlyBaseline(user), now);

  const lastLogin = user.lastLoginRewardAt;
  const dailyCanClaim = !lastLogin || now.getTime() >= lastLogin.getTime() + DAILY_LOGIN_COOLDOWN_MS;
  const upcomingStreak = nextLoginStreak(lastLogin, user.loginStreak, now);

  return {
    hourly: {
      canClaim: hourly.canClaim,
      coins: hourly.coins,
      ratePerHour: HOURLY_RATE,
      capHours: HOURLY_CAP_HOURS,
      maxCoins: HOURLY_MAX_COINS,
      bankedHours: hourly.bankedHours,
      maxedOut: hourly.maxedOut,
      nextClaimAt: hourly.nextClaimAt ? hourly.nextClaimAt.toISOString() : null,
    },
    daily: {
      canClaim: dailyCanClaim,
      streak: user.loginStreak,
      nextClaimAt: lastLogin ? new Date(lastLogin.getTime() + DAILY_LOGIN_COOLDOWN_MS).toISOString() : null,
      // What claiming right now would award, and the day-after that to tease the streak.
      reward: loginReward(upcomingStreak),
      nextReward: loginReward(upcomingStreak + 1),
    },
  };
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
    res.json(statusFor(user));
  }),
);

router.post(
  '/hourly/claim',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);

    const fresh = await withTxRetry(() =>
      prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
        const last = user.lastHourlyClaimAt;
        const state = hourlyState(hourlyBaseline(user), new Date());
        if (!state.canClaim) throw new AppError(429, 'No coins ready yet — check back soon.');

        // Optimistic-concurrency guard: the row must still hold the value we read,
        // so two simultaneous claims can't both bank the same coins.
        const moved =
          last === null
            ? await tx.$executeRaw`
                UPDATE "User" SET "lastHourlyClaimAt" = ${state.newBaseline}
                WHERE id = ${uid} AND "lastHourlyClaimAt" IS NULL`
            : await tx.$executeRaw`
                UPDATE "User" SET "lastHourlyClaimAt" = ${state.newBaseline}
                WHERE id = ${uid} AND "lastHourlyClaimAt" = ${last}`;
        if (moved === 0) throw new AppError(429, 'Coins already claimed. Try again in a moment.');

        await grant(tx, uid, { tokens: state.coins });
        return tx.user.findUniqueOrThrow({ where: { id: uid } });
      }),
    );

    res.json({ claimed: true, coins: hourlyState(hourlyBaseline(fresh), new Date()).coins, user: publicUser(fresh) });
  }),
);

router.post(
  '/daily/claim',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);

    const result = await withTxRetry(() =>
      prisma.$transaction(async (tx) => {
        const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
        const now = new Date();
        const last = user.lastLoginRewardAt;
        if (last && now.getTime() < last.getTime() + DAILY_LOGIN_COOLDOWN_MS) {
          throw new AppError(429, 'Daily reward already claimed. Come back tomorrow.');
        }

        const streak = nextLoginStreak(last, user.loginStreak, now);
        const reward = loginReward(streak);

        // Race-safe: only one concurrent claim flips lastLoginRewardAt.
        const eligibleBefore = new Date(now.getTime() - DAILY_LOGIN_COOLDOWN_MS);
        const moved = await tx.$executeRaw`
          UPDATE "User" SET "lastLoginRewardAt" = ${now}, "loginStreak" = ${streak}
          WHERE id = ${uid}
            AND ("lastLoginRewardAt" IS NULL OR "lastLoginRewardAt" <= ${eligibleBefore})`;
        if (moved === 0) throw new AppError(429, 'Daily reward already claimed. Come back tomorrow.');

        await grant(tx, uid, { tokens: reward.coins, cases: reward.cases });
        const updated = await tx.user.findUniqueOrThrow({ where: { id: uid } });
        return { user: updated, streak, reward };
      }),
    );

    res.json({
      claimed: true,
      streak: result.streak,
      reward: result.reward,
      user: publicUser(result.user),
    });
  }),
);

export default router;
