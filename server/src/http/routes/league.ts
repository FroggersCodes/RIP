import { Router } from 'express';
import type { PlayerGameStat } from '@prisma/client';
import { prisma } from '../../prisma';
import { asyncHandler } from '../asyncHandler';
import { ROUND_LABEL, REGULAR_SEASON_WEEKS, playoffRoundForWeek } from '../../league/constants';
import { computeStandings } from '../../league/standings';
import { getClock } from '../../league/clock';

const router = Router();

router.get(
  '/clock',
  asyncHandler(async (_req, res) => {
    res.json(await getClock());
  }),
);

async function latestSimulatedWeek() {
  return prisma.leagueWeek.findFirst({
    where: { simulatedAt: { not: null } },
    orderBy: [{ season: 'desc' }, { weekNumber: 'desc' }],
  });
}

async function currentSeason(): Promise<number> {
  const cur = await prisma.leagueWeek.findFirst({ where: { isCurrent: true } });
  if (cur) return cur.season;
  const last = await latestSimulatedWeek();
  return last?.season ?? 1;
}

async function resolveWeek(weekParam: unknown) {
  if (weekParam) {
    return prisma.leagueWeek.findFirst({
      where: { weekNumber: Number(weekParam) },
      orderBy: [{ season: 'desc' }],
    });
  }
  return latestSimulatedWeek();
}

router.get(
  '/current',
  asyncHandler(async (_req, res) => {
    const current = await prisma.leagueWeek.findFirst({ where: { isCurrent: true } });
    const lastSimulated = await latestSimulatedWeek();
    const round = current ? playoffRoundForWeek(current.weekNumber) ?? 'REGULAR' : null;
    res.json({
      current: current
        ? { season: current.season, weekNumber: current.weekNumber, phase: ROUND_LABEL[round!] }
        : null,
      lastSimulated: lastSimulated
        ? { season: lastSimulated.season, weekNumber: lastSimulated.weekNumber, simulatedAt: lastSimulated.simulatedAt }
        : null,
      regularSeasonWeeks: REGULAR_SEASON_WEEKS,
    });
  }),
);

router.get(
  '/scoreboard',
  asyncHandler(async (req, res) => {
    const week = await resolveWeek(req.query.week);
    if (!week) {
      res.json({ week: null, games: [] });
      return;
    }
    const games = await prisma.game.findMany({
      where: { weekId: week.id },
      orderBy: [{ round: 'asc' }, { bracketOrder: 'asc' }],
      include: {
        homeTeam: { select: { name: true, abbreviation: true } },
        awayTeam: { select: { name: true, abbreviation: true } },
      },
    });
    res.json({
      week: { season: week.season, weekNumber: week.weekNumber, phase: ROUND_LABEL[playoffRoundForWeek(week.weekNumber) ?? 'REGULAR'] },
      games: games.map((g) => ({
        home: g.homeTeam.abbreviation,
        away: g.awayTeam.abbreviation,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        played: g.played,
        round: g.round,
        isFeatured: g.isFeatured,
        recap: g.recap,
        homeSeed: g.homeSeed,
        awaySeed: g.awaySeed,
      })),
    });
  }),
);

router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const week = await resolveWeek(req.query.week);
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

// ---- weekly stat leaders ----
router.get(
  '/leaders',
  asyncHandler(async (req, res) => {
    const week = await resolveWeek(req.query.week);
    if (!week) {
      res.json({ week: null, categories: [] });
      return;
    }
    const stats = await prisma.playerGameStat.findMany({
      where: { weekId: week.id },
      include: { player: { select: { id: true, name: true, position: true, team: { select: { abbreviation: true } } } } },
    });
    type S = (typeof stats)[number];
    const top = (label: string, acc: (s: PlayerGameStat) => number, unit: string) => ({
      label,
      unit,
      leaders: [...stats]
        .sort((a, b) => acc(b) - acc(a))
        .slice(0, 5)
        .map((s: S) => ({
          id: s.player.id,
          name: s.player.name,
          position: s.player.position,
          team: s.player.team.abbreviation,
          value: Math.round(acc(s) * 10) / 10,
          fantasy: s.fantasyPoints,
        })),
    });
    res.json({
      week: { season: week.season, weekNumber: week.weekNumber },
      categories: [
        top('Fantasy', (s) => s.fantasyPoints, 'pts'),
        top('Passing', (s) => s.passYds, 'yds'),
        top('Rushing', (s) => s.rushYds, 'yds'),
        top('Receiving', (s) => s.recYds, 'yds'),
      ],
    });
  }),
);

