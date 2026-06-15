import { Router } from 'express';
import { prisma } from '../../prisma';
import { asyncHandler } from '../asyncHandler';

const router = Router();

async function latestSimulatedWeek() {
  return prisma.leagueWeek.findFirst({
    where: { simulatedAt: { not: null } },
    orderBy: [{ season: 'desc' }, { weekNumber: 'desc' }],
  });
}

router.get(
  '/current',
  asyncHandler(async (_req, res) => {
    const current = await prisma.leagueWeek.findFirst({ where: { isCurrent: true } });
    const lastSimulated = await latestSimulatedWeek();
    res.json({
      current: current ? { season: current.season, weekNumber: current.weekNumber } : null,
      lastSimulated: lastSimulated
        ? { season: lastSimulated.season, weekNumber: lastSimulated.weekNumber, simulatedAt: lastSimulated.simulatedAt }
        : null,
    });
  }),
);

router.get(
  '/scoreboard',
  asyncHandler(async (req, res) => {
    const weekParam = req.query.week ? Number(req.query.week) : null;
    const week = weekParam
      ? await prisma.leagueWeek.findFirst({ where: { weekNumber: weekParam } })
      : await latestSimulatedWeek();
    if (!week) {
      res.json({ week: null, games: [] });
      return;
    }
    const games = await prisma.game.findMany({
      where: { weekId: week.id },
      include: {
        homeTeam: { select: { name: true, abbreviation: true } },
        awayTeam: { select: { name: true, abbreviation: true } },
      },
    });
    res.json({
      week: { season: week.season, weekNumber: week.weekNumber },
      games: games.map((g) => ({
        home: g.homeTeam.abbreviation,
        homeName: g.homeTeam.name,
        away: g.awayTeam.abbreviation,
        awayName: g.awayTeam.name,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        played: g.played,
      })),
    });
  }),
);

router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const weekParam = req.query.week ? Number(req.query.week) : null;
    const week = weekParam
      ? await prisma.leagueWeek.findFirst({ where: { weekNumber: weekParam } })
      : await latestSimulatedWeek();
    if (!week) {
      res.json({ week: null, entries: [] });
      return;
    }
    const scores = await prisma.lineupWeekScore.findMany({
      where: { weekId: week.id },
      orderBy: { points: 'desc' },
      take: 100,
      include: { user: { select: { username: true } } },
    });
    res.json({
      week: { season: week.season, weekNumber: week.weekNumber },
      entries: scores.map((s, i) => ({ rank: i + 1, username: s.user.username, points: s.points })),
    });
  }),
);

export default router;
