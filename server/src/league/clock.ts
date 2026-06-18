import { prisma } from '../prisma';
import { advanceWeek, type AdvanceResult } from './advanceWeek';

const SINGLETON = 'singleton';

interface State {
  autoAdvance: boolean;
  cadenceHours: number;
  lockMinutes: number;
  lastAdvanceAt: Date;
  luckBoost: number;
  forceParallel: string | null;
}

async function getState(): Promise<State> {
  let s = await prisma.leagueState.findUnique({ where: { id: SINGLETON } });
  if (!s) s = await prisma.leagueState.create({ data: { id: SINGLETON, lastAdvanceAt: new Date() } });
  if (!s.lastAdvanceAt) s = await prisma.leagueState.update({ where: { id: SINGLETON }, data: { lastAdvanceAt: new Date() } });
  return s as State;
}

function compute(s: State) {
  const last = s.lastAdvanceAt.getTime();
  const next = last + s.cadenceHours * 3_600_000;
  const lockAt = next - s.lockMinutes * 60_000;
  const now = Date.now();
  return { next, lockAt, now, locked: s.autoAdvance && now >= lockAt };
}

export interface ClockInfo {
  autoAdvance: boolean;
  cadenceHours: number;
  lockMinutes: number;
  lastAdvanceAt: string;
  nextAdvanceAt: string;
  locked: boolean;
  msToKickoff: number;
  msToLock: number;
  luckBoost: number;
  forceParallel: string | null;
}

export async function getClock(): Promise<ClockInfo> {
  const s = await getState();
  const { next, lockAt, now, locked } = compute(s);
  return {
    autoAdvance: s.autoAdvance,
    cadenceHours: s.cadenceHours,
    lockMinutes: s.lockMinutes,
    lastAdvanceAt: s.lastAdvanceAt.toISOString(),
    nextAdvanceAt: new Date(next).toISOString(),
    locked,
    msToKickoff: Math.max(0, next - now),
    msToLock: Math.max(0, lockAt - now),
    luckBoost: s.luckBoost ?? 1,
    forceParallel: s.forceParallel ?? null,
  };
}

export async function isLineupLocked(): Promise<boolean> {
  return compute(await getState()).locked;
}

export async function getLuck(): Promise<number> {
  return (await getState()).luckBoost ?? 1;
}

/** Dev pull modifiers applied to every opening: luck multiplier + forced parallel. */
export async function getPullMods(): Promise<{ luck: number; force: string | null }> {
  const s = await getState();
  return { luck: s.luckBoost ?? 1, force: s.forceParallel ?? null };
}

/** Advance the league if the cadence has elapsed. Idempotent and concurrency-safe. */
export async function maybeAdvance(): Promise<{ advanced: boolean; result?: AdvanceResult }> {
  const s = await getState();
  if (!s.autoAdvance) return { advanced: false };
  if (Date.now() < compute(s).next) return { advanced: false };
  // Optimistic lock: only the caller that flips lastAdvanceAt proceeds.
  const claimed = await prisma.leagueState.updateMany({
    where: { id: SINGLETON, lastAdvanceAt: s.lastAdvanceAt },
    data: { lastAdvanceAt: new Date() },
  });
  if (claimed.count === 0) return { advanced: false };
  return { advanced: true, result: await advanceWeek() };
}

export async function updateClock(patch: {
  cadenceHours?: number;
  lockMinutes?: number;
  autoAdvance?: boolean;
  luckBoost?: number;
  forceParallel?: string | null;
}) {
  await getState();
  return prisma.leagueState.update({ where: { id: SINGLETON }, data: patch });
}
