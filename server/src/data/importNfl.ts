import bcrypt from 'bcryptjs';
import { PARALLELS, type Position } from '@rip/shared';
import { prisma } from '../prisma';

/**
 * Import REAL NFL players + last-season stats from open data (Sleeper) and reseed
 * the league. Runs on the server (which has outbound internet), so it works from
 * the in-app Dev button, the CLI (`npm run import:nfl`), or the GitHub Action.
 *
 * Real NFL names/logos/likenesses are licensed IP — this open-data path is for
 * personal/development use; a commercial release needs an NFL/NFLPA license.
 */

const KEEP: Record<Position, number> = { QB: 3, RB: 4, WR: 6, TE: 3 };
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

interface NflTeam {
  abbr: string;
  name: string;
  conference: string;
  division: string;
  primaryColor: string;
  secondaryColor: string;
}

const NFL_TEAMS: NflTeam[] = [
  { abbr: 'BUF', name: 'Buffalo Bills', conference: 'AFC', division: 'East', primaryColor: '#00338D', secondaryColor: '#C60C30' },
  { abbr: 'MIA', name: 'Miami Dolphins', conference: 'AFC', division: 'East', primaryColor: '#008E97', secondaryColor: '#FC4C02' },
  { abbr: 'NE', name: 'New England Patriots', conference: 'AFC', division: 'East', primaryColor: '#002244', secondaryColor: '#C60C30' },
  { abbr: 'NYJ', name: 'New York Jets', conference: 'AFC', division: 'East', primaryColor: '#125740', secondaryColor: '#ffffff' },
  { abbr: 'BAL', name: 'Baltimore Ravens', conference: 'AFC', division: 'North', primaryColor: '#241773', secondaryColor: '#9E7C0C' },
  { abbr: 'CIN', name: 'Cincinnati Bengals', conference: 'AFC', division: 'North', primaryColor: '#FB4F14', secondaryColor: '#000000' },
  { abbr: 'CLE', name: 'Cleveland Browns', conference: 'AFC', division: 'North', primaryColor: '#311D00', secondaryColor: '#FF3C00' },
  { abbr: 'PIT', name: 'Pittsburgh Steelers', conference: 'AFC', division: 'North', primaryColor: '#FFB612', secondaryColor: '#101820' },
  { abbr: 'HOU', name: 'Houston Texans', conference: 'AFC', division: 'South', primaryColor: '#03202F', secondaryColor: '#A71930' },
  { abbr: 'IND', name: 'Indianapolis Colts', conference: 'AFC', division: 'South', primaryColor: '#002C5F', secondaryColor: '#A2AAAD' },
  { abbr: 'JAX', name: 'Jacksonville Jaguars', conference: 'AFC', division: 'South', primaryColor: '#006778', secondaryColor: '#D7A22A' },
  { abbr: 'TEN', name: 'Tennessee Titans', conference: 'AFC', division: 'South', primaryColor: '#0C2340', secondaryColor: '#4B92DB' },
  { abbr: 'DEN', name: 'Denver Broncos', conference: 'AFC', division: 'West', primaryColor: '#FB4F14', secondaryColor: '#002244' },
  { abbr: 'KC', name: 'Kansas City Chiefs', conference: 'AFC', division: 'West', primaryColor: '#E31837', secondaryColor: '#FFB81C' },
  { abbr: 'LV', name: 'Las Vegas Raiders', conference: 'AFC', division: 'West', primaryColor: '#000000', secondaryColor: '#A5ACAF' },
  { abbr: 'LAC', name: 'Los Angeles Chargers', conference: 'AFC', division: 'West', primaryColor: '#0080C6', secondaryColor: '#FFC20E' },
  { abbr: 'DAL', name: 'Dallas Cowboys', conference: 'NFC', division: 'East', primaryColor: '#041E42', secondaryColor: '#869397' },
  { abbr: 'NYG', name: 'New York Giants', conference: 'NFC', division: 'East', primaryColor: '#0B2265', secondaryColor: '#A71930' },
  { abbr: 'PHI', name: 'Philadelphia Eagles', conference: 'NFC', division: 'East', primaryColor: '#004C54', secondaryColor: '#A5ACAF' },
  { abbr: 'WAS', name: 'Washington Commanders', conference: 'NFC', division: 'East', primaryColor: '#5A1414', secondaryColor: '#FFB612' },
  { abbr: 'CHI', name: 'Chicago Bears', conference: 'NFC', division: 'North', primaryColor: '#0B162A', secondaryColor: '#C83803' },
  { abbr: 'DET', name: 'Detroit Lions', conference: 'NFC', division: 'North', primaryColor: '#0076B6', secondaryColor: '#B0B7BC' },
  { abbr: 'GB', name: 'Green Bay Packers', conference: 'NFC', division: 'North', primaryColor: '#203731', secondaryColor: '#FFB612' },
  { abbr: 'MIN', name: 'Minnesota Vikings', conference: 'NFC', division: 'North', primaryColor: '#4F2683', secondaryColor: '#FFC62F' },
  { abbr: 'ATL', name: 'Atlanta Falcons', conference: 'NFC', division: 'South', primaryColor: '#A71930', secondaryColor: '#000000' },
  { abbr: 'CAR', name: 'Carolina Panthers', conference: 'NFC', division: 'South', primaryColor: '#0085CA', secondaryColor: '#101820' },
  { abbr: 'NO', name: 'New Orleans Saints', conference: 'NFC', division: 'South', primaryColor: '#D3BC8D', secondaryColor: '#101820' },
  { abbr: 'TB', name: 'Tampa Bay Buccaneers', conference: 'NFC', division: 'South', primaryColor: '#D50A0A', secondaryColor: '#34302B' },
  { abbr: 'ARI', name: 'Arizona Cardinals', conference: 'NFC', division: 'West', primaryColor: '#97233F', secondaryColor: '#000000' },
  { abbr: 'LAR', name: 'Los Angeles Rams', conference: 'NFC', division: 'West', primaryColor: '#003594', secondaryColor: '#FFA300' },
  { abbr: 'SF', name: 'San Francisco 49ers', conference: 'NFC', division: 'West', primaryColor: '#AA0000', secondaryColor: '#B3995D' },
  { abbr: 'SEA', name: 'Seattle Seahawks', conference: 'NFC', division: 'West', primaryColor: '#002244', secondaryColor: '#69BE28' },
];
const TEAM_ABBRS = new Set(NFL_TEAMS.map((t) => t.abbr));

