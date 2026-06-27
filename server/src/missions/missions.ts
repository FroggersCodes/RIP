import { prisma } from '../prisma';
import { AppError } from '../errors';
import { grant } from '../economy/wallet';
import type { Tx } from '../prisma';

export type MissionEvent = 'rip' | 'battle' | 'battle_win' | 'equip' | 'daily';

export interface MissionDef {
  key: string;
  label: string;
  period: 'DAILY' | 'ONCE';
  event: MissionEvent;
  target: number;
  rewardTokens?: number;
  rewardCases?: number;
}

export const MISSIONS: MissionDef[] = [
  // Daily — reset every UTC day; the recurring earn loop.
  { key: 'daily_claim', label: 'Claim your daily pack', period: 'DAILY', event: 'daily', target: 1, rewardTokens: 30 },
  { key: 'daily_rip', label: 'Rip 3 packs', period: 'DAILY', event: 'rip', target: 3, rewardTokens: 75 },
  { key: 'daily_battle', label: 'Play a head-to-head', period: 'DAILY', event: 'battle', target: 1, rewardTokens: 50 },
  { key: 'daily_lineup', label: 'Set your lineup', period: 'DAILY', event: 'equip', target: 1, rewardTokens: 30 },
  // One-time onboarding.
  { key: 'onboard_rip', label: 'Open your first pack', period: 'ONCE', event: 'rip', target: 1, rewardTokens: 150 },
  { key: 'onboard_win', label: 'Win your first battle', period: 'ONCE', event: 'battle_win', target: 1, rewardCases: 1 },
  { key: 'onboard_lineup', label: 'Equip your first card', period: 'ONCE', event: 'equip', target: 1, rewardTokens: 75 },
];

function periodKeyFor(period: MissionDef['period']): string {
  return period === 'DAILY' ? new Date().toISOString().slice(0, 10) : 'career';
}

/** Increment progress for every mission listening to `event`. Best-effort. */
export async function bumpMission(userId: string, event: MissionEvent, amount = 1): Promise<void> {
  for (const m of MISSIONS.filter((d) => d.event === event)) {
    const periodKey = periodKeyFor(m.period);
    await prisma.missionProgress.upsert({
      where: { userId_missionKey_periodKey: { userId, missionKey: m.key, periodKey } },
      create: {
        userId,
        missionKey: m.key,
        periodKey,
        progress: Math.min(amount, m.target),
        target: m.target,
        rewardTokens: m.rewardTokens ?? 0,
        rewardCases: m.rewardCases ?? 0,
      },
      update: { progress: { increment: amount } },
    });
    await prisma.missionProgress.updateMany({
      where: { userId, missionKey: m.key, periodKey, progress: { gt: m.target } },
      data: { progress: m.target },
    });
  }
}

export interface MissionView {
  key: string;
  label: string;
  period: 'DAILY' | 'ONCE';
  target: number;
  progress: number;
  claimed: boolean;
  claimable: boolean;
  rewardTokens: number;
  rewardCases: number;
}

export async function listMissions(userId: string): Promise<MissionView[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await prisma.missionProgress.findMany({ where: { userId, periodKey: { in: [today, 'career'] } } });
  const byKey = new Map(rows.map((r) => [`${r.missionKey}|${r.periodKey}`, r]));
  return MISSIONS.map((m) => {
    const row = byKey.get(`${m.key}|${periodKeyFor(m.period)}`);
    const progress = Math.min(row?.progress ?? 0, m.target);
    const claimed = row?.claimed ?? false;
    return {
      key: m.key,
      label: m.label,
      period: m.period,
      target: m.target,
      progress,
      claimed,
      claimable: progress >= m.target && !claimed,
      rewardTokens: m.rewardTokens ?? 0,
      rewardCases: m.rewardCases ?? 0,
    };
  });
}

export async function claimMission(userId: string, key: string): Promise<MissionDef> {
  const def = MISSIONS.find((m) => m.key === key);
  if (!def) throw new AppError(404, 'Unknown mission');
  const periodKey = periodKeyFor(def.period);
  return prisma.$transaction(async (tx: Tx) => {
    const row = await tx.missionProgress.findUnique({
      where: { userId_missionKey_periodKey: { userId, missionKey: key, periodKey } },
    });
    if (!row || row.progress < def.target) throw new AppError(400, 'Mission not complete yet');
    if (row.claimed) throw new AppError(400, 'Reward already claimed');
    await tx.missionProgress.update({ where: { id: row.id }, data: { claimed: true } });
    await grant(tx, userId, { tokens: def.rewardTokens ?? 0, cases: def.rewardCases ?? 0 });
    return def;
  });
}
