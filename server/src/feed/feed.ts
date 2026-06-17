import { PARALLEL_MAP, isHit, type ParallelName } from '@rip/shared';
import { prisma } from '../prisma';

interface FeedCard {
  parallel: ParallelName;
  serial: number | null;
  printRun: number | null;
  marketValue: number;
  player: { name: string };
}

function parallelLabel(p: ParallelName): string {
  return PARALLEL_MAP[p]?.displayName.replace(/\s*1\/1/, '').replace(/\s*\/.*/, '') ?? p;
}

/** Record a feed entry for each rare (hit) card pulled. Best-effort. */
export async function recordPullHits(username: string, cards: FeedCard[]): Promise<void> {
  const hits = cards.filter((c) => isHit(c.parallel));
  for (const c of hits) {
    const serial = c.serial != null ? ` #${c.serial}${c.printRun ? '/' + c.printRun : ''}` : '';
    await prisma.feedEvent.create({
      data: {
        type: 'PULL',
        username,
        parallel: c.parallel,
        marketValue: c.marketValue,
        text: `${username} pulled ${parallelLabel(c.parallel)}${serial} ${c.player.name}`,
      },
    });
  }
}

export async function recordSale(buyer: string, seller: string, card: FeedCard, price: number): Promise<void> {
  const serial = card.serial != null ? ` #${card.serial}` : '';
  await prisma.feedEvent.create({
    data: {
      type: 'SALE',
      username: buyer,
      parallel: card.parallel,
      marketValue: price,
      text: `${buyer} bought ${parallelLabel(card.parallel)}${serial} ${card.player.name} from ${seller} for ${price} tokens`,
    },
  });
}

export async function getFeed(limit = 50) {
  return prisma.feedEvent.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}
