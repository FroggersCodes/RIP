import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PARALLEL_MAP, PARALLEL_NAMES, type ParallelName, type Position } from '@rip/shared';
import { allocateNumberedSerial, allocateWithFallback } from '../src/ripping/pullEngine';

const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });

let ownerId: string;
let playerA: string; // full parallel set
let playerB: string; // EMERALD + BASE only

async function clearAll() {
  await db.lineupSlot.deleteMany();
  await db.lineupWeekScore.deleteMany();
  await db.valueHistory.deleteMany();
  await db.playerGameStat.deleteMany();
  await db.game.deleteMany();
  await db.battle.deleteMany();
  await db.cardInstance.deleteMany();
  await db.cardTemplate.deleteMany();
  await db.player.deleteMany();
  await db.team.deleteMany();
  await db.product.deleteMany();
  await db.leagueWeek.deleteMany();
  await db.user.deleteMany();
}

async function makePlayer(teamId: string, name: string, position: Position, parallels: ParallelName[]) {
  const player = await db.player.create({
    data: { teamId, name, position, overallRating: 92, currentValue: 50, isTopPlayer: true },
  });
  for (const par of parallels) {
    const def = PARALLEL_MAP[par];
    await db.cardTemplate.create({
      data: { playerId: player.id, parallel: par, printRun: def.printRun, valueMultiplier: def.valueMultiplier },
    });
  }
  return player.id;
}

/** One isolated transaction: atomically allocate a serial and insert the owned instance. */
async function allocateOnce(playerId: string, parallel: ParallelName): Promise<number | null> {
  return db.$transaction(
    async (tx) => {
      const a = await allocateNumberedSerial(tx, playerId, parallel);
      if (!a) return null;
      await tx.cardInstance.create({ data: { templateId: a.templateId, serial: a.serial, ownerId } });
      return a.serial;
    },
    { maxWait: 30000, timeout: 30000 },
  );
}

beforeAll(async () => {
  await clearAll();
  const team = await db.team.create({
    data: {
      name: 'Test Team',
      abbreviation: 'TST',
      conference: 'Test',
      division: 'Test',
      primaryColor: '#fff',
      secondaryColor: '#000',
    },
  });
  const owner = await db.user.create({ data: { username: `owner_${Date.now()}`, passwordHash: 'x' } });
  ownerId = owner.id;
  playerA = await makePlayer(team.id, 'Star A', 'WR', PARALLEL_NAMES);
  playerB = await makePlayer(team.id, 'Star B', 'WR', ['EMERALD', 'BASE']);
});

afterAll(async () => {
  await db.$disconnect();
});

describe('race-safe serial allocation', () => {
  it('allocates unique serials and enforces the print run under heavy concurrency (Gold /250)', async () => {
    const ATTEMPTS = 400;
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () => allocateOnce(playerA, 'GOLD')),
    );
    const serials = results.filter((s): s is number => s !== null);
    const nulls = results.filter((s) => s === null);

    // Exactly the print run was issued, no more.
    expect(serials.length).toBe(250);
    expect(nulls.length).toBe(ATTEMPTS - 250);

    // Zero duplicate serials, and they are precisely 1..250.
    expect(new Set(serials).size).toBe(250);
    const sorted = [...serials].sort((a, b) => a - b);
    expect(sorted[0]).toBe(1);
    expect(sorted[249]).toBe(250);

    // The database agrees: 250 rows, 250 distinct serials.
    const rows = await db.cardInstance.findMany({
      where: { template: { is: { playerId: playerA, parallel: 'GOLD' } } },
      select: { serial: true },
    });
    expect(rows.length).toBe(250);
    expect(new Set(rows.map((r) => r.serial)).size).toBe(250);
  });

  it('never exceeds a tiny print run either (Emerald /10, 200 concurrent attempts)', async () => {
    const results = await Promise.all(Array.from({ length: 200 }, () => allocateOnce(playerB, 'EMERALD')));
    const serials = results.filter((s): s is number => s !== null);
    expect(serials.length).toBe(10);
    expect(new Set(serials).size).toBe(10);
    expect([...serials].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('falls back to Base when the numbered parallel is sold out and nothing in between exists', async () => {
    // playerB's Emerald /10 is now exhausted; only Base remains for it.
    for (let i = 0; i < 5; i++) {
      const r = await db.$transaction((tx) => allocateWithFallback(tx, playerB, 'EMERALD', ownerId, 'chrome'));
      expect(r.parallel).toBe('BASE');
      expect(r.serial).toBeNull();
    }
  });

  it('falls back to the next available numbered parallel when one exists', async () => {
    // playerA has Superfractor /1 then Emerald /10 with capacity.
    const first = await db.$transaction((tx) => allocateWithFallback(tx, playerA, 'SUPERFRACTOR', ownerId, 'chrome'));
    expect(first.parallel).toBe('SUPERFRACTOR');
    expect(first.serial).toBe(1);

    const second = await db.$transaction((tx) => allocateWithFallback(tx, playerA, 'SUPERFRACTOR', ownerId, 'chrome'));
    expect(second.parallel).toBe('EMERALD'); // Superfractor sold out -> next more-common with capacity
    expect(second.serial).toBeGreaterThanOrEqual(1);
  });
});
