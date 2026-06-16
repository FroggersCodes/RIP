import { Router } from 'express';
import { prisma } from '../../prisma';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';

const router = Router();

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const player = await prisma.player.findUnique({
      where: { id: req.params.id },
      include: {
        team: { select: { id: true, name: true, abbreviation: true } },
        gameStats: {
          orderBy: { week: { weekNumber: 'desc' } },
          take: 8,
          include: { week: { select: { weekNumber: true } } },
        },
        valueHistory: {
          orderBy: { week: { weekNumber: 'asc' } },
          select: { valueBefore: true, valueAfter: true, delta: true, week: { select: { weekNumber: true } } },
        },
        templates: { select: { parallel: true, printRun: true, nextSerial: true, valueMultiplier: true } },
      },
    });
    if (!player) throw new AppError(404, 'Player not found');

    const cur = await prisma.leagueWeek.findFirst({ where: { isCurrent: true }, select: { season: true } });
    const season = cur?.season ?? 1;
    const sumFields = {
      passYds: true,
      passTd: true,
      interceptions: true,
      rushYds: true,
      rushTd: true,
      receptions: true,
      recYds: true,
      recTd: true,
      fantasyPoints: true,
    } as const;
    const [careerAgg, seasonAgg] = await Promise.all([
      prisma.playerGameStat.aggregate({ where: { playerId: player.id }, _sum: sumFields, _count: true }),
      prisma.playerGameStat.aggregate({ where: { playerId: player.id, week: { season } }, _sum: sumFields, _count: true }),
    ]);
    const totals = (agg: typeof careerAgg) => ({
      games: agg._count,
      passYds: agg._sum.passYds ?? 0,
      passTd: agg._sum.passTd ?? 0,
      interceptions: agg._sum.interceptions ?? 0,
      rushYds: agg._sum.rushYds ?? 0,
      rushTd: agg._sum.rushTd ?? 0,
      receptions: agg._sum.receptions ?? 0,
      recYds: agg._sum.recYds ?? 0,
      recTd: agg._sum.recTd ?? 0,
      fantasyPoints: Math.round((agg._sum.fantasyPoints ?? 0) * 10) / 10,
      avgFantasy: agg._count ? Math.round(((agg._sum.fantasyPoints ?? 0) / agg._count) * 10) / 10 : 0,
    });

    res.json({
      totals: { season: totals(seasonAgg), career: totals(careerAgg) },
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        overallRating: player.overallRating,
        currentValue: player.currentValue,
        isTopPlayer: player.isTopPlayer,
        team: player.team,
      },
      recentStats: player.gameStats.map((s) => ({
        weekNumber: s.week.weekNumber,
        passYds: s.passYds,
        passTd: s.passTd,
        interceptions: s.interceptions,
        rushYds: s.rushYds,
        rushTd: s.rushTd,
        receptions: s.receptions,
        recYds: s.recYds,
        recTd: s.recTd,
        fantasyPoints: s.fantasyPoints,
      })),
      valueHistory: player.valueHistory.map((v) => ({
        weekNumber: v.week.weekNumber,
        value: v.valueAfter,
        delta: v.delta,
      })),
      // Card scarcity per parallel: how many serials remain.
      parallels: player.templates
        .filter((t) => t.printRun !== null)
        .map((t) => ({
          parallel: t.parallel,
          printRun: t.printRun,
          allocated: t.nextSerial,
          remaining: (t.printRun ?? 0) - t.nextSerial,
        })),
    });
  }),
);

export default router;
