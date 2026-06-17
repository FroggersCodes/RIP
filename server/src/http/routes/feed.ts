import { Router } from 'express';
import { requireAuth } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { getFeed } from '../../feed/feed';

const router = Router();

router.get(
  '/',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const events = await getFeed(50);
    res.json({
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        text: e.text,
        parallel: e.parallel,
        marketValue: e.marketValue,
        createdAt: e.createdAt,
      })),
    });
  }),
);

export default router;
