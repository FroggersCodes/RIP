import { Router } from 'express';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { publicUser } from '../serialize';
import { claimMission, listMissions } from '../../missions/missions';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ missions: await listMissions(userId(req)) });
  }),
);

router.post(
  '/:key/claim',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const def = await claimMission(uid, req.params.key);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    res.json({ claimed: def.key, reward: { tokens: def.rewardTokens ?? 0, cases: def.rewardCases ?? 0 }, user: publicUser(user) });
  }),
);

export default router;
