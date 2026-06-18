import { Router } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { withTxRetry } from '../../db/withTxRetry';
import { loadPlayerPool, openPack } from '../../ripping/pullEngine';
import { getLuck } from '../../league/clock';
import { grant } from '../../economy/wallet';
import { publicUser } from '../serialize';
import { bumpMission } from '../../missions/missions';
import { recordPullHits } from '../../feed/feed';
import {
  DAILY_COOLDOWN_MS,
  STREAK_RESET_WINDOW_MS,
  nextTier,
  tierForStreak,
} from '../../daily/dailyConfig';

const router = Router();

function statusFor(user: User) {
  const last = user.lastDailyClaimAt ? user.lastDailyClaimAt.getTime() : null;
  const now = Date.now();
  const canClaim = last === null || now >= last + DAILY_COOLDOWN_MS;
  const current = tierForStreak(user.dailyStreak);
  const upcoming = nextTier(user.dailyStreak);
  return {
    canClaim,
    nextClaimAt: last ? new Date(last + DAILY_COOLDOWN_MS).toISOString() : null,
    streak: user.dailyStreak,
    currentTier: { name: current.name, cards: current.cards, tokenReward: current.tokenReward, caseReward: current.caseReward },
    nextTier: upcoming ? { name: upcoming.name, atStreak: upcoming.minStreak } : null,
  };
}

router.get(
  '/status',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(req) } });
    res.json(statusFor(user));
  }),
);

router.post(
  '/claim',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const pool = await loadPlayerPool(prisma);
    const luck = await getLuck();

    const result = await withTxRetry(() =>
      prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
          const now = new Date();
          const last = user.lastDailyClaimAt;
          if (last && now.getTime() < last.getTime() + DAILY_COOLDOWN_MS) {
            throw new AppError(429, 'Daily pack already claimed. Come back later.');
          }

          // Streak: +1 if claimed within the next-day window, otherwise reset to 1.
          let streak: number;
          if (!last) streak = 1;
          else streak = now.getTime() - last.getTime() < STREAK_RESET_WINDOW_MS ? user.dailyStreak + 1 : 1;

          // Race-safe: only one concurrent claim can flip lastDailyClaimAt.
          const eligibleBefore = new Date(now.getTime() - DAILY_COOLDOWN_MS);
          const updated = await tx.$executeRaw`
            UPDATE "User" SET "lastDailyClaimAt" = ${now}, "dailyStreak" = ${streak}
            WHERE id = ${uid}
              AND ("lastDailyClaimAt" IS NULL OR "lastDailyClaimAt" <= ${eligibleBefore})`;
          if (updated === 0) throw new AppError(429, 'Daily pack already claimed. Come back later.');

          const tier = tierForStreak(streak);
          await grant(tx, uid, { tokens: tier.tokenReward, cases: tier.caseReward });
          const cards = await openPack(tx, {
            ownerId: uid,
            pullRates: tier.pullRates,
            topPlayerBias: tier.topPlayerBias,
            count: tier.cards,
            pool,
            setKey: 'chrome',
            luck,
          });
          const fresh = await tx.user.findUniqueOrThrow({ where: { id: uid } });
          return { cards, user: fresh, tier, streak };
        },
        { timeout: 20000 },
      ),
    );

    try {
      await bumpMission(uid, 'daily', 1);
      await recordPullHits(result.user.username, result.cards);
    } catch {
      /* best-effort */
    }

    res.json({
      claimed: true,
      streak: result.streak,
      tier: { name: result.tier.name, tokenReward: result.tier.tokenReward, caseReward: result.tier.caseReward },
      cards: result.cards,
      packValue: Math.round(result.cards.reduce((a, c) => a + c.marketValue, 0) * 100) / 100,
      user: publicUser(result.user),
    });
  }),
);

export default router;
