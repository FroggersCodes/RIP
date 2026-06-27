import { Router } from 'express';
import { TRACKED_SETS, gemsForTeamSet, isTrackedSet, setOf } from '@rip/shared';
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
// Completion is per team within a set: own the BASE card of every player on a
// team (in that set theme) to claim that team's small gem reward.

interface PlayerRow {
  id: string;
  name: string;
  position: string;
  team: { name: string; abbreviation: string };
}

/** "setKey|playerId" keys for which `uid` owns a BASE card in a tracked set. */
async function ownedBaseKeys(uid: string): Promise<Set<string>> {
  const owned = await prisma.cardInstance.findMany({
    where: { ownerId: uid, setKey: { in: [...TRACKED_SETS] }, template: { is: { parallel: 'BASE' } } },
    select: { setKey: true, template: { select: { playerId: true } } },
  });
  const keys = new Set<string>();
  for (const row of owned) {
    if (row.setKey) keys.add(`${row.setKey}|${row.template.playerId}`);
  }
  return keys;
}

function buildSetProgress(
  setKey: string,
  players: PlayerRow[],
  ownedKeys: Set<string>,
  claimedTeams: Set<string>,
) {
  const def = setOf(setKey);
  const gems = gemsForTeamSet(setKey);
  // Group the checklist by team; each team is its own claimable mini-set.
  const teamMap = new Map<string, { name: string; abbreviation: string; players: { id: string; name: string; position: string; owned: boolean }[] }>();
  for (const p of players) {
    const key = p.team.abbreviation;
    const entry = teamMap.get(key) ?? { name: p.team.name, abbreviation: key, players: [] };
    entry.players.push({ id: p.id, name: p.name, position: p.position, owned: ownedKeys.has(`${setKey}|${p.id}`) });
    teamMap.set(key, entry);
  }
  const teams = [...teamMap.values()]
    .map((t) => {
      const owned = t.players.filter((p) => p.owned).length;
      const total = t.players.length;
      const complete = total > 0 && owned >= total;
      const claimed = claimedTeams.has(t.abbreviation);
      return { ...t, owned, total, gems, complete, claimed, claimable: complete && !claimed };
    })
    .sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));
  return {
    setKey,
    label: def.label,
    wordmark: def.wordmark,
    tierLevel: def.tierLevel,
    gemsPerTeam: gems,
    total: players.length,
    owned: teams.reduce((a, t) => a + t.owned, 0),
    teamsTotal: teams.length,
    teamsComplete: teams.filter((t) => t.complete).length,
    teamsClaimed: teams.filter((t) => t.claimed).length,
    teams,
  };
}

router.get(
  '/sets',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const [players, ownedKeys, completions] = await Promise.all([
      prisma.player.findMany({
        select: { id: true, name: true, position: true, team: { select: { name: true, abbreviation: true } } },
        orderBy: [{ overallRating: 'desc' }],
      }),
      ownedBaseKeys(uid),
      prisma.setCompletion.findMany({ where: { userId: uid }, select: { setKey: true, teamAbbr: true } }),
    ]);
    const claimedBySet = new Map<string, Set<string>>();
    for (const c of completions) {
      const set = claimedBySet.get(c.setKey) ?? new Set<string>();
      set.add(c.teamAbbr);
      claimedBySet.set(c.setKey, set);
    }
    const sets = TRACKED_SETS.map((sk) =>
      buildSetProgress(sk, players, ownedKeys, claimedBySet.get(sk) ?? new Set()),
    );
    res.json({ sets });
  }),
);

router.post(
  '/sets/:setKey/teams/:teamAbbr/claim',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const setKey = req.params.setKey;
    const teamAbbr = req.params.teamAbbr;
    if (!isTrackedSet(setKey)) throw new AppError(404, 'Unknown set');
    const gems = gemsForTeamSet(setKey);

    const result = await prisma.$transaction(async (tx) => {
      // Re-verify server-side: own a BASE card for every player on this team.
      const total = await tx.player.count({ where: { team: { is: { abbreviation: teamAbbr } } } });
      if (total === 0) throw new AppError(404, 'Unknown team');
      const ownedRows = await tx.cardInstance.findMany({
        where: {
          ownerId: uid,
          setKey,
          template: { is: { parallel: 'BASE', player: { is: { team: { is: { abbreviation: teamAbbr } } } } } },
        },
        select: { template: { select: { playerId: true } } },
      });
      const ownedCount = new Set(ownedRows.map((r) => r.template.playerId)).size;
      if (ownedCount < total) {
        throw new AppError(400, `Team set not complete yet (${ownedCount}/${total} base cards).`);
      }
      const existing = await tx.setCompletion.findUnique({
        where: { userId_setKey_teamAbbr: { userId: uid, setKey, teamAbbr } },
      });
      if (existing) throw new AppError(400, 'Reward already claimed for this team.');
      await tx.setCompletion.create({ data: { userId: uid, setKey, teamAbbr, gemsAwarded: gems } });
      await grant(tx, uid, { gems });
      const user = await tx.user.findUniqueOrThrow({ where: { id: uid } });
      return user;
    });

    res.json({ claimed: { setKey, teamAbbr }, gemsAwarded: gems, user: publicUser(result) });
  }),
);

export default router;
