import type { Position } from '@rip/shared';

// Deterministic league data. The same RNG seed + generation order is used by the
// seed script and the portrait baker, so player names/positions are stable across
// reseeds and match the deployed database (the baker keys images by name slug).

export interface TeamSeed {
  name: string;
  abbreviation: string;
  conference: string;
  division: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface PlayerSeed {
  teamAbbr: string;
  name: string;
  position: Position;
  overallRating: number;
  currentValue: number;
  isTopPlayer: boolean;
  isRookie: boolean;
}

export const TEAMS: TeamSeed[] = [
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

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function valueFromRating(r: number): number {
  return Math.round((Math.pow(Math.max(r - 55, 1) / 44, 2.2) * 75 + 3) * 100) / 100;
}

/** Full deterministic player list (256). Pure — same output every call. */
export function buildAllPlayers(): PlayerSeed[] {
  const rng = mulberry32(1337);
  const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
  const gaussian = (mean: number, sd: number) => {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const usedNames = new Set<string>();
  const uniqueName = (): string => {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`;
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    throw new Error('Ran out of unique names');
  };

  // Last slot of QB, RB, WR per team is the rookie — low rating, big upside.
  const ROOKIE_SLOT: Partial<Record<Position, number>> = { QB: 2, RB: 3, WR: 5 };

  const all: PlayerSeed[] = [];
  for (const team of TEAMS) {
    const roster: PlayerSeed[] = [];
    (Object.keys(ROSTER_COMP) as Position[]).forEach((pos) => {
      for (let i = 0; i < ROSTER_COMP[pos]; i++) {
        const isRookie = ROOKIE_SLOT[pos] === i;
        const rating = clamp(
          Math.round(isRookie ? gaussian(62, 5) : i === 0 ? gaussian(86, 6) : gaussian(72, 8)),
          56, 99,
        );
        roster.push({
          teamAbbr: team.abbreviation,
          name: uniqueName(),
          position: pos,
          overallRating: rating,
          currentValue: valueFromRating(rating),
          isTopPlayer: false,
          isRookie,
        });
      }
    });
    [...roster].sort((a, b) => b.overallRating - a.overallRating).slice(0, 5).forEach((p) => (p.isTopPlayer = true));
    all.push(...roster);
  }
  return all;
}

export function nameSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