const PRODUCTS = [
  { name: 'Topps Chrome 2026', year: 2026, entryCost: 100, caseCost: 0, tier: 'fresh', cardsPerPack: 5, description: 'Fresh-season flagship. Reliable base with a real shot at a refractor hit.', topPlayerBias: 0.4, pullRates: { BASE: 880, BLUE: 90, PURPLE: 22, GOLD: 6, BLACK: 1.5, EMERALD: 0.4, SUPERFRACTOR: 0.1 } },
  { name: 'Prizm Legacy 2025', year: 2025, entryCost: 150, caseCost: 0, tier: 'legacy', cardsPerPack: 5, description: 'Last season legacy product. Better mid-tier parallels for the patient collector.', topPlayerBias: 0.5, pullRates: { BASE: 820, BLUE: 120, PURPLE: 38, GOLD: 14, BLACK: 5, EMERALD: 2, SUPERFRACTOR: 0.3 } },
  { name: 'Premier Vault', year: 2026, entryCost: 500, caseCost: 1, tier: 'chase', cardsPerPack: 6, description: 'Chase-heavy premium box. Costs a case. Every card has elevated hit odds.', topPlayerBias: 0.7, pullRates: { BASE: 600, BLUE: 200, PURPLE: 110, GOLD: 60, BLACK: 22, EMERALD: 6, SUPERFRACTOR: 2 } },
];

function ratingFor(ppr: number, searchRank: number): number {
  if (ppr > 0) return clamp(Math.round(58 + (ppr / 320) * 41), 58, 99);
  return clamp(Math.round(88 - searchRank * 0.06), 56, 84);
}
function valueFromRating(r: number): number {
  return Math.round((Math.pow(Math.max(r - 55, 1) / 44, 2.2) * 75 + 3) * 100) / 100;
}

interface Cand {
  teamAbbr: string;
  name: string;
  position: Position;
  overallRating: number;
  currentValue: number;
  isTopPlayer: boolean;
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return (await r.json()) as Record<string, unknown>;
}

export interface ImportSummary {
  teams: number;
  players: number;
  templates: number;
  season: string;
}

