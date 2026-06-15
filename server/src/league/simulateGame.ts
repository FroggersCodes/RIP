import { fantasyPoints, type Position, type StatLine } from '@rip/shared';
import { avg, clamp, gaussian, normalize, pickWeighted, poisson, ri } from './mathRandom';

export interface SimPlayer {
  id: string;
  position: Position;
  overallRating: number;
}

export interface SimStat extends Required<StatLine> {
  playerId: string;
  opponentTeamId: string;
  fantasyPoints: number;
  performanceScore: number;
}

function topN(roster: SimPlayer[], pos: Position, n: number): SimPlayer[] {
  return roster
    .filter((p) => p.position === pos)
    .sort((a, b) => b.overallRating - a.overallRating)
    .slice(0, n);
}

function emptyStat(playerId: string, opponentTeamId: string): SimStat {
  return {
    playerId,
    opponentTeamId,
    passYds: 0,
    passTd: 0,
    interceptions: 0,
    rushYds: 0,
    rushTd: 0,
    receptions: 0,
    recYds: 0,
    recTd: 0,
    fumbles: 0,
    fantasyPoints: 0,
    performanceScore: 0,
  };
}

/**
 * Simulate one team's offensive box score. Internally consistent: the QB's passing
 * yards equal the sum of receiver yards, and each passing TD is a receiver's TD.
 */
export function simulateTeamOffense(roster: SimPlayer[], opponentTeamId: string): { stats: SimStat[]; score: number } {
  const qb = topN(roster, 'QB', 1)[0];
  const rbs = topN(roster, 'RB', 2);
  const wrs = topN(roster, 'WR', 4);
  const tes = topN(roster, 'TE', 2);

  const lines = new Map<string, SimStat>();
  const activate = (p: SimPlayer) => {
    if (!lines.has(p.id)) lines.set(p.id, emptyStat(p.id, opponentTeamId));
    return lines.get(p.id)!;
  };
  if (qb) activate(qb);
  rbs.forEach(activate);
  wrs.forEach(activate);
  tes.forEach(activate);

  const qbR = qb?.overallRating ?? 70;
  const leadRbR = rbs[0]?.overallRating ?? 70;

  const passYds = ri(clamp(gaussian(190 + (qbR - 72) * 3.0, 55), 70, 470));
  const rushYds = ri(clamp(gaussian(100 + (leadRbR - 72) * 2.2, 32), 15, 260));

  // Receiving distribution among WR/TE plus checkdowns to RBs.
  const receivers = [...wrs, ...tes, ...rbs];
  const recWeights = receivers.map((p) => {
    const posBase = p.position === 'WR' ? 1.0 : p.position === 'TE' ? 0.6 : 0.3;
    return Math.max(0.05, posBase * (p.overallRating / 80));
  });
  const recShares = normalize(recWeights);
  receivers.forEach((p, i) => {
    activate(p).recYds += ri(passYds * recShares[i]! * (0.8 + Math.random() * 0.4));
  });
  let totalRec = 0;
  receivers.forEach((p) => (totalRec += lines.get(p.id)!.recYds));
  receivers.forEach((p) => {
    const l = lines.get(p.id)!;
    if (l.recYds > 0) {
      const ypr = p.position === 'WR' ? 13.5 : p.position === 'TE' ? 11 : 8.5;
      l.receptions = Math.max(1, Math.round(l.recYds / (ypr * (0.85 + Math.random() * 0.3))));
    }
  });

  // Rushing distribution: lead back gets the bulk.
  if (rbs.length) {
    const rushShares = normalize(rbs.map((_, i) => (i === 0 ? 0.7 : 0.3 / Math.max(1, rbs.length - 1))));
    rbs.forEach((r, i) => {
      activate(r).rushYds += ri(rushYds * rushShares[i]! * (0.85 + Math.random() * 0.3));
    });
  }
  if (qb) activate(qb).rushYds += ri(clamp(gaussian(8, 10), 0, 45));
  if (qb) activate(qb).passYds = totalRec;

  // Touchdowns scaled by overall offensive quality.
  const teamOff = avg([qbR, leadRbR, avg(wrs.map((w) => w.overallRating)) || 70, tes[0]?.overallRating ?? 70]);
  const tds = poisson(clamp(1.1 + (teamOff - 72) / 14, 0.3, 4.5));
  const fgs = poisson(1.25);
  for (let t = 0; t < tds; t++) {
    const rushBias = rushYds / (rushYds + totalRec + 1);
    if (Math.random() < rushBias && rbs.length) {
      const r = pickWeighted(rbs, rbs.map((rb) => lines.get(rb.id)!.rushYds + 1));
      lines.get(r.id)!.rushTd++;
    } else if (receivers.length) {
      const rec = pickWeighted(receivers, receivers.map((p) => lines.get(p.id)!.recYds + 1));
      lines.get(rec.id)!.recTd++;
      if (qb) lines.get(qb.id)!.passTd++;
    }
  }

  if (qb) lines.get(qb.id)!.interceptions = poisson(clamp(0.95 - (qbR - 72) * 0.02, 0.1, 2));
  for (const p of [...receivers, ...(qb ? [qb] : [])]) {
    if (Math.random() < 0.04) lines.get(p.id)!.fumbles++;
  }

  const score = tds * 7 + fgs * 3;
  const stats = [...lines.values()].map((l) => {
    const fp = fantasyPoints(l);
    return { ...l, fantasyPoints: fp, performanceScore: fp };
  });
  return { stats, score };
}

export interface GameResult {
  homeStats: SimStat[];
  awayStats: SimStat[];
  homeScore: number;
  awayScore: number;
}

export function simulateGame(
  homeRoster: SimPlayer[],
  awayRoster: SimPlayer[],
  homeTeamId: string,
  awayTeamId: string,
): GameResult {
  const home = simulateTeamOffense(homeRoster, awayTeamId);
  const away = simulateTeamOffense(awayRoster, homeTeamId);
  let homeScore = home.score;
  let awayScore = away.score;
  if (homeScore === awayScore) {
    if (Math.random() < 0.5) homeScore += 3;
    else awayScore += 3;
  }
  return { homeStats: home.stats, awayStats: away.stats, homeScore, awayScore };
}
