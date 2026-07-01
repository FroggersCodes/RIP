import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import ripRouter from './routes/rip';
import dailyRouter from './routes/daily';
import rewardsRouter from './routes/rewards';
import adminRouter from './routes/admin';
import leagueRouter from './routes/league';
import teamsRouter from './routes/teams';
import playersRouter from './routes/players';
import lineupRouter from './routes/lineup';
import cardsRouter from './routes/cards';
import missionsRouter from './routes/missions';
import marketRouter from './routes/market';
import feedRouter from './routes/feed';

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
};

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/rip', ripRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/rewards', rewardsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/league', leagueRouter);
  app.use('/api/teams', teamsRouter);
  app.use('/api/players', playersRouter);
  app.use('/api/lineup', lineupRouter);
  app.use('/api/cards', cardsRouter);
  app.use('/api/missions', missionsRouter);
  app.use('/api/market', marketRouter);
  app.use('/api/feed', feedRouter);

  // Optionally serve the built web app from the same port (single-port deploy,
  // e.g. GitHub Codespaces). In dev the Vite server handles the frontend instead.
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../web/dist');
  if (process.env.SERVE_WEB === 'true' || fs.existsSync(path.join(webDist, 'index.html'))) {
    app.use(express.static(webDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
