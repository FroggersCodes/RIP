import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { publicUser } from '../serialize';
import { cardInclude, cardView } from '../../cards/cardView';

const DUST_PER_BASE = 5;

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const instances = await prisma.cardInstance.findMany({
      where: { ownerId: uid },
      include: cardInclude,
      orderBy: { pulledAt: 'desc' },
    });
    const cards = instances.map(cardView).sort((a, b) => b.marketValue - a.marketValue);
    const numbered = cards.filter((c) => c.serial !== null).length;
    const totalValue = Math.round(cards.reduce((a, c) => a + c.marketValue, 0) * 100) / 100;
    res.json({
      cards,
      summary: {
        total: cards.length,
        numbered,
        base: cards.length - numbered,
        totalValue,
        recyclableBase: cards.filter((c) => c.serial === null && c.equippedRole === null).length,
        dustPerBase: DUST_PER_BASE,
      },
    });
  }),
);

const recycleSchema = z.object({ instanceIds: z.array(z.string()).min(1).max(1000) });

// Base cards are filler; recycle them into dust (spendable toward a pack).
router.post(
  '/recycle',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { instanceIds } = recycleSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const eligible = await tx.cardInstance.findMany({
        where: {
          id: { in: instanceIds },
          ownerId: uid,
          serial: null,
          lineupSlot: { is: null },
          template: { is: { parallel: 'BASE' } },
        },
        select: { id: true },
      });
      if (eligible.length === 0) return { recycled: 0, dustGained: 0 };
      const ids = eligible.map((e) => e.id);
      await tx.cardInstance.deleteMany({ where: { id: { in: ids } } });
      const dustGained = eligible.length * DUST_PER_BASE;
      await tx.user.update({ where: { id: uid }, data: { dust: { increment: dustGained } } });
      return { recycled: eligible.length, dustGained };
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    res.json({ ...result, user: publicUser(user) });
  }),
);

export default router;
