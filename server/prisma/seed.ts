import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { PARALLELS, reliquaryBoxCap } from '@rip/shared';
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
    data: { username: 'demo', email: 'demo@rip.gg', passwordHash: demoHash, tokens: 5000, cases: 5, gems: 200, rating: 1000 },
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
      isRookie: p.isRookie,
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
  // Pull rate weights — normalized per card during the roll. Higher = more likely.
  // Tier 1: Spark — cheap, snappy, cardboard-and-foil entry box.
  const SPARK = { BASE: 7200, BLUE: 1460, GOLD: 270, PATCH: 260, AUTOGRAPH: 210 };
  // Tier 2: Momentum — athletic mid box; guaranteed 1 hit per box.
  const MOMENTUM = { BASE: 6200, BLUE: 800, PURPLE: 800, GOLD: 500, PATCH: 400, BLACK: 200, AUTOGRAPH: 300 };
  // Tier 3: Artistry — gallery prestige with its own numbered rainbow, base autographs,
  // and a Rookie Patch Auto chase. Guaranteed 2 hits, strong auto odds.
  const ARTISTRY = {
    BASE: 5000,
    // numbered rainbow
    ART_RED: 1400, ART_BLUE: 1000, ART_GREEN: 700,
    ART_BLUE_ICE: 220, ART_RAINBOW: 150, ART_PURPLE_ICE: 110, ART_GOLD: 60, ART_WHITE: 18, ART_BLACK: 2,
    // base autographs (same rainbow, signed)
    ART_RED_AUTO: 120, ART_BLUE_AUTO: 90, ART_GREEN_AUTO: 70, ART_BLUE_ICE_AUTO: 40,
    ART_RAINBOW_AUTO: 28, ART_PURPLE_ICE_AUTO: 20, ART_GOLD_AUTO: 12, ART_WHITE_AUTO: 5, ART_BLACK_AUTO: 1,
    // rookie patch autos
    ART_RPA_50: 30, ART_RPA_35: 20, ART_RPA_25: 14, ART_RPA_10: 8, ART_RPA_3: 3, ART_RPA_1: 1,
    // Canvas Kings — marquee case-hit insert (~1:24 packs)
    ART_CANVAS_KINGS: 76,
  };
  // Tier 4: Gold Standard — high-end with its own checklist + fixed 8-slot pack
  // (base x2, RC /399, numbered x2, auto, patch, random). Weights bias the roll
  // WITHIN each slot's category pool.
  const GOLD_STANDARD = {
    // rookie RC /399 (its own slot)
    GS_RC: 100,
    // numbered colour rainbow
    GS_GOLD: 1000, GS_GREEN: 700, GS_BLUE: 500, GS_PURPLE: 300, GS_RED: 150,
    GS_ORANGE: 70, GS_BLACK: 25, GS_GOLD_VINYL: 8, GS_SUPER: 1,
    // autograph rainbow
    GS_AUTO: 1000, GS_AUTO_RED: 400, GS_AUTO_GOLD: 150, GS_AUTO_BLACK: 50, GS_AUTO_VINYL: 12, GS_AUTO_1OF1: 1,
    // patch rainbow
    GS_PATCH: 1000, GS_PATCH_RED: 400, GS_PATCH_GOLD: 150, GS_PATCH_BLACK: 50, GS_PATCH_VINYL: 12, GS_PATCH_1OF1: 1,
    // rookie patch auto rainbow (eligible for the random slot)
    GS_RPA: 60, GS_RPA_GOLD: 24, GS_RPA_BLACK: 9, GS_RPA_VINYL: 4, GS_RPA_1OF1: 1,
  };
  // Tier 5: Reliquary — ultra; its own four-tier check-list. Every card numbered,
  // guaranteed 4 hits. No BASE weight, so a box is all numbered reliquary parallels.
  const RELIQUARY = {
    // base rainbow
    RLQ_RC: 1200, RLQ_GREEN: 1200, RLQ_ORANGE: 700, RLQ_RED: 600, RLQ_OFL: 300,
    RLQ_WHITE: 220, RLQ_PINK: 150, RLQ_GOLD: 90, RLQ_GOLD_SHIMMER: 60, RLQ_GREEN_SHIMMER: 18, RLQ_BLACK: 3,
    // patch rainbow
    RLQ_PATCH: 500, RLQ_PATCH_RC: 300, RLQ_PATCH_GREEN: 300, RLQ_PATCH_ORANGE: 200, RLQ_PATCH_RED: 160,
    RLQ_PATCH_OFL: 90, RLQ_PATCH_WHITE: 70, RLQ_PATCH_PINK: 45, RLQ_PATCH_GOLD: 30,
    RLQ_PATCH_GOLD_SHIMMER: 18, RLQ_PATCH_GREEN_SHIMMER: 6, RLQ_PATCH_BLACK: 1,
    // autograph rainbow
    RLQ_AUTO: 300, RLQ_AUTO_ORANGE: 180, RLQ_AUTO_RED: 140, RLQ_AUTO_OFL: 80,
    RLQ_AUTO_GOLD: 30, RLQ_AUTO_GREEN_SHIMMER: 8, RLQ_AUTO_BLACK: 1,
    // rookie patch auto rainbow
    RLQ_RPA: 60, RLQ_RPA_OFL: 36, RLQ_RPA_WHITE: 24, RLQ_RPA_RED: 14,
    RLQ_RPA_GOLD: 9, RLQ_RPA_GOLD_SHIMMER: 6, RLQ_RPA_GREEN_SHIMMER: 3, RLQ_RPA_BLACK: 1,
  };
  // The whole Reliquary print run is finite: cap boxes at the supply the fixed
  // pack structure can draw, so the chase can't be exhausted into base fallback.
  const reliquaryBoxes = reliquaryBoxCap(players.length);
  await prisma.product.createMany({
    data: [
      {
        name: 'Spark', year: 2026, entryCost: 80, caseCost: 0, tier: 'spark',
        setKey: 'spark', cardsPerPack: 6, topPlayerBias: 0.35, pullRates: SPARK,
        description: 'Entry-level 6-card rip. Electric blue foil, crackling static aesthetic. ~70% color parallel, ~25% hit per box.',
      },
      {
        name: 'Momentum', year: 2026, entryCost: 200, caseCost: 0, tier: 'momentum',
        setKey: 'momentum', cardsPerPack: 4, packsPerBox: 2, minHits: 1, topPlayerBias: 0.45, pullRates: MOMENTUM,
        description: '2-pack box (8 cards). Motion-blur speed-line design. Guaranteed ≥1 hit per box.',
      },
      {
        name: 'Artistry', year: 2026, entryCost: 500, caseCost: 0, tier: 'artistry',
        setKey: 'artistry', cardsPerPack: 5, packsPerBox: 2, minHits: 2, topPlayerBias: 0.55, pullRates: ARTISTRY,
        description: '2-pack box (10 cards). Canvas-texture gallery aesthetic with its own numbered rainbow (Red /299 → Black 1/1), on-card base autographs, and a Rookie Patch Auto chase. Guaranteed ≥2 hits.',
      },
      {
        name: 'Gold Standard', year: 2026, entryCost: 1000, caseCost: 1, tier: 'gold-standard',
        setKey: 'gold-standard', cardsPerPack: 8, topPlayerBias: 0.65, pullRates: GOLD_STANDARD,
        description: 'Matte-black, embossed gold foil. Fixed 8-card pack: 2 base, a Rookie /399, 2 numbered, an auto, a patch, and a random auto/patch/RPA. Costs a case.',
      },
      {
        name: 'Reliquary', year: 2026, entryCost: 0, caseCost: 0, gemCost: 50, tier: 'reliquary',
        setKey: 'reliquary', cardsPerPack: 10, minHits: 4, guaranteeNumbered: true, topPlayerBias: 0.75, pullRates: RELIQUARY,
        totalBoxes: reliquaryBoxes,
        description: `Engraved-gold reliquary ultra-premium. Fixed 10-card pack: base, base rookie, 3 numbered, 2 autos, 2 patches, an RPA. Gem-only — costs 50 💎, earned by completing sets. Limited to ${reliquaryBoxes.toLocaleString()} boxes — once they're gone, they're gone.`,
      },
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
