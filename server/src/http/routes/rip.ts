import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { withTxRetry } from '../../db/withTxRetry';
import { loadPlayerPool, openPack } from '../../ripping/pullEngine';
import { spendDust, spendTokensAndCases } from '../../economy/wallet';
import { publicUser } from '../serialize';
import { recordPullHits } from '../../feed/feed';
import { bumpMission } from '../../missions/missions';

const router = Router();

const ripSchema = z.object({
  productId: z.string().min(1),
  pay: z.enum(['tokens', 'dust']).optional(),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { productId, pay = 'tokens' } = ripSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw new AppError(404, 'Product not found');
    if (pay === 'dust' && product.caseCost > 0) {
      throw new AppError(400, 'Premium products require a case, not dust');
    }

    // Pool loaded outside the transaction (read-only) to keep the locking window small.
    const pool = await loadPlayerPool(prisma);
    if (pool.length === 0) throw new AppError(500, 'No players seeded');

    const result = await withTxRetry(() =>
      prisma.$transaction(
        async (tx) => {
          if (pay === 'dust') {
            await spendDust(tx, uid, product.entryCost);
          } else {
            await spendTokensAndCases(tx, uid, product.entryCost, product.caseCost);
          }
          const cards = await openPack(tx, {
            ownerId: uid,
            pullRates: product.pullRates as Record<string, number>,
            topPlayerBias: product.topPlayerBias,
            count: product.cardsPerPack,
            pool,
          });
          const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
          return { cards, user };
        },
        { timeout: 20000 },
      ),
    );

    try {
      await bumpMission(uid, 'rip', 1);
      await recordPullHits(result.user.username, result.cards);
    } catch {
      /* missions / feed are best-effort */
    }

    res.json({
      product: { id: product.id, name: product.name },
      cards: result.cards,
      packValue: Math.round(result.cards.reduce((a, c) => a + c.marketValue, 0) * 100) / 100,
      paidWith: pay,
      user: publicUser(result.user),
    });
  }),
);

export default router;
