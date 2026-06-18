import { Prisma } from '@prisma/client';
import { computeMarketValue, PARALLEL_MAP } from '@rip/shared';

export const cardInclude = Prisma.validator<Prisma.CardInstanceInclude>()({
  template: { include: { player: { include: { team: { select: { name: true, abbreviation: true, primaryColor: true, secondaryColor: true } } } } } },
  lineupSlot: { select: { role: true } },
  listing: { select: { id: true, priceTokens: true } },
});

export type CardWithRels = Prisma.CardInstanceGetPayload<{ include: typeof cardInclude }>;

export function cardView(inst: CardWithRels) {
  const t = inst.template;
  const p = t.player;
  const marketValue = computeMarketValue(p.currentValue, t.valueMultiplier, inst.serial, t.printRun);
  return {
    id: inst.id,
    parallel: t.parallel,
    serial: inst.serial,
    printRun: t.printRun,
    valueMultiplier: t.valueMultiplier,
    marketValue,
    refractor: PARALLEL_MAP[t.parallel]?.refractor ?? false,
    pulledAt: inst.pulledAt,
    setKey: inst.setKey ?? 'chrome',
    equippedRole: inst.lineupSlot?.role ?? null,
    listed: !!inst.listing,
    listPrice: inst.listing?.priceTokens ?? null,
    player: {
      id: p.id,
      name: p.name,
      position: p.position,
      overallRating: p.overallRating,
      currentValue: p.currentValue,
      isRookie: p.isRookie,
      teamName: p.team.name,
      teamAbbr: p.team.abbreviation,
      teamPrimaryColor: p.team.primaryColor,
      teamSecondaryColor: p.team.secondaryColor,
    },
  };
}
