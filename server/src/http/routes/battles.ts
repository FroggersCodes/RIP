import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { publicUser } from '../serialize';
import { resolveBattleVsBot } from '../../battle/resolveBattle';
import { bumpMission } from '../../missions/missions';
import { recordPullHits } from '../../feed/feed';

const router = Router();

const battleSchema = z.object({ productId: z.string().min(1) });

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { productId } = battleSchema.parse(req.body);
    const outcome = await resolveBattleVsBot(uid, productId);
    try {
      await bumpMission(uid, 'battle', 1);
      if (outcome.result === 'win') await bumpMission(uid, 'battle_win', 1);
    } catch {
      /* best-effort */
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    try {
      await recordPullHits(user.username, outcome.challengerCards);
    } catch {
      /* feed is best-effort */
    }
    res.json({ ...outcome, user: publicUser(user) });
  }),
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const battles = await prisma.battle.findMany({
      where: { challengerId: uid },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { product: { select: { name: true } } },
    });
    res.json({
      battles: battles.map((b) => ({
        id: b.id,
        product: b.product.name,
        challengerTotal: b.challengerTotal,
        opponentTotal: b.opponentTotal,
        result: b.winnerId === uid ? 'win' : b.winnerId === null ? 'tie' : 'loss',
        createdAt: b.createdAt,
      })),
    });
  }),
);

export default router;
