import { Router } from 'express';
import { z } from 'zod';
import { dustForBreakdown } from '@rip/shared';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { publicUser } from '../serialize';
import { cardInclude, cardView } from '../../cards/cardView';
import { bumpMission } from '../../missions/missions';

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
    const breakdownable = cards.filter((c) => c.equippedRole === null);
    const breakdownDust = breakdownable.reduce((a, c) => a + dustForBreakdown(c.marketValue), 0);
    res.json({
      cards,
      summary: {
        total: cards.length,
        numbered,
        base: cards.length - numbered,
        totalValue,
        breakdownable: breakdownable.length,
        breakdownDust,
      },
    });
  }),
);

const breakdownSchema = z.object({ instanceIds: z.array(z.string()).min(1).max(1000) });

// Break down any owned, unequipped card into dust (value-scaled). Numbered serials
// are RETIRED FOREVER: the instance is deleted and the template's nextSerial counter
// is left untouched, so that exact serial can never be pulled again — preserving the
// "one owner, ever" guarantee.
router.post(
  '/breakdown',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { instanceIds } = breakdownSchema.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const instances = await tx.cardInstance.findMany({
        where: { id: { in: instanceIds }, ownerId: uid, lineupSlot: { is: null } },
        include: cardInclude,
      });
      if (instances.length === 0) return { brokenDown: 0, dustGained: 0 };

      const dustGained = instances.reduce((a, inst) => a + dustForBreakdown(cardView(inst).marketValue), 0);
      await tx.cardInstance.deleteMany({ where: { id: { in: instances.map((i) => i.id) } } });
      await tx.user.update({ where: { id: uid }, data: { dust: { increment: dustGained } } });
      return { brokenDown: instances.length, dustGained };
    });

    if (result.brokenDown > 0) {
      try {
        await bumpMission(uid, 'breakdown', result.brokenDown);
      } catch {
        /* best-effort */
      }
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    res.json({ ...result, user: publicUser(user) });
  }),
);

export default router;
