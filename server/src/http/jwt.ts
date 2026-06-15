import jwt from 'jsonwebtoken';
import { env } from '../env';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.jwtSecret) as { sub: string };
  return payload.sub;
}
