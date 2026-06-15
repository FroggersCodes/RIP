import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { AppError } from '../errors';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import ripRouter from './routes/rip';

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

  app.use(errorHandler);
  return app;
}
