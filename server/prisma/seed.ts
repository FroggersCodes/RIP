import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { PARALLELS } from '@rip/shared';
import { prisma } from '../src/prisma';
import { TEAMS, buildAllPlayers } from '../src/data/roster';

export async function seed() {
  console.log('Clearing existing data...');
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
  const playerSeeds = buildAllPlayers();
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
  const CHROME = { BASE: 8800, BLUE: 950, PURPLE: 200, GOLD: 42, BLACK: 6, AUTOGRAPH: 1, EMERALD: 1.4, SUPERFRACTOR: 0.15 };
  const PRIZM = { BASE: 8400, BLUE: 1150, PURPLE: 300, GOLD: 95, BLACK: 16, AUTOGRAPH: 2.5, EMERALD: 4, SUPERFRACTOR: 0.5 };
  const VAULT = { BASE: 7100, BLUE: 1900, PURPLE: 700, GOLD: 280, BLACK: 40, AUTOGRAPH: 7, EMERALD: 12, SUPERFRACTOR: 1.6 };
  await prisma.product.createMany({
    data: [
      { name: 'Topps Chrome 2026', year: 2026, entryCost: 100, caseCost: 0, tier: 'fresh', setKey: 'chrome', cardsPerPack: 5, description: 'Fresh-season flagship. Reliable base with a real shot at a refractor or auto hit.', topPlayerBias: 0.4, pullRates: CHROME },
      { name: 'Prizm Legacy 2025', year: 2025, entryCost: 150, caseCost: 0, tier: 'legacy', setKey: 'prizm', cardsPerPack: 5, description: 'Last season legacy product. Better mid-tier parallels for the patient collector.', topPlayerBias: 0.5, pullRates: PRIZM },
      { name: 'Premier Vault', year: 2026, entryCost: 500, caseCost: 1, tier: 'chase', setKey: 'vault', cardsPerPack: 6, description: 'Chase-heavy premium pack. Costs a case. Every card has elevated hit odds.', topPlayerBias: 0.7, pullRates: VAULT },
      { name: 'Topps Chrome — Hobby Box', year: 2026, entryCost: 480, caseCost: 0, tier: 'box', setKey: 'chrome', cardsPerPack: 5, packsPerBox: 6, guaranteeNumbered: true, description: '6 packs (30 cards). Every box guarantees at least one numbered card.', topPlayerBias: 0.45, pullRates: CHROME },
      { name: 'Premier Vault — Hobby Box', year: 2026, entryCost: 2400, caseCost: 1, tier: 'box', setKey: 'vault', cardsPerPack: 5, packsPerBox: 6, guaranteeNumbered: true, description: '6 chase-heavy packs (30 cards), guaranteed numbered — your best shot at autos and 1/1s.', topPlayerBias: 0.7, pullRates: VAULT },
    ],
  });

  console.log('Creating opening league week + clock...');
  await prisma.leagueWeek.create({ data: { season: 1, weekNumber: 1, isCurrent: true, simulatedAt: null } });
  await prisma.leagueState.upsert({ where: { id: 'singleton' }, create: { id: 'singleton' }, update: {} });

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

// Run only when invoked directly (not when imported by seedIfEmpty).
const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (invokedDirectly) {
  seed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
