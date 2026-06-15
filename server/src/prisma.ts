import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** The interactive-transaction client (no $transaction/$connect, but has model delegates + $queryRaw). */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/** Either the base client or a transaction client — for read helpers that work with both. */
export type DbClient = PrismaClient | Tx;
