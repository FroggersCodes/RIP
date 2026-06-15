import { prisma } from '../prisma';
import { withTxRetry } from '../db/withTxRetry';
import { roundRobinWeek } from './schedule';
import { simulateGame } from './simulateGame';
import { applyValueChange, expectedFantasy } from './valuation';

export interface AdvanceResult {
  season: number;
  weekNumber: number;
  gamesPlayed: number;
  statsRecorded: number;
  playersRevalued: number;
  lineupsScored: number;
  nextWeekNumber: number;
  topMovers: { name: string; teamAbbr: string; delta: number; valueAfter: number }[];
}

/**
 * Simulate the current league week: schedule (if needed), per-player box scores,
 * stat-driven value changes (+ value history), weekly lineup scores, then advance
 * the current-week pointer. The same function backs the CLI and the admin endpoint,
 * and is safe for a future scheduled job to call.
 */
export async function advanceWeek(): Promise<AdvanceResult> {
  return withTxRetry(() =>
    prisma.$transaction(
      async (tx) => {
        let week = await tx.leagueWeek.findFirst({ where: { isCurrent: true } });
        if (!week) {
          week = await tx.leagueWeek.create({ data: { season: 1, weekNumber: 1, isCurrent: true } });
        }
        if (week.simulatedAt) throw new Error('Current week is already simulated');

        const teams = await tx.team.findMany({ orderBy: { abbreviation: 'asc' } });

        let games = await tx.game.findMany({ where: { weekId: week.id } });
        if (games.length === 0) {
          const matchups = roundRobinWeek(teams.map((t) => t.id), week.weekNumber);
          await tx.game.createMany({
            data: matchups.map(([homeTeamId, awayTeamId]) => ({ weekId: week!.id, homeTeamId, awayTeamId })),
          });
          games = await tx.game.findMany({ where: { weekId: week.id } });
        }

        const players = await tx.player.findMany({
          select: { id: true, teamId: true, name: true, position: true, overallRating: true, currentValue: true, team: { select: { abbreviation: true } } },
        });
        const byTeam = new Map<string, typeof players>();
        for (const p of players) {
          const arr = byTeam.get(p.teamId) ?? [];
          arr.push(p);
          byTeam.set(p.teamId, arr);
        }

        const statRows: {
          weekId: string;
          gameId: string;
          playerId: string;
          opponentTeamId: string;
          passYds: number;
          passTd: number;
          interceptions: number;
          rushYds: number;
          rushTd: number;
          receptions: number;
          recYds: number;
          recTd: number;
          fumbles: number;
          fantasyPoints: number;
          performanceScore: number;
        }[] = [];

        for (const g of games) {
          const home = byTeam.get(g.homeTeamId) ?? [];
          const away = byTeam.get(g.awayTeamId) ?? [];
          const sim = simulateGame(home, away, g.homeTeamId, g.awayTeamId);
          await tx.game.update({
            where: { id: g.id },
            data: { homeScore: sim.homeScore, awayScore: sim.awayScore, played: true },
          });
          for (const s of [...sim.homeStats, ...sim.awayStats]) {
            statRows.push({ weekId: week.id, gameId: g.id, ...s });
          }
        }
        await tx.playerGameStat.createMany({ data: statRows });

        // Stat-driven valuation (only players who actually played move).
        const statByPlayer = new Map(statRows.map((s) => [s.playerId, s]));
        const historyRows: { playerId: string; weekId: string; valueBefore: number; valueAfter: number; delta: number }[] = [];
        const movers: { name: string; teamAbbr: string; delta: number; valueAfter: number }[] = [];
        for (const p of players) {
          const st = statByPlayer.get(p.id);
          if (!st) continue;
          const expected = expectedFantasy(p.position, p.overallRating);
          const { newValue } = applyValueChange(p.currentValue, st.performanceScore, expected);
          const delta = Math.round((newValue - p.currentValue) * 100) / 100;
          if (newValue !== p.currentValue) {
            await tx.player.update({ where: { id: p.id }, data: { currentValue: newValue } });
          }
          historyRows.push({ playerId: p.id, weekId: week.id, valueBefore: p.currentValue, valueAfter: newValue, delta });
          movers.push({ name: p.name, teamAbbr: p.team.abbreviation, delta, valueAfter: newValue });
        }
        await tx.valueHistory.createMany({ data: historyRows });

        // Weekly lineup scoring for every user with at least one equipped card.
        const slots = await tx.lineupSlot.findMany({
          where: { cardInstanceId: { not: null }, user: { isBot: false } },
          select: { userId: true, cardInstance: { select: { template: { select: { playerId: true } } } } },
        });
        const pointsByUser = new Map<string, number>();
        for (const slot of slots) {
          const pid = slot.cardInstance?.template.playerId;
          if (!pid) continue;
          const st = statByPlayer.get(pid);
          if (!st) {
            if (!pointsByUser.has(slot.userId)) pointsByUser.set(slot.userId, 0);
            continue;
          }
          pointsByUser.set(slot.userId, (pointsByUser.get(slot.userId) ?? 0) + st.fantasyPoints);
        }
        for (const [uid, pts] of pointsByUser) {
          const points = Math.round(pts * 100) / 100;
          await tx.lineupWeekScore.upsert({
            where: { userId_weekId: { userId: uid, weekId: week.id } },
            create: { userId: uid, weekId: week.id, points },
            update: { points },
          });
        }

        // Advance the pointer.
        await tx.leagueWeek.update({ where: { id: week.id }, data: { simulatedAt: new Date(), isCurrent: false } });
        const next = await tx.leagueWeek.upsert({
          where: { season_weekNumber: { season: week.season, weekNumber: week.weekNumber + 1 } },
          create: { season: week.season, weekNumber: week.weekNumber + 1, isCurrent: true },
          update: { isCurrent: true },
        });

        const topMovers = movers.sort((a, b) => b.delta - a.delta).slice(0, 5);

        return {
          season: week.season,
          weekNumber: week.weekNumber,
          gamesPlayed: games.length,
          statsRecorded: statRows.length,
          playersRevalued: historyRows.length,
          lineupsScored: pointsByUser.size,
          nextWeekNumber: next.weekNumber,
          topMovers,
        } satisfies AdvanceResult;
      },
      { timeout: 120000, maxWait: 20000 },
    ),
  );
}
