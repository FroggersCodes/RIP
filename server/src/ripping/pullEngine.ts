import {
  PARALLELS_BY_RARITY_DESC,
  PARALLEL_NAMES,
  PARALLEL_MAP,
  computeMarketValue,
  isHit,
  type ParallelName,
  type Position,
} from '@rip/shared';
import type { DbClient, Tx } from '../prisma';

export interface PlayerPoolEntry {
  id: string;
  name: string;
  position: Position;
  currentValue: number;
  isTopPlayer: boolean;
  teamName: string;
  teamAbbr: string;
}

export interface PulledCard {
  instanceId: string;
  player: {
    id: string;
    name: string;
    position: Position;
    currentValue: number;
    teamName: string;
    teamAbbr: string;
  };
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  valueMultiplier: number;
  marketValue: number;
  isHit: boolean;
  refractor: boolean;
  setKey: string;
}

export async function loadPlayerPool(client: DbClient): Promise<PlayerPoolEntry[]> {
  const players = await client.player.findMany({
    select: {
      id: true,
      name: true,
      position: true,
      currentValue: true,
      isTopPlayer: true,
      team: { select: { name: true, abbreviation: true } },
    },
  });
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    currentValue: p.currentValue,
    isTopPlayer: p.isTopPlayer,
    teamName: p.team.name,
    teamAbbr: p.team.abbreviation,
  }));
}

