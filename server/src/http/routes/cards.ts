import { Router } from 'express';
import { TRACKED_SETS, gemsForSet, isTrackedSet, setOf } from '@rip/shared';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { publicUser } from '../serialize';
import { grant } from '../../economy/wallet';
import { cardInclude, cardView } from '../../cards/cardView';

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
      },
    });
  }),
);

// ---- Collection / "Sets" tracker --------------------------------------------
// A set is completed by owning the BASE card of every player in that set's
// theme. Completing one is claimable for a one-time gem reward.

interface PlayerRow {
  id: string;
  name: string;
  position: string;
  team: { name: string; abbreviation: string };
}

/** Player ids for which `uid` owns a BASE card, grouped by setKey. */
async function ownedBaseBySet(uid: string): Promise<Map<string, Set<string>>> {
  const owned = await prisma.cardInstance.findMany({
    where: { ownerId: uid, setKey: { in: [...TRACKED_SETS] }, template: { is: { parallel: 'BASE' } } },
    select: { setKey: true, template: { select: { playerId: true } } },
  });
  const bySet = new Map<string, Set<string>>();
  for (const row of owned) {
    if (!row.setKey) continue;
    const set = bySet.get(row.setKey) ?? new Set<string>();
    set.add(row.template.playerId);
    bySet.set(row.setKey, set);
  }
  return bySet;
}

function buildSetProgress(
  setKey: string,
  players: PlayerRow[],
  ownedIds: Set<string>,
  claimed: boolean,
) {
  const def = setOf(setKey);
  // Group the checklist by team so progress is legible.
  const teamMap = new Map<string, { name: string; abbreviation: string; players: { id: string; name: string; position: string; owned: boolean }[] }>();
  for (const p of players) {
    const key = p.team.abbreviation;
    const entry = teamMap.get(key) ?? { name: p.team.name, abbreviation: key, players: [] };
    entry.players.push({ id: p.id, name: p.name, position: p.position, owned: ownedIds.has(p.id) });
    teamMap.set(key, entry);
  }
  const teams = [...teamMap.values()]
    .map((t) => ({ ...t, owned: t.players.filter((p) => p.owned).length, total: t.players.length }))
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  const owned = ownedIds.size;
  const total = players.length;
  const complete = total > 0 && owned >= total;
  return {
    setKey,
    label: def.label,
    wordmark: def.wordmark,
    tierLevel: def.tierLevel,
    gems: gemsForSet(setKey),
    total,
    owned,
    complete,
    claimed,
    claimable: complete && !claimed,
    teams,
  };
}

router.get(
  '/sets',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const [players, ownedBySet, completions] = await Promise.all([
      prisma.player.findMany({
        select: { id: true, name: true, position: true, team: { select: { name: true, abbreviation: true } } },
        orderBy: [{ overallRating: 'desc' }],
      }),
      ownedBaseBySet(uid),
      prisma.setCompletion.findMany({ where: { userId: uid }, select: { setKey: true } }),
    ]);
    const claimedSets = new Set(completions.map((c) => c.setKey));
    const sets = TRACKED_SETS.map((sk) =>
      buildSetProgress(sk, players, ownedBySet.get(sk) ?? new Set(), claimedSets.has(sk)),
    );
    res.json({ sets });
  }),
);

router.post(
  '/sets/:setKey/claim',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const setKey = req.params.setKey;
    if (!isTrackedSet(setKey)) throw new AppError(404, 'Unknown set');
    const gems = gemsForSet(setKey);

    const result = await prisma.$transaction(async (tx) => {
      // Re-verify completion server-side: own a BASE card for every player.
      const total = await tx.player.count();
      const ownedRows = await tx.cardInstance.findMany({
        where: { ownerId: uid, setKey, template: { is: { parallel: 'BASE' } } },
        select: { template: { select: { playerId: true } } },
      });
      const ownedCount = new Set(ownedRows.map((r) => r.template.playerId)).size;
      if (total === 0 || ownedCount < total) {
        throw new AppError(400, `Set not complete yet (${ownedCount}/${total} base cards).`);
      }
      const existing = await tx.setCompletion.findUnique({
        where: { userId_setKey: { userId: uid, setKey } },
      });
      if (existing) throw new AppError(400, 'Reward already claimed for this set.');
      await tx.setCompletion.create({ data: { userId: uid, setKey, gemsAwarded: gems } });
      await grant(tx, uid, { gems });
      const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
      return user;
    });

    res.json({ claimed: setKey, gemsAwarded: gems, user: publicUser(result) });
  }),
);

export default router;
