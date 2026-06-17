import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { advanceWeek } from '../../league/advanceWeek';
import { maybeAdvance, updateClock } from '../../league/clock';

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
});

// Tune the clock (cadence, lineup-lock window, on/off) without DB access.
router.put(
  '/clock',
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateClock(clockSchema.parse(req.body)));
  }),
);

export default router;
