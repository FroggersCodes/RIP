import { Router } from 'express';
import { z } from 'zod';
import { LINEUP_ROLES, ROLE_ELIGIBILITY, isEligibleForRole, type LineupRoleName } from '@rip/shared';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { cardInclude, cardView } from '../../cards/cardView';
import { isLineupLocked } from '../../league/clock';
import { bumpMission } from '../../missions/missions';

const router = Router();

async function assertUnlocked() {
  if (await isLineupLocked()) {
    throw new AppError(423, 'Lineups are locked — kickoff is imminent. Set them before the next slate.');
  }
}

async function getLineup(uid: string) {
  const slots = await prisma.lineupSlot.findMany({
    where: { userId: uid },
    include: { cardInstance: { include: cardInclude } },
  });
  const byRole = new Map(slots.map((s) => [s.role, s]));
  let total = 0;
  const view = LINEUP_ROLES.map((role) => {
    const slot = byRole.get(role);
    const card = slot?.cardInstance ? cardView(slot.cardInstance) : null;
    if (card) total += card.marketValue;
    return { role, eligiblePositions: ROLE_ELIGIBILITY[role], card };
  });
  return { slots: view, totalValue: Math.round(total * 100) / 100 };
}

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getLineup(userId(req)));
  }),
);

const equipSchema = z.object({ cardInstanceId: z.string().min(1) });

router.put(
  '/:role',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    await assertUnlocked();
    const role = req.params.role.toUpperCase() as LineupRoleName;
    if (!LINEUP_ROLES.includes(role)) throw new AppError(400, 'Invalid lineup role');
    const { cardInstanceId } = equipSchema.parse(req.body);

    const inst = await prisma.cardInstance.findUnique({
      where: { id: cardInstanceId },
      include: { template: { include: { player: { select: { position: true } } } } },
    });
    if (!inst || inst.ownerId !== uid) throw new AppError(404, 'Card not found in your collection');
    const position = inst.template.player.position;
    if (!isEligibleForRole(role, position)) {
      throw new AppError(400, `A ${position} is not eligible for the ${role} slot`);
    }

    await prisma.$transaction(async (tx) => {
      // Free this card from any slot it currently occupies, then assign it here.
      await tx.lineupSlot.updateMany({ where: { userId: uid, cardInstanceId }, data: { cardInstanceId: null } });
      await tx.lineupSlot.upsert({
        where: { userId_role: { userId: uid, role } },
        create: { userId: uid, role, cardInstanceId },
        update: { cardInstanceId },
      });
    });

    try {
      await bumpMission(uid, 'equip', 1);
    } catch {
      /* best-effort */
    }

    res.json(await getLineup(uid));
  }),
);

router.delete(
  '/:role',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    await assertUnlocked();
    const role = req.params.role.toUpperCase() as LineupRoleName;
    if (!LINEUP_ROLES.includes(role)) throw new AppError(400, 'Invalid lineup role');
    await prisma.lineupSlot.updateMany({ where: { userId: uid, role }, data: { cardInstanceId: null } });
    res.json(await getLineup(uid));
  }),
);

export default router;
