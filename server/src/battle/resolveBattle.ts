import { prisma } from '../prisma';
import { withTxRetry } from '../db/withTxRetry';
import { AppError } from '../errors';
import { loadPlayerPool, openPack, type PulledCard } from '../ripping/pullEngine';
import { getLuck } from '../league/clock';
import { grant, spendTokensAndCases } from '../economy/wallet';

const WIN_TOKEN_MULTIPLIER = 1.8;
const CONSOLATION_MULTIPLIER = 0.25;
const WIN_RATING = 20;
const LOSS_RATING = -12;

export interface BattleOutcome {
  battleId: string;
  result: 'win' | 'loss' | 'tie';
  challengerCards: PulledCard[];
  opponentCards: PulledCard[];
  challengerTotal: number;
  opponentTotal: number;
  rewardTokens: number;
  rewardCases: number;
  ratingDelta: number;
}

const sum = (cards: PulledCard[]) => Math.round(cards.reduce((a, c) => a + c.marketValue, 0) * 100) / 100;

/**
 * Resolve a head-to-head against the house bot. Both sides open the same product;
 * pulls are real, uniquely-allocated serials. The challenger keeps their pulls and
 * the bot keeps its pulls (uniqueness holds either way). Higher market-value total
 * wins tokens + a case + rating; a loss returns a small consolation.
 *
 * Structured so a future USER/SNAPSHOT opponent can replace the bot side.
 */
export async function resolveBattleVsBot(challengerId: string, productId: string): Promise<BattleOutcome> {
  return withTxRetry(() =>
    prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product || !product.isActive) throw new AppError(404, 'Product not found');
        const bot = await tx.user.findFirst({ where: { isBot: true } });
        if (!bot) throw new AppError(500, 'No bot opponent configured');

        const wager = product.entryCost;
        await spendTokensAndCases(tx, challengerId, wager, product.caseCost);

        const pool = await loadPlayerPool(tx);
        const packArgs = {
          pullRates: product.pullRates as Record<string, number>,
          topPlayerBias: product.topPlayerBias,
          count: product.cardsPerPack,
          pool,
          setKey: product.setKey,
          luck: await getLuck(),
        };
        const challengerCards = await openPack(tx, { ownerId: challengerId, ...packArgs });
        const opponentCards = await openPack(tx, { ownerId: bot.id, ...packArgs });

        const challengerTotal = sum(challengerCards);
        const opponentTotal = sum(opponentCards);

        let winnerId: string | null;
        let result: 'win' | 'loss' | 'tie';
        let rewardTokens: number;
        let rewardCases: number;
        let ratingDelta: number;
        if (challengerTotal > opponentTotal) {
          winnerId = challengerId;
          result = 'win';
          rewardTokens = Math.round(wager * WIN_TOKEN_MULTIPLIER);
          rewardCases = 1;
          ratingDelta = WIN_RATING;
        } else if (opponentTotal > challengerTotal) {
          winnerId = bot.id;
          result = 'loss';
          rewardTokens = Math.round(wager * CONSOLATION_MULTIPLIER);
          rewardCases = 0;
          ratingDelta = LOSS_RATING;
        } else {
          winnerId = null;
          result = 'tie';
          rewardTokens = wager; // refund
          rewardCases = 0;
          ratingDelta = 0;
        }

        await grant(tx, challengerId, { tokens: rewardTokens, cases: rewardCases });
        if (ratingDelta !== 0) {
          await tx.user.update({ where: { id: challengerId }, data: { rating: { increment: ratingDelta } } });
        }

        const battle = await tx.battle.create({
          data: {
            challengerId,
            opponentId: bot.id,
            opponentType: 'BOT',
            productId,
            challengerPull: challengerCards as unknown as object,
            opponentPull: opponentCards as unknown as object,
            challengerTotal,
            opponentTotal,
            winnerId,
            tokensWagered: wager,
          },
        });

        return {
          battleId: battle.id,
          result,
          challengerCards,
          opponentCards,
          challengerTotal,
          opponentTotal,
          rewardTokens,
          rewardCases,
          ratingDelta,
        } satisfies BattleOutcome;
      },
      { timeout: 30000, maxWait: 20000 },
    ),
  );
}
