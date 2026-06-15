import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../../prisma';
import { signToken } from '../jwt';
import { AppError } from '../../errors';
import { asyncHandler } from '../asyncHandler';
import { publicUser } from '../serialize';
import { requireAuth, userId, type AuthedRequest } from '../middleware';

// New accounts get a starter stash so the loop is immediately playable.
const STARTER_TOKENS = 1000;
const STARTER_CASES = 2;

const router = Router();

const signupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, 'Letters, numbers and underscore only'),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100),
});

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { username, email, password } = signupSchema.parse(req.body);
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
    });
    if (existing) throw new AppError(409, 'Username or email already taken');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, email, passwordHash, tokens: STARTER_TOKENS, cases: STARTER_CASES },
    });
    res.json({ token: signToken(user.id), user: publicUser(user) });
  }),
);

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { usernameOrEmail, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({
      where: { OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
    });
    if (!user || user.isBot) throw new AppError(401, 'Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new AppError(401, 'Invalid credentials');
    res.json({ token: signToken(user.id), user: publicUser(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: userId(req) } });
    if (!user) throw new AppError(404, 'User not found');
    res.json({ user: publicUser(user) });
  }),
);

export default router;
