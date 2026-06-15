-- CreateEnum
CREATE TYPE "Position" AS ENUM ('QB', 'RB', 'WR', 'TE');

-- CreateEnum
CREATE TYPE "Parallel" AS ENUM ('BASE', 'BLUE', 'PURPLE', 'GOLD', 'BLACK', 'EMERALD', 'SUPERFRACTOR');

-- CreateEnum
CREATE TYPE "LineupRole" AS ENUM ('QB', 'WR1', 'WR2', 'RB', 'TE', 'FLEX');

-- CreateEnum
CREATE TYPE "OpponentType" AS ENUM ('BOT', 'USER', 'SNAPSHOT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "cases" INTEGER NOT NULL DEFAULT 0,
    "dust" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER NOT NULL DEFAULT 1000,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    "lastDailyClaimAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "conference" TEXT NOT NULL,
    "division" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL,
    "isTopPlayer" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTemplate" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "parallel" "Parallel" NOT NULL,
    "printRun" INTEGER,
    "valueMultiplier" DOUBLE PRECISION NOT NULL,
    "nextSerial" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CardTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardInstance" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serial" INTEGER,
    "ownerId" TEXT NOT NULL,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entryCost" INTEGER NOT NULL,
    "caseCost" INTEGER NOT NULL DEFAULT 0,
    "tier" TEXT NOT NULL,
    "cardsPerPack" INTEGER NOT NULL DEFAULT 5,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "pullRates" JSONB NOT NULL,
    "topPlayerBias" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "challengerId" TEXT NOT NULL,
    "opponentId" TEXT,
    "opponentType" "OpponentType" NOT NULL DEFAULT 'BOT',
    "productId" TEXT NOT NULL,
    "challengerPull" JSONB NOT NULL,
    "opponentPull" JSONB NOT NULL,
    "challengerTotal" DOUBLE PRECISION NOT NULL,
    "opponentTotal" DOUBLE PRECISION NOT NULL,
    "winnerId" TEXT,
    "tokensWagered" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "LineupRole" NOT NULL,
    "cardInstanceId" TEXT,

    CONSTRAINT "LineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueWeek" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "simulatedAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeagueWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL DEFAULT 0,
    "awayScore" INTEGER NOT NULL DEFAULT 0,
    "played" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGameStat" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "opponentTeamId" TEXT NOT NULL,
    "passYds" INTEGER NOT NULL DEFAULT 0,
    "passTd" INTEGER NOT NULL DEFAULT 0,
    "interceptions" INTEGER NOT NULL DEFAULT 0,
    "rushYds" INTEGER NOT NULL DEFAULT 0,
    "rushTd" INTEGER NOT NULL DEFAULT 0,
    "receptions" INTEGER NOT NULL DEFAULT 0,
    "recYds" INTEGER NOT NULL DEFAULT 0,
    "recTd" INTEGER NOT NULL DEFAULT 0,
    "fumbles" INTEGER NOT NULL DEFAULT 0,
    "fantasyPoints" DOUBLE PRECISION NOT NULL,
    "performanceScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PlayerGameStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ValueHistory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "valueBefore" DOUBLE PRECISION NOT NULL,
    "valueAfter" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ValueHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupWeekScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineupWeekScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Team_abbreviation_key" ON "Team"("abbreviation");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "CardTemplate_parallel_idx" ON "CardTemplate"("parallel");

-- CreateIndex
CREATE UNIQUE INDEX "CardTemplate_playerId_parallel_key" ON "CardTemplate"("playerId", "parallel");

-- CreateIndex
CREATE INDEX "CardInstance_ownerId_idx" ON "CardInstance"("ownerId");

-- CreateIndex
CREATE INDEX "CardInstance_templateId_idx" ON "CardInstance"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CardInstance_templateId_serial_key" ON "CardInstance"("templateId", "serial");

-- CreateIndex
CREATE INDEX "Battle_challengerId_idx" ON "Battle"("challengerId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSlot_cardInstanceId_key" ON "LineupSlot"("cardInstanceId");

-- CreateIndex
CREATE INDEX "LineupSlot_userId_idx" ON "LineupSlot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSlot_userId_role_key" ON "LineupSlot"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueWeek_season_weekNumber_key" ON "LeagueWeek"("season", "weekNumber");

-- CreateIndex
CREATE INDEX "Game_weekId_idx" ON "Game"("weekId");

-- CreateIndex
CREATE INDEX "PlayerGameStat_playerId_idx" ON "PlayerGameStat"("playerId");

-- CreateIndex
CREATE INDEX "PlayerGameStat_weekId_idx" ON "PlayerGameStat"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGameStat_weekId_playerId_key" ON "PlayerGameStat"("weekId", "playerId");

-- CreateIndex
CREATE INDEX "ValueHistory_playerId_idx" ON "ValueHistory"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ValueHistory_playerId_weekId_key" ON "ValueHistory"("playerId", "weekId");

-- CreateIndex
CREATE INDEX "LineupWeekScore_weekId_idx" ON "LineupWeekScore"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupWeekScore_userId_weekId_key" ON "LineupWeekScore"("userId", "weekId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTemplate" ADD CONSTRAINT "CardTemplate_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstance" ADD CONSTRAINT "CardInstance_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CardTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInstance" ADD CONSTRAINT "CardInstance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_challengerId_fkey" FOREIGN KEY ("challengerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_opponentId_fkey" FOREIGN KEY ("opponentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_cardInstanceId_fkey" FOREIGN KEY ("cardInstanceId") REFERENCES "CardInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "LeagueWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "LeagueWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGameStat" ADD CONSTRAINT "PlayerGameStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueHistory" ADD CONSTRAINT "ValueHistory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ValueHistory" ADD CONSTRAINT "ValueHistory_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "LeagueWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupWeekScore" ADD CONSTRAINT "LineupWeekScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupWeekScore" ADD CONSTRAINT "LineupWeekScore_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "LeagueWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