export async function importNflData(season = process.env.NFL_SEASON ?? '2024'): Promise<ImportSummary> {
  const [players, stats] = await Promise.all([
    fetchJson('https://api.sleeper.app/v1/players/nfl'),
    fetchJson(`https://api.sleeper.app/v1/stats/nfl/regular/${season}`).catch(() => ({}) as Record<string, unknown>),
  ]);

  const byTeam = new Map<string, Cand[]>();
  for (const id of Object.keys(players)) {
    const p = players[id] as Record<string, unknown> | undefined;
    const pos = p?.position as Position | undefined;
    const team = p?.team as string | undefined;
    if (!p || p.active === false || !pos || !team) continue;
    if (!(pos in KEEP) || !TEAM_ABBRS.has(team)) continue;
    const name = String(p.full_name ?? `${p.first_name ?? ''} ${p.last_name ?? ''}`).trim();
    if (!name) continue;
    const st = (stats[id] as Record<string, unknown> | undefined) ?? {};
    const ppr = typeof st.pts_ppr === 'number' ? st.pts_ppr : 0;
    const rank = typeof p.search_rank === 'number' ? p.search_rank : 99999;
    const rating = ratingFor(ppr, rank);
    const arr = byTeam.get(team) ?? [];
    arr.push({ teamAbbr: team, name, position: pos, overallRating: rating, currentValue: valueFromRating(rating), isTopPlayer: false });
    byTeam.set(team, arr);
  }

  const finalPlayers: Cand[] = [];
  for (const t of NFL_TEAMS) {
    const arr = byTeam.get(t.abbr) ?? [];
    const kept: Cand[] = [];
    (Object.keys(KEEP) as Position[]).forEach((pos) => {
      arr.filter((x) => x.position === pos).sort((a, b) => b.overallRating - a.overallRating).slice(0, KEEP[pos]).forEach((x) => kept.push(x));
    });
    [...kept].sort((a, b) => b.overallRating - a.overallRating).slice(0, 5).forEach((x) => (x.isTopPlayer = true));
    finalPlayers.push(...kept);
  }
  if (finalPlayers.length === 0) throw new Error('No players returned from the data source');

  await prisma.feedEvent.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.missionProgress.deleteMany();
  await prisma.seasonChampion.deleteMany();
  await prisma.lineupSlot.deleteMany();
  await prisma.lineupWeekScore.deleteMany();
  await prisma.valueHistory.deleteMany();
  await prisma.playerGameStat.deleteMany();
  await prisma.game.deleteMany();
  await prisma.battle.deleteMany();
  await prisma.cardInstance.deleteMany();
  await prisma.cardTemplate.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.product.deleteMany();
  await prisma.leagueWeek.deleteMany();
  await prisma.user.deleteMany();

  const botHash = await bcrypt.hash(`bot-${Math.random()}`, 10);
  const demoHash = await bcrypt.hash('demo1234', 10);
  await prisma.user.create({ data: { username: '__bot__', passwordHash: botHash, isBot: true, tokens: 1_000_000 } });
  await prisma.user.create({ data: { username: 'demo', email: 'demo@rip.gg', passwordHash: demoHash, tokens: 5000, cases: 5 } });

  await prisma.team.createMany({
    data: NFL_TEAMS.map((t) => ({ name: t.name, abbreviation: t.abbr, conference: t.conference, division: t.division, primaryColor: t.primaryColor, secondaryColor: t.secondaryColor })),
  });
  const teams = await prisma.team.findMany();
  const teamId = new Map(teams.map((t) => [t.abbreviation, t.id]));

  await prisma.player.createMany({
    data: finalPlayers.map((p) => ({ teamId: teamId.get(p.teamAbbr)!, name: p.name, position: p.position, overallRating: p.overallRating, currentValue: p.currentValue, isTopPlayer: p.isTopPlayer })),
  });
  const dbPlayers = await prisma.player.findMany({ select: { id: true } });
  await prisma.cardTemplate.createMany({
    data: dbPlayers.flatMap((pl) => PARALLELS.map((par) => ({ playerId: pl.id, parallel: par.name, printRun: par.printRun, valueMultiplier: par.valueMultiplier }))),
  });
  await prisma.product.createMany({ data: PRODUCTS });
  await prisma.leagueWeek.create({ data: { season: 1, weekNumber: 1, isCurrent: true } });
  await prisma.leagueState.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', lastAdvanceAt: new Date() }, update: { lastAdvanceAt: new Date() } });

  return {
    teams: await prisma.team.count(),
    players: await prisma.player.count(),
    templates: await prisma.cardTemplate.count(),
    season,
  };
}
