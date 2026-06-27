import { InsufficientFundsError } from '../errors';
import type { Tx } from '../prisma';

/**
 * Conditional, atomic balance changes. The WHERE guard means the row only updates
 * when funds are sufficient, so two concurrent spends can never overdraw — the DB
 * serializes them and the loser updates 0 rows.
 */
export async function spendTokensAndCases(tx: Tx, userId: string, tokens: number, cases: number): Promise<void> {
  const n = await tx.$executeRaw`
    UPDATE "User" SET tokens = tokens - ${tokens}, cases = cases - ${cases}
    WHERE id = ${userId} AND tokens >= ${tokens} AND cases >= ${cases}`;
  if (n === 0) throw new InsufficientFundsError('Not enough tokens or cases');
}

export async function spendGems(tx: Tx, userId: string, gems: number): Promise<void> {
  const n = await tx.$executeRaw`
    UPDATE "User" SET gems = gems - ${gems}
    WHERE id = ${userId} AND gems >= ${gems}`;
  if (n === 0) throw new InsufficientFundsError('Not enough gems');
}

export async function grant(
  tx: Tx,
  userId: string,
  amounts: { tokens?: number; cases?: number; gems?: number },
): Promise<void> {
  await tx.$executeRaw`
    UPDATE "User"
    SET tokens = tokens + ${amounts.tokens ?? 0},
        cases = cases + ${amounts.cases ?? 0},
        gems = gems + ${amounts.gems ?? 0}
    WHERE id = ${userId}`;
}
