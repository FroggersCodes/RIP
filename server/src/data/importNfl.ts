import bcrypt from 'bcryptjs';
import { PARALLELS, reliquaryBoxCap, type Position } from '@rip/shared';
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

const SPARK         = { BASE: 7200, BLUE: 1460, GOLD: 270, PATCH: 260, AUTOGRAPH: 210 };
const MOMENTUM      = { BASE: 6200, BLUE: 800, PURPLE: 800, GOLD: 500, PATCH: 400, BLACK: 200, AUTOGRAPH: 300 };
const ARTISTRY      = {
  BASE: 5000,
  ART_RED: 1400, ART_BLUE: 1000, ART_GREEN: 700,
  ART_BLUE_ICE: 220, ART_RAINBOW: 150, ART_PURPLE_ICE: 110, ART_GOLD: 60, ART_WHITE: 18, ART_BLACK: 2,
  ART_RED_AUTO: 120, ART_BLUE_AUTO: 90, ART_GREEN_AUTO: 70, ART_BLUE_ICE_AUTO: 40,
  ART_RAINBOW_AUTO: 28, ART_PURPLE_ICE_AUTO: 20, ART_GOLD_AUTO: 12, ART_WHITE_AUTO: 5, ART_BLACK_AUTO: 1,
  ART_RPA_50: 30, ART_RPA_35: 20, ART_RPA_25: 14, ART_RPA_10: 8, ART_RPA_3: 3, ART_RPA_1: 1,
  ART_CANVAS_KINGS: 76,
};
const GOLD_STANDARD = { BASE: 2000, BLUE: 400, PURPLE: 600, GOLD: 800, PATCH: 900, BLACK: 600, AUTOGRAPH: 1300, PATCH_AUTO: 120, EMERALD: 250, SUPERFRACTOR: 30 };
// Reliquary runs its own four-tier check-list; no BASE weight = every card numbered.
const RELIQUARY     = {
  RLQ_RC: 1200, RLQ_GREEN: 1200, RLQ_ORANGE: 700, RLQ_RED: 600, RLQ_OFL: 300,
  RLQ_WHITE: 220, RLQ_PINK: 150, RLQ_GOLD: 90, RLQ_GOLD_SHIMMER: 60, RLQ_GREEN_SHIMMER: 18, RLQ_BLACK: 3,
  RLQ_PATCH: 500, RLQ_PATCH_RC: 300, RLQ_PATCH_GREEN: 300, RLQ_PATCH_ORANGE: 200, RLQ_PATCH_RED: 160,
  RLQ_PATCH_OFL: 90, RLQ_PATCH_WHITE: 70, RLQ_PATCH_PINK: 45, RLQ_PATCH_GOLD: 30,
  RLQ_PATCH_GOLD_SHIMMER: 18, RLQ_PATCH_GREEN_SHIMMER: 6, RLQ_PATCH_BLACK: 1,
  RLQ_AUTO: 300, RLQ_AUTO_ORANGE: 180, RLQ_AUTO_RED: 140, RLQ_AUTO_OFL: 80,
  RLQ_AUTO_GOLD: 30, RLQ_AUTO_GREEN_SHIMMER: 8, RLQ_AUTO_BLACK: 1,
  RLQ_RPA: 60, RLQ_RPA_OFL: 36, RLQ_RPA_WHITE: 24, RLQ_RPA_RED: 14,
  RLQ_RPA_GOLD: 9, RLQ_RPA_GOLD_SHIMMER: 6, RLQ_RPA_GREEN_SHIMMER: 3, RLQ_RPA_BLACK: 1,
};
const PRODUCTS = [
  { name: 'Spark', year: 2026, entryCost: 80, caseCost: 0, tier: 'spark', setKey: 'spark', cardsPerPack: 6, topPlayerBias: 0.35, pullRates: SPARK, description: 'Entry-level 6-card rip. Electric blue foil, crackling static aesthetic. ~70% color parallel, ~25% hit per box.' },
  { name: 'Momentum', year: 2026, entryCost: 200, caseCost: 0, tier: 'momentum', setKey: 'momentum', cardsPerPack: 4, packsPerBox: 2, minHits: 1, topPlayerBias: 0.45, pullRates: MOMENTUM, description: '2-pack box (8 cards). Motion-blur speed-line design. Guaranteed ≥1 hit per box.' },
  { name: 'Artistry', year: 2026, entryCost: 500, caseCost: 0, tier: 'artistry', setKey: 'artistry', cardsPerPack: 5, packsPerBox: 2, minHits: 2, topPlayerBias: 0.55, pullRates: ARTISTRY, description: '2-pack box (10 cards). Canvas-texture gallery aesthetic with its own numbered rainbow (Red /299 → Black 1/1), on-card base autographs, and a Rookie Patch Auto chase. Guaranteed ≥2 hits.' },
  { name: 'Gold Standard', year: 2026, entryCost: 1000, caseCost: 1, tier: 'gold-standard', setKey: 'gold-standard', cardsPerPack: 8, minHits: 2, guaranteeNumbered: true, topPlayerBias: 0.65, pullRates: GOLD_STANDARD, description: 'Matte-black, embossed gold foil. 8-card premium box. Costs a case. All cards numbered, ≥2 hits guaranteed.' },
  { name: 'Reliquary', year: 2026, entryCost: 100000, caseCost: 100, tier: 'reliquary', setKey: 'reliquary', cardsPerPack: 10, minHits: 4, guaranteeNumbered: true, topPlayerBias: 0.75, pullRates: RELIQUARY, description: 'Vault-door ultra-premium. Fixed 10-card pack: base, base rookie, 3 numbered, 2 autos, 2 patches, an RPA. Costs 100 cases.' },
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
  const reliquaryBoxes = reliquaryBoxCap(dbPlayers.length);
  await prisma.product.createMany({
    data: PRODUCTS.map((p) =>
      p.setKey === 'reliquary'
        ? {
            ...p,
            totalBoxes: reliquaryBoxes,
            description: `Vault-door ultra-premium. Fixed 10-card pack: base, base rookie, 3 numbered, 2 autos, 2 patches, an RPA. Costs 100 cases. Limited to ${reliquaryBoxes.toLocaleString()} boxes — once they're gone, they're gone.`,
          }
        : p,
    ),
  });
  await prisma.leagueWeek.create({ data: { season: 1, weekNumber: 1, isCurrent: true } });
  await prisma.leagueState.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', lastAdvanceAt: new Date() }, update: { lastAdvanceAt: new Date() } });

  return {
    teams: await prisma.team.count(),
    players: await prisma.player.count(),
    templates: await prisma.cardTemplate.count(),
    season,
  };
}
