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

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Maps a sequential allocation index (0-based) to a pseudo-random serial within
 * 1..printRun using a Fisher-Yates shuffle seeded from the template ID. The
 * mapping is a bijection, so uniqueness is preserved; nextSerial stays the
 * race-safe atomic counter it already is.
 */
function shuffledSerial(templateId: string, index: number, printRun: number): number {
  if (printRun === 1) return 1;
  const rng = mulberry32(fnv1a(templateId));
  const arr = Array.from({ length: printRun }, (_, i) => i + 1);
  for (let i = printRun - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr[index]!;
}

export interface PlayerPoolEntry {
  id: string;
  name: string;
  position: Position;
  currentValue: number;
  isTopPlayer: boolean;
  isRookie: boolean;
  teamName: string;
  teamAbbr: string;
  teamPrimaryColor: string;
  teamSecondaryColor: string;
}

export interface PulledCard {
  instanceId: string;
  player: {
    id: string;
    name: string;
    position: Position;
    currentValue: number;
    isRookie: boolean;
    teamName: string;
    teamAbbr: string;
    teamPrimaryColor: string;
    teamSecondaryColor: string;
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
      isRookie: true,
      team: { select: { name: true, abbreviation: true, primaryColor: true, secondaryColor: true } },
    },
  });
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    position: p.position,
    currentValue: p.currentValue,
    isTopPlayer: p.isTopPlayer,
    isRookie: p.isRookie,
    teamName: p.team.name,
    teamAbbr: p.team.abbreviation,
    teamPrimaryColor: p.team.primaryColor,
    teamSecondaryColor: p.team.secondaryColor,
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

/** Base cards pick any player uniformly; hits bias toward top players; PATCH_AUTO always picks a rookie. */
export function pickPlayer(
  parallel: ParallelName,
  topPlayerBias: number,
  pool: PlayerPoolEntry[],
): PlayerPoolEntry {
  // Rookie Patch Autos always feature a rookie player.
  if (parallel === 'PATCH_AUTO') {
    const rookies = pool.filter((p) => p.isRookie);
    if (rookies.length > 0) return rookies[Math.floor(Math.random() * rookies.length)]!;
  }
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
  // nextSerial is 1-based after the increment; map to a pseudo-random serial via
  // a bijective shuffle so collectors see e.g. #147/250 instead of #1/250.
  const serial = shuffledSerial(r.id, r.nextSerial - 1, r.printRun);
  return { templateId: r.id, serial, valueMultiplier: r.valueMultiplier, printRun: r.printRun };
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

/** Weighted roll restricted to hit-quality parallels (GOLD and rarer). */
export function rollHitParallel(pullRates: Record<string, number>): ParallelName {
  const hitNames: ParallelName[] = ['GOLD', 'PATCH', 'BLACK', 'AUTOGRAPH', 'EMERALD', 'SUPERFRACTOR'];
  const entries = hitNames.map((n) => [n, pullRates[n] ?? 0] as const).filter(([, w]) => w > 0);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  if (total <= 0) return 'GOLD';
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
      isRookie: player.isRookie,
      teamName: player.teamName,
      teamAbbr: player.teamAbbr,
      teamPrimaryColor: player.teamPrimaryColor,
      teamSecondaryColor: player.teamSecondaryColor,
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
  /** Box guarantee: ensure at least this many hit-quality cards (GOLD+) in the whole opening. */
  minHits?: number;
  /** Dev luck: exponentially boosts rarer tiers (1 = normal odds). */
  luck?: number;
  /** Dev force: every card is pulled as this parallel (overrides the roll). */
  force?: string | null;
}

/** Multiply each tier's weight by luck^rarity, so the rarest get boosted most. */
export function applyLuck(pullRates: Record<string, number>, luck: number): Record<string, number> {
  if (!luck || luck === 1) return pullRates;
  const out: Record<string, number> = {};
  PARALLEL_NAMES.forEach((name, i) => {
    out[name] = (pullRates[name] ?? 0) * Math.pow(luck, i);
  });
  return out;
}

/** Roll and allocate `count` cards to ownerId. Must be called inside a transaction. */
export async function openPack(tx: Tx, args: OpenPackArgs): Promise<PulledCard[]> {
  const rates = applyLuck(args.pullRates, args.luck ?? 1);
  // Dev force: if set to a valid parallel, every card is rolled as that tier.
  const forced =
    args.force && PARALLEL_NAMES.includes(args.force as ParallelName) ? (args.force as ParallelName) : null;
  const cards: PulledCard[] = [];
  for (let i = 0; i < args.count; i++) {
    const rolled = forced ?? rollParallel(rates);
    const player = pickPlayer(rolled, args.topPlayerBias, args.pool);
    const resolved = await allocateWithFallback(tx, player.id, rolled, args.ownerId, args.setKey);
    cards.push(buildPulledCard(player, resolved, args.setKey));
  }

  // Box guarantee: if nothing numbered came out, upgrade one card to a numbered pull.
  if (args.guaranteeNumbered && cards.length > 0 && !cards.some((c) => c.serial !== null)) {
    const idx = cards.length - 1;
    await tx.cardInstance.delete({ where: { id: cards[idx]!.instanceId } });
    const rolled = rollNumberedParallel(rates);
    const player = pickPlayer(rolled, args.topPlayerBias, args.pool);
    const resolved = await allocateWithFallback(tx, player.id, rolled, args.ownerId, args.setKey);
    cards[idx] = buildPulledCard(player, resolved, args.setKey);
  }

  // Box guarantee: upgrade lowest-rarity cards until minHits hit-quality cards exist.
  const needed = (args.minHits ?? 0) - cards.filter((c) => c.isHit).length;
  if (needed > 0) {
    const upgradeable = cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !c.isHit)
      .slice(0, needed);
    for (const { i } of upgradeable) {
      await tx.cardInstance.delete({ where: { id: cards[i]!.instanceId } });
      const rolled = rollHitParallel(rates);
      const player = pickPlayer(rolled, args.topPlayerBias, args.pool);
      const resolved = await allocateWithFallback(tx, player.id, rolled, args.ownerId, args.setKey);
      cards[i] = buildPulledCard(player, resolved, args.setKey);
    }
  }

  return cards;
}
