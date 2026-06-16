import { prisma, type Tx } from '../prisma';
import { withTxRetry } from '../db/withTxRetry';
import { roundRobinWeek } from './schedule';
import { simulateGame } from './simulateGame';
import { applyValueChange, baselineValue, expectedFantasy, OFFSEASON_REGRESSION } from './valuation';
import { PLAYOFF_TEAMS, ROUND_LABEL, type Round, playoffRoundForWeek } from './constants';
import { computeStandings, seedMap } from './standings';

interface StatRow {
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
}

export interface AdvanceResult {
  season: number;
  weekNumber: number;
  round: Round;
  phaseLabel: string;
  gamesPlayed: number;
  statsRecorded: number;
  playersRevalued: number;
  lineupsScored: number;
  featured: { home: string; away: string; recap: string } | null;
  champion: { team: string; runnerUp: string } | null;
  nextWeekNumber: number;
  nextSeason: number;
  topMovers: { name: string; teamAbbr: string; delta: number; valueAfter: number }[];
}

function statLine(s: StatRow): string {
  const parts: string[] = [];
  if (s.passYds) parts.push(`${s.passYds} pass yds`);
  if (s.passTd) parts.push(`${s.passTd} pass TD`);
  if (s.rushYds >= 40) parts.push(`${s.rushYds} rush yds`);
  if (s.rushTd) parts.push(`${s.rushTd} rush TD`);
  if (s.recYds) parts.push(`${s.receptions} rec ${s.recYds} yds`);
  if (s.recTd) parts.push(`${s.recTd} rec TD`);
  return parts.slice(0, 2).join(', ');
}

async function roundWinners(tx: Tx, weekId: string): Promise<string[]> {
  const games = await tx.game.findMany({ where: { weekId }, orderBy: { bracketOrder: 'asc' } });
  return games.map((g) => (g.homeScore >= g.awayScore ? g.homeTeamId : g.awayTeamId));
}

