import { Router } from 'express';
import type { Product } from '@prisma/client';
import { PARALLELS, normalizeOdds } from '@rip/shared';
import { prisma } from '../../prisma';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';

export function productView(p: Product) {
  const rates = (p.pullRates ?? {}) as Record<string, number>;
  const norm = normalizeOdds(rates);
  const odds = PARALLELS.filter((par) => (rates[par.name] ?? 0) > 0).map((par) => {
    const prob = norm[par.name] ?? 0;
    return {
      parallel: par.name,
      displayName: par.displayName,
      printRun: par.printRun,
      refractor: par.refractor,
      color: par.color,
      percent: Math.round(prob * 1_000_000) / 10_000,
      oneIn: prob > 0 ? Math.round(1 / prob) : null,
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
