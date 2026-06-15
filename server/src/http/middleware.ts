import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from './jwt';
import { AppError } from '../errors';
import { env } from '../env';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'Missing bearer token');
  try {
    req.userId = verifyToken(header.slice('Bearer '.length));
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.headers['x-admin-token'] !== env.adminToken) throw new AppError(403, 'Admin token required');
  next();
}

export function userId(req: AuthedRequest): string {
  if (!req.userId) throw new AppError(401, 'Not authenticated');
  return req.userId;
}