export async function advanceWeek(): Promise<AdvanceResult> {
  return withTxRetry(() =>
    prisma.$transaction(
      async (tx) => {
        let week = await tx.leagueWeek.findFirst({ where: { isCurrent: true } });
        if (!week) week = await tx.leagueWeek.create({ data: { season: 1, weekNumber: 1, isCurrent: true } });
        if (week.simulatedAt) throw new Error('Current week is already simulated');

        const round: Round = playoffRoundForWeek(week.weekNumber) ?? 'REGULAR';
        const teams = await tx.team.findMany({ orderBy: { abbreviation: 'asc' } });

        // ---- schedule the week if it has no games yet ----
        let games = await tx.game.findMany({ where: { weekId: week.id } });
        if (games.length === 0) {
          if (round === 'REGULAR') {
            const matchups = roundRobinWeek(teams.map((t) => t.id), week.weekNumber);
            await tx.game.createMany({
              data: matchups.map(([homeTeamId, awayTeamId]) => ({ weekId: week!.id, homeTeamId, awayTeamId, round: 'REGULAR' })),
            });
          } else {
            const seeds = await seedMap(tx, week.season, PLAYOFF_TEAMS);
            let pairs: { home: string; away: string; order: number }[] = [];
            if (round === 'QF') {
              const ordered = await computeStandings(tx, week.season);
              const top = ordered.slice(0, PLAYOFF_TEAMS).map((r) => r.teamId);
              [[0, 7], [3, 4], [1, 6], [2, 5]].forEach(([h, a], i) => {
                if (top[h] && top[a]) pairs.push({ home: top[h]!, away: top[a]!, order: i });
              });
            } else {
              const prev = await tx.leagueWeek.findFirst({ where: { season: week.season, weekNumber: week.weekNumber - 1 } });
              const winners = prev ? await roundWinners(tx, prev.id) : [];
              for (let i = 0; i + 1 < winners.length; i += 2) {
                pairs.push({ home: winners[i]!, away: winners[i + 1]!, order: i / 2 });
              }
              // higher seed (lower number) hosts
              pairs = pairs.map((p) => {
                const hs = seeds.get(p.home) ?? 99;
                const as = seeds.get(p.away) ?? 99;
                return hs <= as ? p : { home: p.away, away: p.home, order: p.order };
              });
            }
            await tx.game.createMany({
              data: pairs.map((p) => ({
                weekId: week!.id,
                homeTeamId: p.home,
                awayTeamId: p.away,
                round,
                bracketOrder: p.order,
                homeSeed: seeds.get(p.home) ?? null,
                awaySeed: seeds.get(p.away) ?? null,
              })),
            });
          }
          games = await tx.game.findMany({ where: { weekId: week.id } });
        }

        // ---- player pool ----
        const players = await tx.player.findMany({
          select: { id: true, teamId: true, name: true, position: true, overallRating: true, currentValue: true, team: { select: { abbreviation: true } } },
        });
        const byTeam = new Map<string, typeof players>();
        for (const p of players) {
          const arr = byTeam.get(p.teamId) ?? [];
          arr.push(p);
          byTeam.set(p.teamId, arr);
        }
        const playerName = new Map(players.map((p) => [p.id, p.name]));
        const teamAbbr = new Map(teams.map((t) => [t.id, t.abbreviation]));

        // ---- simulate every game ----
        const statRows: StatRow[] = [];
        const scoreById = new Map<string, { home: number; away: number }>();
        for (const g of games) {
          const home = byTeam.get(g.homeTeamId) ?? [];
          const away = byTeam.get(g.awayTeamId) ?? [];
          const sim = simulateGame(home, away, g.homeTeamId, g.awayTeamId);
          scoreById.set(g.id, { home: sim.homeScore, away: sim.awayScore });
          await tx.game.update({ where: { id: g.id }, data: { homeScore: sim.homeScore, awayScore: sim.awayScore, played: true } });
          for (const s of [...sim.homeStats, ...sim.awayStats]) statRows.push({ weekId: week.id, gameId: g.id, ...s });
        }
        await tx.playerGameStat.createMany({ data: statRows });

        // ---- Game of the Week (most star power; recap from the box score) ----
        const starPower = (teamId: string) =>
          [...(byTeam.get(teamId) ?? [])].sort((a, b) => b.overallRating - a.overallRating).slice(0, 5).reduce((s, p) => s + p.overallRating, 0);
        let featured: { home: string; away: string; recap: string } | null = null;
        let bestGame = games[0];
        let bestStar = -1;
        for (const g of games) {
          const star = starPower(g.homeTeamId) + starPower(g.awayTeamId);
          if (star > bestStar) {
            bestStar = star;
            bestGame = g;
          }
        }
        if (bestGame) {
          const sc = scoreById.get(bestGame.id)!;
          const homeWon = sc.home >= sc.away;
          const wId = homeWon ? bestGame.homeTeamId : bestGame.awayTeamId;
          const lId = homeWon ? bestGame.awayTeamId : bestGame.homeTeamId;
          const top = statRows.filter((s) => s.gameId === bestGame!.id).sort((a, b) => b.fantasyPoints - a.fantasyPoints)[0];
          const star = top ? `${playerName.get(top.playerId)} starred with ${top.fantasyPoints.toFixed(1)} pts (${statLine(top)}).` : '';
          const recap = `${teamAbbr.get(wId)} def. ${teamAbbr.get(lId)} ${Math.max(sc.home, sc.away)}-${Math.min(sc.home, sc.away)}. ${star}`;
          await tx.game.update({ where: { id: bestGame.id }, data: { isFeatured: true, recap } });
          featured = { home: teamAbbr.get(bestGame.homeTeamId)!, away: teamAbbr.get(bestGame.awayTeamId)!, recap };
        }

        // ---- stat-driven valuation (players who played) ----
        const statByPlayer = new Map(statRows.map((s) => [s.playerId, s]));
        const historyRows: { playerId: string; weekId: string; valueBefore: number; valueAfter: number; delta: number }[] = [];
        const movers: { name: string; teamAbbr: string; delta: number; valueAfter: number }[] = [];
        for (const p of players) {
          const st = statByPlayer.get(p.id);
          if (!st) continue;
          const { newValue } = applyValueChange(p.currentValue, st.performanceScore, expectedFantasy(p.position, p.overallRating));
          const delta = Math.round((newValue - p.currentValue) * 100) / 100;
          if (newValue !== p.currentValue) await tx.player.update({ where: { id: p.id }, data: { currentValue: newValue } });
          historyRows.push({ playerId: p.id, weekId: week.id, valueBefore: p.currentValue, valueAfter: newValue, delta });
          movers.push({ name: p.name, teamAbbr: p.team.abbreviation, delta, valueAfter: newValue });
        }
        await tx.valueHistory.createMany({ data: historyRows });

        // ---- weekly lineup scoring ----
        const slots = await tx.lineupSlot.findMany({
          where: { cardInstanceId: { not: null }, user: { isBot: false } },
          select: { userId: true, cardInstance: { select: { template: { select: { playerId: true } } } } },
        });
        const pointsByUser = new Map<string, number>();
        for (const slot of slots) {
          const pid = slot.cardInstance?.template.playerId;
          if (!pid) continue;
          if (!pointsByUser.has(slot.userId)) pointsByUser.set(slot.userId, 0);
          const st = statByPlayer.get(pid);
          if (st) pointsByUser.set(slot.userId, (pointsByUser.get(slot.userId) ?? 0) + st.fantasyPoints);
        }
        for (const [uid, pts] of pointsByUser) {
          const points = Math.round(pts * 100) / 100;
          await tx.lineupWeekScore.upsert({
            where: { userId_weekId: { userId: uid, weekId: week.id } },
            create: { userId: uid, weekId: week.id, points },
            update: { points },
          });
        }

        // ---- advance the pointer (handle end of season) ----
        await tx.leagueWeek.update({ where: { id: week.id }, data: { simulatedAt: new Date(), isCurrent: false } });

        let champion: { team: string; runnerUp: string } | null = null;
        let nextSeason = week.season;
        let nextWeekNumber = week.weekNumber + 1;

        if (round === 'FINAL' && bestGame) {
          // Crown the champion (winner of the only final game).
          const finalGame = games[0]!;
          const sc = scoreById.get(finalGame.id)!;
          const champId = sc.home >= sc.away ? finalGame.homeTeamId : finalGame.awayTeamId;
          const runnerId = sc.home >= sc.away ? finalGame.awayTeamId : finalGame.homeTeamId;

          const seasonWeeks = await tx.leagueWeek.findMany({ where: { season: week.season }, select: { id: true } });
          const grouped = await tx.lineupWeekScore.groupBy({
            by: ['userId'],
            where: { weekId: { in: seasonWeeks.map((w) => w.id) } },
            _sum: { points: true },
          });
          let topUserId: string | null = null;
          let topUserPoints: number | null = null;
          for (const row of grouped) {
            const pts = row._sum.points ?? 0;
            if (topUserPoints === null || pts > topUserPoints) {
              topUserPoints = pts;
              topUserId = row.userId;
            }
          }

          await tx.seasonChampion.upsert({
            where: { season: week.season },
            create: { season: week.season, championTeamId: champId, runnerUpTeamId: runnerId, topUserId, topUserPoints },
            update: { championTeamId: champId, runnerUpTeamId: runnerId, topUserId, topUserPoints },
          });
          champion = { team: teamAbbr.get(champId)!, runnerUp: teamAbbr.get(runnerId)! };

          // Offseason: mean-revert values toward baseline so they don't run away.
          for (const p of players) {
            const base = baselineValue(p.overallRating);
            const nv = Math.round((p.currentValue + (base - p.currentValue) * OFFSEASON_REGRESSION) * 100) / 100;
            if (nv !== p.currentValue) await tx.player.update({ where: { id: p.id }, data: { currentValue: nv } });
          }

          nextSeason = week.season + 1;
          nextWeekNumber = 1;
        }

        const next = await tx.leagueWeek.upsert({
          where: { season_weekNumber: { season: nextSeason, weekNumber: nextWeekNumber } },
          create: { season: nextSeason, weekNumber: nextWeekNumber, isCurrent: true },
          update: { isCurrent: true },
        });

        return {
          season: week.season,
          weekNumber: week.weekNumber,
          round,
          phaseLabel: ROUND_LABEL[round] ?? 'Regular Season',
          gamesPlayed: games.length,
          statsRecorded: statRows.length,
          playersRevalued: historyRows.length,
          lineupsScored: pointsByUser.size,
          featured,
          champion,
          nextWeekNumber: next.weekNumber,
          nextSeason: next.season,
          topMovers: movers.sort((a, b) => b.delta - a.delta).slice(0, 5),
        } satisfies AdvanceResult;
      },
      { timeout: 120000, maxWait: 20000 },
    ),
  );
}
