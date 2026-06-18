import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { requireAdmin } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { advanceWeek } from '../../league/advanceWeek';
import { maybeAdvance, updateClock } from '../../league/clock';
import { importNflData } from '../../data/importNfl';
import { seed } from '../../../prisma/seed';
import { PARALLELS } from '@rip/shared';

const router = Router();

// Force-advance one league week (manual / dev).
router.post(
  '/advance-week',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await advanceWeek());
  }),
);

// Advance only if the live clock is due. The GitHub cron calls this on a schedule.
router.post(
  '/tick',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await maybeAdvance());
  }),
);

const clockSchema = z.object({
  cadenceHours: z.number().min(0.05).max(720).optional(),
  lockMinutes: z.number().int().min(0).max(720).optional(),
  autoAdvance: z.boolean().optional(),
  luckBoost: z.number().min(1).max(50).optional(),
  forceParallel: z
    .enum(['BASE', 'BLUE', 'PURPLE', 'GOLD', 'PATCH', 'BLACK', 'AUTOGRAPH', 'PATCH_AUTO', 'EMERALD', 'SUPERFRACTOR'])
    .nullable()
    .optional(),
});

// Tune the clock (cadence, lineup-lock window, on/off) without DB access.
router.put(
  '/clock',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateClock(clockSchema.parse(req.body)));
  }),
);

// DESTRUCTIVE: wipe the league and reseed with real NFL players from open data.
router.post(
  '/import-nfl',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const season = typeof req.body?.season === 'string' ? req.body.season : undefined;
    res.json(await importNflData(season));
  }),
);

// Dev cheat: top up every (non-bot) account with a huge pile of currency.
router.post(
  '/grant',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const r = await prisma.user.updateMany({
      where: { isBot: false },
      data: { tokens: { increment: 1_000_000 }, cases: { increment: 10_000 }, dust: { increment: 100_000 } },
    });
    res.json({ granted: r.count, tokens: 1_000_000, cases: 10_000, dust: 100_000 });
  }),
);

// DESTRUCTIVE: wipe and reseed the generated (fictional) league.
router.post(
  '/reset-fictional',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    await seed();
    res.json({ reset: true });
  }),
);

// Non-destructive: create missing CardTemplates for any parallel not yet seeded.
// Safe to run on a live DB — skips players that already have the template.
router.post(
  '/backfill-templates',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const players = await prisma.player.findMany({ select: { id: true } });
    let created = 0;
    for (const par of PARALLELS) {
      const data = players.map((p) => ({
        playerId: p.id,
        parallel: par.name,
        printRun: par.printRun,
        valueMultiplier: par.valueMultiplier,
        nextSerial: 0,
      }));
      const r = await prisma.cardTemplate.createMany({ data, skipDuplicates: true });
      created += r.count;
    }
    res.json({ created });
  }),
);

export default router;