/** Weighted roll over the product's per-card pull-rate table. */
export function rollParallel(pullRates: Record<string, number>): ParallelName {
  const entries = PARALLEL_NAMES.map((n) => [n, pullRates[n] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return 'BASE';
  let r = Math.random() * total;
  for (const [name, w] of entries) {
    r -= w;
    if (r <= 0) return name;
  }
  return entries[entries.length - 1]![0];
}

/** Base cards pick any player uniformly; hits bias toward top players. */
export function pickPlayer(
  parallel: ParallelName,
  topPlayerBias: number,
  pool: PlayerPoolEntry[],
): PlayerPoolEntry {
  if (parallel !== 'BASE' && topPlayerBias > 0) {
    const tops = pool.filter((p) => p.isTopPlayer);
    if (tops.length > 0 && Math.random() < topPlayerBias) {
      return tops[Math.floor(Math.random() * tops.length)]!;
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

interface Allocation {
  templateId: string;
  serial: number;
  valueMultiplier: number;
  printRun: number;
}

/**
 * Atomically allocate the next serial for (player, parallel). This single UPDATE
 * takes a row lock on the template; concurrent allocators serialize on it and can
 * never receive the same serial. Returns null if the print run is exhausted
 * (or no such numbered template exists).
 */
export async function allocateNumberedSerial(
  tx: Tx,
  playerId: string,
  parallel: ParallelName,
): Promise<Allocation | null> {
  const rows = await tx.$queryRaw<
    { id: string; nextSerial: number; valueMultiplier: number; printRun: number }[]
  >`
    UPDATE "CardTemplate"
    SET "nextSerial" = "nextSerial" + 1
    WHERE "playerId" = ${playerId}
      AND "parallel" = ${parallel}::"Parallel"
      AND "printRun" IS NOT NULL
      AND "nextSerial" < "printRun"
    RETURNING "id", "nextSerial", "valueMultiplier", "printRun"
  `;
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { templateId: r.id, serial: r.nextSerial, valueMultiplier: r.valueMultiplier, printRun: r.printRun };
}

export interface ResolvedAllocation {
  instanceId: string;
  templateId: string;
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  valueMultiplier: number;
}

/**
 * Allocate the rolled parallel; if it is sold out, fall back to the next more
 * common parallel, and ultimately to Base (unlimited) which can never fail.
 * Inserts the owned CardInstance and returns it.
 */
export async function allocateWithFallback(
  tx: Tx,
  playerId: string,
  rolled: ParallelName,
  ownerId: string,
  setKey: string,
): Promise<ResolvedAllocation> {
  const order = PARALLELS_BY_RARITY_DESC; // rarest -> Base
  let idx = order.indexOf(rolled);
  if (idx < 0) idx = order.length - 1; // unknown -> base
  for (; idx < order.length; idx++) {
    const parallel = order[idx]!;
    if (parallel === 'BASE') {
      const base = await tx.cardTemplate.findUnique({
        where: { playerId_parallel: { playerId, parallel: 'BASE' } },
        select: { id: true, valueMultiplier: true },
      });
      if (!base) throw new Error(`Missing Base template for player ${playerId}`);
      const inst = await tx.cardInstance.create({
        data: { templateId: base.id, serial: null, ownerId, setKey },
        select: { id: true },
      });
      return {
        instanceId: inst.id,
        templateId: base.id,
        parallel: 'BASE',
        serial: null,
        printRun: null,
        valueMultiplier: base.valueMultiplier,
      };
    }
    const alloc = await allocateNumberedSerial(tx, playerId, parallel);
    if (alloc) {
      const inst = await tx.cardInstance.create({
        data: { templateId: alloc.templateId, serial: alloc.serial, ownerId, setKey },
        select: { id: true },
      });
      return {
        instanceId: inst.id,
        templateId: alloc.templateId,
        parallel,
        serial: alloc.serial,
        printRun: alloc.printRun,
        valueMultiplier: alloc.valueMultiplier,
      };
    }
    // sold out -> try next, more-common parallel
  }
  throw new Error('Allocation fell through without reaching Base');
}

/** Weighted roll restricted to numbered parallels (used for box guarantees). */
export function rollNumberedParallel(pullRates: Record<string, number>): ParallelName {
  const entries = PARALLEL_NAMES.filter((n) => n !== 'BASE')
    .map((n) => [n, pullRates[n] ?? 0] as const)
    .filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return 'BLUE';
  let r = Math.random() * total;
  for (const [name, w] of entries) {
    r -= w;
    if (r <= 0) return name;
  }
  return entries[entries.length - 1]![0];
}

function buildPulledCard(player: PlayerPoolEntry, resolved: ResolvedAllocation, setKey: string): PulledCard {
  return {
    instanceId: resolved.instanceId,
    player: {
      id: player.id,
      name: player.name,
      position: player.position,
      currentValue: player.currentValue,
      teamName: player.teamName,
      teamAbbr: player.teamAbbr,
    },
    parallel: resolved.parallel,
    serial: resolved.serial,
    printRun: resolved.printRun,
    valueMultiplier: resolved.valueMultiplier,
    marketValue: computeMarketValue(player.currentValue, resolved.valueMultiplier, resolved.serial, resolved.printRun),
    isHit: isHit(resolved.parallel),
    refractor: PARALLEL_MAP[resolved.parallel]?.refractor ?? false,
    setKey,
  };
}

export interface OpenPackArgs {
  ownerId: string;
  pullRates: Record<string, number>;
  topPlayerBias: number;
  count: number;
  pool: PlayerPoolEntry[];
  setKey: string;
  /** Box guarantee: ensure at least one numbered card in the whole opening. */
  guaranteeNumbered?: boolean;
}

/** Roll and allocate `count` cards to ownerId. Must be called inside a transaction. */
export async function openPack(tx: Tx, args: OpenPackArgs): Promise<PulledCard[]> {
  const cards: PulledCard[] = [];
  for (let i = 0; i < args.count; i++) {
    const rolled = rollParallel(args.pullRates);
    const player = pickPlayer(rolled, args.topPlayerBias, args.pool);
    const resolved = await allocateWithFallback(tx, player.id, rolled, args.ownerId, args.setKey);
    cards.push(buildPulledCard(player, resolved, args.setKey));
  }

  // Box guarantee: if nothing numbered came out, upgrade one card to a numbered pull.
  if (args.guaranteeNumbered && cards.length > 0 && !cards.some((c) => c.serial !== null)) {
    const idx = cards.length - 1;
    await tx.cardInstance.delete({ where: { id: cards[idx]!.instanceId } });
    const rolled = rollNumberedParallel(args.pullRates);
    const player = pickPlayer(rolled, args.topPlayerBias, args.pool);
    const resolved = await allocateWithFallback(tx, player.id, rolled, args.ownerId, args.setKey);
    cards[idx] = buildPulledCard(player, resolved, args.setKey);
  }
  return cards;
}
