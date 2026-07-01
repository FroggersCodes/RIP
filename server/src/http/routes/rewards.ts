import { Router } from 'express';
import type { User } from '@prisma/client';
import { SETS } from '@rip/shared';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { withTxRetry } from '../../db/withTxRetry';
import { grant } from '../../economy/wallet';
import { loadPlayerPool, openPack, type PulledCard } from '../../ripping/pullEngine';
import { getPullMods } from '../../league/clock';
import { recordPullHits } from '../../feed/feed';
import { publicUser } from '../serialize';
import {
  DAILY_LOGIN_COOLDOWN_MS,
  HOURLY_CAP_HOURS,
  HOURLY_MAX_COINS,
  HOURLY_RATE,
  hourlyState,
  loginReward,
  nextLoginStreak,
  upcomingLoginRewards,
  type LoginReward,
} from '../../rewards/rewardsConfig';

const router = Router();

/** lastHourlyClaimAt, or createdAt for users who've never claimed. */
function hourlyBaseline(user: User): Date {
  return user.lastHourlyClaimAt ?? user.createdAt;
}

/** Human-readable set label for a pack reward (e.g. "artistry" → "Artistry"). */
function packLabel(setKey: string | null): string | null {
  return setKey ? SETS[setKey]?.label ?? setKey : null;
}

/** Shape a login reward for the client, adding a display label for any pack. */
function serializeReward(reward: LoginReward) {
  return { coins: reward.coins, gems: reward.gems, packSetKey: reward.packSetKey, packLabel: packLabel(reward.packSetKey) };
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
      reward: serializeReward(loginReward(upcomingStreak)),
      nextReward: serializeReward(loginReward(upcomingStreak + 1)),
      // The next several streak days so the player can see gems/packs coming up.
      schedule: upcomingLoginRewards(upcomingStreak).map(({ day, reward }) => ({
        day,
        ...serializeReward(reward),
      })),
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

    // Work out (provisionally) whether this claim lands on a pack day so we can
    // preload the read-only pack inputs outside the transaction — keeping the
    // locking window small, exactly as the rip route does. The winning claim's
    // authoritative streak equals this one (both derive from the same row, and
    // the guarded UPDATE below rejects any claim that lost the race), so the
    // preloaded product always matches the pack we end up opening.
    const before = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const provisional = loginReward(nextLoginStreak(before.lastLoginRewardAt, before.loginStreak, new Date()));
    let packProduct: Awaited<ReturnType<typeof prisma.product.findFirst>> = null;
    let pool: Awaited<ReturnType<typeof loadPlayerPool>> = [];
    let mods: Awaited<ReturnType<typeof getPullMods>> = { luck: 1, force: null };
    if (provisional.packSetKey) {
      packProduct = await prisma.product.findFirst({ where: { setKey: provisional.packSetKey, isActive: true } });
      if (packProduct) {
        pool = await loadPlayerPool(prisma);
        mods = await getPullMods();
      }
    }

    const result = await withTxRetry(() =>
      prisma.$transaction(
        async (tx) => {
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

          await grant(tx, uid, { tokens: reward.coins, gems: reward.gems });

          // Open the streak's free pack (one pack of the escalating set), if any.
          let cards: PulledCard[] = [];
          if (reward.packSetKey && packProduct && packProduct.setKey === reward.packSetKey) {
            cards = await openPack(tx, {
              ownerId: uid,
              pullRates: packProduct.pullRates as Record<string, number>,
              topPlayerBias: packProduct.topPlayerBias,
              count: packProduct.cardsPerPack,
              pool,
              setKey: packProduct.setKey,
              luck: mods.luck,
              force: mods.force,
            });
          }

          const updated = await tx.user.findUniqueOrThrow({ where: { id: uid } });
          return { user: updated, streak, reward, cards };
        },
        { timeout: 20000 },
      ),
    );

    if (result.cards.length) {
      try {
        await recordPullHits(result.user.username, result.cards);
      } catch {
        /* feed is best-effort */
      }
    }

    res.json({
      claimed: true,
      streak: result.streak,
      reward: serializeReward(result.reward),
      cards: result.cards,
      packValue: Math.round(result.cards.reduce((a, c) => a + c.marketValue, 0) * 100) / 100,
      user: publicUser(result.user),
    });
  }),
);

export default router;
