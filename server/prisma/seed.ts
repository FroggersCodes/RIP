import bcrypt from 'bcryptjs';
import { PARALLELS, type Position } from '@rip/shared';
import { prisma } from '../src/prisma';

// Deterministic RNG so reseeding produces a stable league.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
function gaussian(mean: number, sd: number) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function valueFromRating(r: number): number {
  const v = Math.pow(Math.max(r - 55, 1) / 44, 2.2) * 75 + 3;
  return Math.round(v * 100) / 100;
}

const FIRST = [
  'Marcus', 'Tyrell', 'Deshawn', 'Cole', 'Brayden', 'Jaylen', 'Xavier', 'Bryce', 'Damon', 'Elias',
  'Trey', 'Donovan', 'Kade', 'Marquise', 'Roman', 'Dexter', 'Silas', 'Knox', 'Cedric', 'Malik',
  'Quinton', 'Rashad', 'Brock', 'Holden', 'Jamar', 'Lincoln', 'Tobias', 'Reggie', 'Vince', 'Darnell',
  'Emmett', 'Kellan', 'Grant', 'Pierce', 'Sterling', 'Boone', 'Rhett', 'Zane', 'Ezra', 'Cason',
  'Dane', 'Hollis', 'Beau', 'Ronan', 'Tate', 'Davis', 'Foster', 'Greer', 'Hayes', 'Lane',
];
const LAST = [
  'Holloway', 'Brooks', 'Caldwell', 'Ramsey', 'Whitaker', 'Sutton', 'Vance', 'Maddox', 'Ellison', 'Pruitt',
  'Garrison', 'Hendricks', 'Lockhart', 'Mercer', 'Bannister', 'Kingsley', 'Rhodes', 'Stratton', 'Calloway', 'Driscoll',
  'Fairbanks', 'Goodwin', 'Hatcher', 'Iverson', 'Jennings', 'Larkin', 'Montoya', 'Nash', 'Okafor', 'Patterson',
  'Quigley', 'Radcliffe', 'Sinclair', 'Thornton', 'Underwood', 'Valentine', 'Waterman', 'Yates', 'Zimmer', 'Ashford',
  'Belmonte', 'Castillo', 'Easton', 'Fontaine', 'Galloway', 'Hawthorne', 'Ingram', 'Jurado', 'Keller', 'Langston',
  'Marsh', 'Norwood', 'Pennington', 'Ridley', 'Stoll', 'Tennyson', 'Ulrich', 'Wexler', 'Ackerman', 'Bauer',
];

