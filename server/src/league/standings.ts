import type { DbClient } from '../prisma';
import { REGULAR_SEASON_WEEKS } from './constants';

export interface StandingRow {
  teamId: string;
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
}

/** Regular-season standings for a season, sorted by wins, then point differential. */
export async function computeStandings(client: DbClient, season: number): Promise<StandingRow[]> {
  const weeks = await client.leagueWeek.findMany({ where: { season }, select: { id: true, weekNumber: true } });
  const regWeekIds = weeks.filter((w) => w.weekNumber <= REGULAR_SEASON_WEEKS).map((w) => w.id);
  const teams = await client.team.findMany();
  const rows = new Map<string, StandingRow>(
    teams.map((t) => [
      t.id,
      {
        teamId: t.id,
        name: t.name,
        abbreviation: t.abbreviation,
        conference: t.conference,
        division: t.division,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        diff: 0,
      },
    ]),
  );

  if (regWeekIds.length > 0) {
    const games = await client.game.findMany({
      where: { weekId: { in: regWeekIds }, played: true },
      select: { homeTeamId: true, awayTeamId: true, homeScore: true, awayScore: true },
    });
    for (const g of games) {
      const h = rows.get(g.homeTeamId);
      const a = rows.get(g.awayTeamId);
      if (!h || !a) continue;
      h.pointsFor += g.homeScore;
      h.pointsAgainst += g.awayScore;
      a.pointsFor += g.awayScore;
      a.pointsAgainst += g.homeScore;
      if (g.homeScore > g.awayScore) {
        h.wins++;
        a.losses++;
      } else if (g.awayScore > g.homeScore) {
        a.wins++;
        h.losses++;
      } else {
        h.ties++;
        a.ties++;
      }
    }
  }

  const list = [...rows.values()];
  for (const r of list) r.diff = r.pointsFor - r.pointsAgainst;
  list.sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.pointsFor - x.pointsFor);
  return list;
}

/** Seed map (teamId -> 1..N) for the top playoff teams of a season. */
export async function seedMap(client: DbClient, season: number, teams: number): Promise<Map<string, number>> {
  const standings = await computeStandings(client, season);
  const m = new Map<string, number>();
  standings.slice(0, teams).forEach((row, i) => m.set(row.teamId, i + 1));
  return m;
}
