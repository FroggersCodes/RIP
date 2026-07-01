-- Hourly coin drip + a daily login-streak coin reward (separate from the daily
-- pack streak above). All additive, nullable so existing rows need no backfill;
-- a NULL "lastHourlyClaimAt" makes the engine accrue from the account's createdAt.
ALTER TABLE "User" ADD COLUMN "loginStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastLoginRewardAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "lastHourlyClaimAt" TIMESTAMP(3);