const usedNames = new Set<string>();
function uniqueName(): string {
  for (let attempt = 0; attempt < 5000; attempt++) {
    const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  throw new Error('Ran out of unique names');
}

interface TeamSeed {
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  primaryColor: string;
  secondaryColor: string;
}

const TEAMS: TeamSeed[] = [
  { name: 'Ironforge Anvils', abbreviation: 'IRO', conference: 'Vanguard', division: 'North', primaryColor: '#b45309', secondaryColor: '#1f2937' },
  { name: 'Northgate Sentinels', abbreviation: 'NGS', conference: 'Vanguard', division: 'North', primaryColor: '#2563eb', secondaryColor: '#0f172a' },
  { name: 'Harbor City Mariners', abbreviation: 'HCM', conference: 'Vanguard', division: 'East', primaryColor: '#0ea5e9', secondaryColor: '#0c4a6e' },
  { name: 'Easton Monarchs', abbreviation: 'EAM', conference: 'Vanguard', division: 'East', primaryColor: '#7c3aed', secondaryColor: '#2e1065' },
  { name: 'Delta Gators', abbreviation: 'DEL', conference: 'Vanguard', division: 'South', primaryColor: '#16a34a', secondaryColor: '#14532d' },
  { name: 'Sunfall Comets', abbreviation: 'SUN', conference: 'Vanguard', division: 'South', primaryColor: '#f59e0b', secondaryColor: '#7c2d12' },
  { name: 'Summit Pioneers', abbreviation: 'SMT', conference: 'Vanguard', division: 'West', primaryColor: '#ea580c', secondaryColor: '#431407' },
  { name: 'Desert Coyotes', abbreviation: 'DSC', conference: 'Vanguard', division: 'West', primaryColor: '#d97706', secondaryColor: '#78350f' },
  { name: 'Glacier Wolves', abbreviation: 'GLA', conference: 'Heritage', division: 'North', primaryColor: '#64748b', secondaryColor: '#0f172a' },
  { name: 'Frostpeak Wardens', abbreviation: 'FPW', conference: 'Heritage', division: 'North', primaryColor: '#0891b2', secondaryColor: '#083344' },
  { name: 'Liberty Stags', abbreviation: 'LIB', conference: 'Heritage', division: 'East', primaryColor: '#dc2626', secondaryColor: '#450a0a' },
  { name: 'Capital Griffins', abbreviation: 'CAP', conference: 'Heritage', division: 'East', primaryColor: '#ca8a04', secondaryColor: '#422006' },
  { name: 'Magnolia Stallions', abbreviation: 'MAG', conference: 'Heritage', division: 'South', primaryColor: '#db2777', secondaryColor: '#500724' },
  { name: 'Gulfport Sharks', abbreviation: 'GLF', conference: 'Heritage', division: 'South', primaryColor: '#0d9488', secondaryColor: '#042f2e' },
  { name: 'Redrock Vipers', abbreviation: 'RRV', conference: 'Heritage', division: 'West', primaryColor: '#b91c1c', secondaryColor: '#450a0a' },
  { name: 'Pacific Surge', abbreviation: 'PAC', conference: 'Heritage', division: 'West', primaryColor: '#2563eb', secondaryColor: '#082f49' },
];

const ROSTER_COMP: Record<Position, number> = { QB: 3, RB: 4, WR: 6, TE: 3 };

interface PlayerSeed {
  teamAbbr: string;
  name: string;
  position: Position;
  overallRating: number;
  currentValue: number;
  isTopPlayer: boolean;
}

function buildRoster(teamAbbr: string): PlayerSeed[] {
  const roster: PlayerSeed[] = [];
  (Object.keys(ROSTER_COMP) as Position[]).forEach((pos) => {
    const count = ROSTER_COMP[pos];
    for (let i = 0; i < count; i++) {
      const base = i === 0 ? gaussian(86, 6) : gaussian(72, 8);
      const rating = clamp(Math.round(base), 58, 99);
      roster.push({
        teamAbbr,
        name: uniqueName(),
        position: pos,
        overallRating: rating,
        currentValue: valueFromRating(rating),
        isTopPlayer: false,
      });
    }
  });
  // Mark the 5 highest-rated players per team as "top players".
  [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 5).forEach((p) => (p.isTopPlayer = true));
  return roster;
}

async function main() {
  console.log('Clearing existing data...');
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
  await prisma.lineupWeekScore.deleteMany();
  await prisma.leagueWeek.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating users...');
  const botHash = await bcrypt.hash(`bot-${Math.random()}`, 10);
  const demoHash = await bcrypt.hash('demo1234', 10);
  await prisma.user.create({
    data: { username: '__bot__', passwordHash: botHash, isBot: true, tokens: 1_000_000, cases: 0, rating: 1000 },
  });
  await prisma.user.create({
    data: { username: 'demo', email: 'demo@rip.gg', passwordHash: demoHash, tokens: 5000, cases: 5, dust: 0, rating: 1000 },
  });

  console.log('Creating teams...');
  await prisma.team.createMany({ data: TEAMS });
  const teams = await prisma.team.findMany();
  const teamIdByAbbr = new Map(teams.map((t) => [t.abbreviation, t.id]));

  console.log('Creating players...');
  const playerSeeds: PlayerSeed[] = TEAMS.flatMap((t) => buildRoster(t.abbreviation));
  await prisma.player.createMany({
    data: playerSeeds.map((p) => ({
      teamId: teamIdByAbbr.get(p.teamAbbr)!,
      name: p.name,
      position: p.position,
      overallRating: p.overallRating,
      currentValue: p.currentValue,
      isTopPlayer: p.isTopPlayer,
    })),
  });
  const players = await prisma.player.findMany({ select: { id: true } });

  console.log(`Creating card templates (${players.length} players x ${PARALLELS.length} parallels)...`);
  const templateData = players.flatMap((pl) =>
    PARALLELS.map((par) => ({
      playerId: pl.id,
      parallel: par.name,
      printRun: par.printRun,
      valueMultiplier: par.valueMultiplier,
      nextSerial: 0,
    })),
  );
  await prisma.cardTemplate.createMany({ data: templateData });

  console.log('Creating products...');
  await prisma.product.createMany({
    data: [
      {
        name: 'Topps Chrome 2026',
        year: 2026,
        entryCost: 100,
        caseCost: 0,
        tier: 'fresh',
        cardsPerPack: 5,
        description: 'Fresh-season flagship. Reliable base with a real shot at a refractor hit.',
        topPlayerBias: 0.4,
        pullRates: { BASE: 880, BLUE: 90, PURPLE: 22, GOLD: 6, BLACK: 1.5, EMERALD: 0.4, SUPERFRACTOR: 0.1 },
      },
      {
        name: 'Prizm Legacy 2025',
        year: 2025,
        entryCost: 150,
        caseCost: 0,
        tier: 'legacy',
        cardsPerPack: 5,
        description: 'Last season legacy product. Better mid-tier parallels for the patient collector.',
        topPlayerBias: 0.5,
        pullRates: { BASE: 820, BLUE: 120, PURPLE: 38, GOLD: 14, BLACK: 5, EMERALD: 2, SUPERFRACTOR: 0.3 },
      },
      {
        name: 'Premier Vault',
        year: 2026,
        entryCost: 500,
        caseCost: 1,
        tier: 'chase',
        cardsPerPack: 6,
        description: 'Chase-heavy premium box. Costs a case. Every card has elevated hit odds.',
        topPlayerBias: 0.7,
        pullRates: { BASE: 600, BLUE: 200, PURPLE: 110, GOLD: 60, BLACK: 22, EMERALD: 6, SUPERFRACTOR: 2 },
      },
    ],
  });

  console.log('Creating opening league week...');
  await prisma.leagueWeek.create({
    data: { season: 1, weekNumber: 1, isCurrent: true, simulatedAt: null },
  });

  const counts = {
    users: await prisma.user.count(),
    teams: await prisma.team.count(),
    players: await prisma.player.count(),
    templates: await prisma.cardTemplate.count(),
    products: await prisma.product.count(),
  };
  console.log('Seed complete:', counts);
  console.log('Demo login -> username: demo  password: demo1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
