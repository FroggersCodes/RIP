import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { withTxRetry } from '../../db/withTxRetry';
import { loadPlayerPool, openPack } from '../../ripping/pullEngine';
import { getPullMods } from '../../league/clock';
import { spendGems, spendTokensAndCases } from '../../economy/wallet';
import { publicUser } from '../serialize';
import { recordPullHits } from '../../feed/feed';
import { bumpMission } from '../../missions/missions';

const router = Router();

const ripSchema = z.object({
  productId: z.string().min(1),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { productId } = ripSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw new AppError(404, 'Product not found');
    // Gem-only products (e.g. Reliquary) are paid purely in gems; everything else
    // costs tokens (+ cases for premium boxes).
    const payWithGems = product.gemCost > 0;

    // Pool loaded outside the transaction (read-only) to keep the locking window small.
    const pool = await loadPlayerPool(prisma);
    if (pool.length === 0) throw new AppError(500, 'No players seeded');
    const { luck, force } = await getPullMods();

    const result = await withTxRetry(() =>
      prisma.$transaction(
        async (tx) => {
          // Limited print run: atomically claim a box before charging. The
          // conditional update serializes concurrent rippers on the row, so the
          // cap can never be oversold; 0 rows updated means the run is exhausted.
          if (product.totalBoxes != null) {
            const claimed = await tx.product.updateMany({
              where: { id: product.id, boxesOpened: { lt: product.totalBoxes } },
              data: { boxesOpened: { increment: 1 } },
            });
            if (claimed.count === 0) {
              throw new AppError(409, 'This box is sold out — the entire print run has been opened.');
            }
          }
          if (payWithGems) {
            await spendGems(tx, uid, product.gemCost);
          } else {
            await spendTokensAndCases(tx, uid, product.entryCost, product.caseCost);
          }
          const cards = await openPack(tx, {
            ownerId: uid,
            pullRates: product.pullRates as Record<string, number>,
            topPlayerBias: product.topPlayerBias,
            count: product.cardsPerPack * product.packsPerBox,
            pool,
            setKey: product.setKey,
            guaranteeNumbered: product.guaranteeNumbered,
            minHits: product.minHits,
            luck,
            force,
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
      paidWith: payWithGems ? 'gems' : 'tokens',
      user: publicUser(result.user),
    });
  }),
);

export default router;
