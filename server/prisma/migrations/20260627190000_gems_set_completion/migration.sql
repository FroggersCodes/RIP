-- Gems currency replaces Dust; set-completion rewards; gem-only products.

-- AlterTable: User gains gems, loses dust.
ALTER TABLE "User" ADD COLUMN     "gems" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" DROP COLUMN "dust";

-- AlterTable: missions no longer pay dust.
ALTER TABLE "MissionProgress" DROP COLUMN "rewardDust";

-- AlterTable: products can be priced purely in gems.
ALTER TABLE "Product" ADD COLUMN     "gemCost" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: one row per claimed team-within-a-set gem reward.
CREATE TABLE "SetCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "setKey" TEXT NOT NULL,
    "teamAbbr" TEXT NOT NULL,
    "gemsAwarded" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SetCompletion_userId_idx" ON "SetCompletion"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SetCompletion_userId_setKey_teamAbbr_key" ON "SetCompletion"("userId", "setKey", "teamAbbr");

-- AddForeignKey
ALTER TABLE "SetCompletion" ADD CONSTRAINT "SetCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Data: make the already-seeded Reliquary product gem-only on existing databases
-- (fresh seeds set this directly). 50 gems, no tokens/cases.
UPDATE "Product" SET "gemCost" = 50, "entryCost" = 0, "caseCost" = 0 WHERE "setKey" = 'reliquary';
