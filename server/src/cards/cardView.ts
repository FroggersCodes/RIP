import { Prisma } from '@prisma/client';
import { computeMarketValue, PARALLEL_MAP } from '@rip/shared';

export const cardInclude = Prisma.validator<Prisma.CardInstanceInclude>()({
  template: { include: { player: { include: { team: { select: { name: true, abbreviation: true } } } } } },
  lineupSlot: { select: { role: true } },
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
    equippedRole: inst.lineupSlot?.role ?? null,
    player: {
      id: p.id,
      name: p.name,
      position: p.position,
      overallRating: p.overallRating,
      currentValue: p.currentValue,
      teamName: p.team.name,
      teamAbbr: p.team.abbreviation,
    },
  };
}