// ---- season (aggregate) stat leaders ----
router.get(
  '/stat-leaders',
  asyncHandler(async (req, res) => {
    const season = req.query.season ? Number(req.query.season) : await currentSeason();
    const grouped = await prisma.playerGameStat.groupBy({
      by: ['playerId'],
      where: { week: { season } },
      _sum: { fantasyPoints: true, passYds: true, rushYds: true, recYds: true },
      _count: true,
    });
    const ids = grouped.map((g) => g.playerId);
    const players = await prisma.player.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, position: true, team: { select: { abbreviation: true } } },
    });
    const meta = new Map(players.map((p) => [p.id, p]));
    const cat = (label: string, key: 'fantasyPoints' | 'passYds' | 'rushYds' | 'recYds', unit: string) => ({
      label,
      unit,
      leaders: [...grouped]
        .sort((a, b) => (b._sum[key] ?? 0) - (a._sum[key] ?? 0))
        .slice(0, 8)
        .map((g) => {
          const m = meta.get(g.playerId);
          return {
            id: g.playerId,
            name: m?.name ?? '—',
            position: m?.position ?? null,
            team: m?.team.abbreviation ?? '',
            value: Math.round((g._sum[key] ?? 0) * 10) / 10,
            games: g._count,
          };
        }),
    });
    res.json({
      season,
      categories: [
        cat('Fantasy points', 'fantasyPoints', 'pts'),
        cat('Passing yards', 'passYds', 'yds'),
        cat('Rushing yards', 'rushYds', 'yds'),
        cat('Receiving yards', 'recYds', 'yds'),
      ],
    });
  }),
);

// ---- standings ----
router.get(
  '/standings',
  asyncHandler(async (req, res) => {
    const season = req.query.season ? Number(req.query.season) : await currentSeason();
    const standings = await computeStandings(prisma, season);
    res.json({
      season,
      standings: standings.map((s, i) => ({ ...s, rank: i + 1, playoffSeed: i < 8 ? i + 1 : null })),
    });
  }),
);

// ---- playoff bracket ----
router.get(
  '/bracket',
  asyncHandler(async (req, res) => {
    const season = req.query.season ? Number(req.query.season) : await currentSeason();
    const weeks = await prisma.leagueWeek.findMany({ where: { season }, select: { id: true } });
    const games = await prisma.game.findMany({
      where: { weekId: { in: weeks.map((w) => w.id) }, round: { in: ['QF', 'SF', 'FINAL'] } },
      orderBy: [{ round: 'asc' }, { bracketOrder: 'asc' }],
      include: {
        homeTeam: { select: { abbreviation: true } },
        awayTeam: { select: { abbreviation: true } },
      },
    });
    const byRound = (round: string) =>
      games
        .filter((g) => g.round === round)
        .map((g) => ({
          home: g.homeTeam.abbreviation,
          away: g.awayTeam.abbreviation,
          homeSeed: g.homeSeed,
          awaySeed: g.awaySeed,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
          played: g.played,
        }));
    res.json({ season, rounds: { QF: byRound('QF'), SF: byRound('SF'), FINAL: byRound('FINAL') } });
  }),
);

// ---- champions history ----
router.get(
  '/history',
  asyncHandler(async (_req, res) => {
    const champs = await prisma.seasonChampion.findMany({
      orderBy: { season: 'desc' },
      include: {
        champion: { select: { name: true, abbreviation: true } },
        runnerUp: { select: { name: true, abbreviation: true } },
      },
    });
    const userIds = champs.map((c) => c.topUserId).filter((x): x is string => !!x);
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true } });
    const uname = new Map(users.map((u) => [u.id, u.username]));
    res.json({
      seasons: champs.map((c) => ({
        season: c.season,
        champion: c.champion.name,
        championAbbr: c.champion.abbreviation,
        runnerUp: c.runnerUp.name,
        runnerUpAbbr: c.runnerUp.abbreviation,
        topUser: c.topUserId ? uname.get(c.topUserId) ?? null : null,
        topUserPoints: c.topUserPoints,
      })),
    });
  }),
);

export default router;
