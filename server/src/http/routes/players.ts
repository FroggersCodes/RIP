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

    res.json({
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
