import { Router } from 'express';
import { requireAdmin } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { advanceWeek } from '../../league/advanceWeek';

const router = Router();

// Advance one league week. Guarded by the x-admin-token header so it isn't
// publicly callable. A scheduled job can call advanceWeek() directly.
router.post(
  '/advance-week',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const result = await advanceWeek();
    res.json(result);
  }),
);

export default router;
