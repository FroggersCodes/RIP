import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import { requireAuth, userId, type AuthedRequest } from '../middleware';
import { asyncHandler } from '../asyncHandler';
import { AppError } from '../../errors';
import { publicUser } from '../serialize';
import { cardInclude, cardView } from '../../cards/cardView';
import { grant, spendTokensAndCases } from '../../economy/wallet';

const HOUSE_SELL_RATE = 0.8; // tokens you get selling to the house, vs market value
const MARKET_FEE = 0.05; // taken from the sale price as a token sink

const router = Router();

// ---- browse active listings ----
router.get(
  '/listings',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const parallel = typeof req.query.parallel === 'string' ? req.query.parallel : undefined;
    const position = typeof req.query.position === 'string' ? req.query.position : undefined;
    const sort = req.query.sort === 'value' ? 'value' : req.query.sort === 'recent' ? 'recent' : 'price';

    const where: Prisma.ListingWhereInput = {
      status: 'ACTIVE',
      cardInstance: {
        template: {
          ...(parallel ? { parallel: parallel as Prisma.CardTemplateWhereInput['parallel'] } : {}),
          ...(position ? { player: { position: position as Prisma.PlayerWhereInput['position'] } } : {}),
        },
      },
    };
    const listings = await prisma.listing.findMany({
      where,
      take: 80,
      orderBy: sort === 'price' ? { priceTokens: 'asc' } : { createdAt: 'desc' },
      include: { cardInstance: { include: cardInclude }, seller: { select: { username: true } } },
    });
    let rows = listings.map((l) => ({
      listingId: l.id,
      priceTokens: l.priceTokens,
      seller: l.seller.username,
      card: cardView(l.cardInstance),
    }));
    if (sort === 'value') rows = rows.sort((a, b) => b.card.marketValue - a.card.marketValue);
    res.json({ listings: rows });
  }),
);

router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const listings = await prisma.listing.findMany({
      where: { sellerId: userId(req), status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { cardInstance: { include: cardInclude } },
    });
    res.json({ listings: listings.map((l) => ({ listingId: l.id, priceTokens: l.priceTokens, card: cardView(l.cardInstance) })) });
  }),
);

const idSchema = z.object({ instanceId: z.string().min(1) });

// ---- sell to the house for tokens (instant) ----
router.post(
  '/sell',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { instanceId } = idSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const inst = await tx.cardInstance.findUnique({ where: { id: instanceId }, include: cardInclude });
      if (!inst || inst.ownerId !== uid) throw new AppError(404, 'Card not found in your collection');
      if (inst.lineupSlot) throw new AppError(409, 'Unequip the card first');
      if (inst.listing) throw new AppError(409, 'Card is listed on the market; cancel the listing first');
      const bot = await tx.user.findFirst({ where: { isBot: true } });
      if (!bot) throw new AppError(500, 'No house account');
      const payout = Math.max(1, Math.round(cardView(inst).marketValue * HOUSE_SELL_RATE));
      await tx.cardInstance.update({ where: { id: inst.id }, data: { ownerId: bot.id } });
      await grant(tx, uid, { tokens: payout });
      return { payout };
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    res.json({ sold: true, tokens: result.payout, user: publicUser(user) });
  }),
);

// ---- list a card for sale ----
const listSchema = z.object({ instanceId: z.string().min(1), priceTokens: z.number().int().min(1).max(100_000_000) });
router.post(
  '/list',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { instanceId, priceTokens } = listSchema.parse(req.body);
    const inst = await prisma.cardInstance.findUnique({ where: { id: instanceId }, include: cardInclude });
    if (!inst || inst.ownerId !== uid) throw new AppError(404, 'Card not found in your collection');
    if (inst.lineupSlot) throw new AppError(409, 'Unequip the card before listing it');
    if (inst.listing) throw new AppError(409, 'Card is already listed');
    await prisma.listing.create({ data: { sellerId: uid, cardInstanceId: instanceId, priceTokens } });
    res.json({ listed: true });
  }),
);

const listingIdSchema = z.object({ listingId: z.string().min(1) });

router.post(
  '/cancel',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { listingId } = listingIdSchema.parse(req.body);
    const listing = await prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.sellerId !== uid) throw new AppError(404, 'Listing not found');
    await prisma.listing.delete({ where: { id: listingId } });
    res.json({ cancelled: true });
  }),
);

// ---- buy a listing ----
router.post(
  '/buy',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const uid = userId(req);
    const { listingId } = listingIdSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.listing.findUnique({ where: { id: listingId }, include: { cardInstance: { include: cardInclude } } });
      if (!listing || listing.status !== 'ACTIVE') throw new AppError(404, 'Listing no longer available');
      if (listing.sellerId === uid) throw new AppError(400, 'You cannot buy your own listing');
      // Buyer pays the full price (overdraft-safe).
      await spendTokensAndCases(tx, uid, listing.priceTokens, 0);
      // Seller receives price minus the market fee (the fee is a token sink).
      const proceeds = Math.max(0, Math.round(listing.priceTokens * (1 - MARKET_FEE)));
      await grant(tx, listing.sellerId, { tokens: proceeds });
      // Transfer the card; remove from any lineup slot defensively; close the listing.
      await tx.lineupSlot.updateMany({ where: { cardInstanceId: listing.cardInstanceId }, data: { cardInstanceId: null } });
      await tx.cardInstance.update({ where: { id: listing.cardInstanceId }, data: { ownerId: uid } });
      await tx.listing.delete({ where: { id: listing.id } });
      return { card: cardView(listing.cardInstance), proceeds, price: listing.priceTokens };
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    res.json({ bought: true, card: result.card, paid: result.price, user: publicUser(user) });
  }),
);

export default router;
