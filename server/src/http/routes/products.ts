import { Router } from 'express';
import type { Product } from '@prisma/client';
import { PARALLELS, normalizeOdds, packStructureForSet } from '@rip/shared';
import { prisma } from '../../prisma';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';

export function productView(p: Product) {
  const rates = (p.pullRates ?? {}) as Record<string, number>;
  const struct = packStructureForSet(p.setKey);

  // Expected copies of each parallel per pack. Slot-based products (Reliquary,
  // Gold Standard) sum each slot's draw probability (so a parallel that sits in
  // two slots — e.g. an auto in both the auto and random slots — counts in both).
  // Flat products use the normalized per-card odds across `cardsPerPack` cards.
  const perPackByName = new Map<string, number>();
  if (struct) {
    for (const slot of struct.pack) {
      const pool = struct.pools[slot] ?? [];
      const total = pool.reduce((a, n) => a + (rates[n] ?? 0), 0);
      for (const name of pool) {
        const prob = total > 0 ? (rates[name] ?? 0) / total : 1 / pool.length;
        perPackByName.set(name, (perPackByName.get(name) ?? 0) + prob);
      }
    }
  } else {
    const norm = normalizeOdds(rates);
    for (const par of PARALLELS) {
      if ((rates[par.name] ?? 0) > 0) perPackByName.set(par.name, (norm[par.name] ?? 0) * p.cardsPerPack);
    }
  }

  const odds = PARALLELS.filter((par) => (perPackByName.get(par.name) ?? 0) > 0).map((par) => {
    const perPack = perPackByName.get(par.name) ?? 0;
    return {
      parallel: par.name,
      displayName: par.displayName,
      printRun: par.printRun,
      refractor: par.refractor,
      color: par.color,
      perPack: Math.round(perPack * 1_000_000) / 1_000_000,
      oneInPacks: perPack > 0 ? Math.round(1 / perPack) : null,
    };
  });
  return {
    id: p.id,
    name: p.name,
    year: p.year,
    entryCost: p.entryCost,
    caseCost: p.caseCost,
    gemCost: p.gemCost,
    tier: p.tier,
    setKey: p.setKey,
    cardsPerPack: p.cardsPerPack,
    packsPerBox: p.packsPerBox,
    guaranteeNumbered: p.guaranteeNumbered,
    description: p.description,
    topPlayerBias: p.topPlayerBias,
    totalBoxes: p.totalBoxes,
    boxesOpened: p.boxesOpened,
    boxesRemaining: p.totalBoxes != null ? Math.max(0, p.totalBoxes - p.boxesOpened) : null,
    soldOut: p.totalBoxes != null && p.boxesOpened >= p.totalBoxes,
    odds,
  };
}

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const products = await prisma.product.findMany({ where: { isActive: true }, orderBy: { entryCost: 'asc' } });
    res.json({ products: products.map(productView) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!p) throw new AppError(404, 'Product not found');
    res.json({ product: productView(p) });
  }),
);

export default router;
