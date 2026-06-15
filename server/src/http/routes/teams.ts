import { Router } from 'express';
import { prisma } from '../../prisma';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const teams = await prisma.team.findMany({
      orderBy: [{ conference: 'asc' }, { division: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { players: true } } },
    });
    res.json({
      teams: teams.map((t) => ({
        id: t.id,
        name: t.name,
        abbreviation: t.abbreviation,
        conference: t.conference,
        division: t.division,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        playerCount: t._count.players,
      })),
    });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) throw new AppError(404, 'Team not found');

    const players = await prisma.player.findMany({
      where: { teamId: team.id },
      orderBy: [{ isTopPlayer: 'desc' }, { overallRating: 'desc' }],
      take: 10,
      include: {
        gameStats: {
          orderBy: { week: { weekNumber: 'desc' } },
          take: 1,
          include: { week: { select: { weekNumber: true } } },
        },
        valueHistory: {
          orderBy: { week: { weekNumber: 'desc' } },
          take: 6,
          select: { valueAfter: true, delta: true, week: { select: { weekNumber: true } } },
        },
      },
    });

    res.json({
      team: {
        id: team.id,
        name: team.name,
        abbreviation: team.abbreviation,
        conference: team.conference,
        division: team.division,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor,
      },
      topPlayers: players.map((p) => {
        const last = p.gameStats[0];
        return {
          id: p.id,
          name: p.name,
          position: p.position,
          overallRating: p.overallRating,
          currentValue: p.currentValue,
          isTopPlayer: p.isTopPlayer,
          lastWeek: last
            ? {
                weekNumber: last.week.weekNumber,
                fantasyPoints: last.fantasyPoints,
                passYds: last.passYds,
                rushYds: last.rushYds,
                recYds: last.recYds,
                tds: last.passTd + last.rushTd + last.recTd,
              }
            : null,
          valueTrend: [...p.valueHistory]
            .reverse()
            .map((v) => ({ weekNumber: v.week.weekNumber, value: v.valueAfter, delta: v.delta })),
        };
      }),
    });
  }),
);

export default router;
