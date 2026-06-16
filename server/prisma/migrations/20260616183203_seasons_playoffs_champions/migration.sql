-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "awaySeed" INTEGER,
ADD COLUMN     "bracketOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "homeSeed" INTEGER,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recap" TEXT,
ADD COLUMN     "round" TEXT NOT NULL DEFAULT 'REGULAR';

-- CreateTable
CREATE TABLE "SeasonChampion" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "championTeamId" TEXT NOT NULL,
    "runnerUpTeamId" TEXT NOT NULL,
    "topUserId" TEXT,
    "topUserPoints" DOUBLE PRECISION,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonChampion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeasonChampion_season_key" ON "SeasonChampion"("season");

-- AddForeignKey
ALTER TABLE "SeasonChampion" ADD CONSTRAINT "SeasonChampion_championTeamId_fkey" FOREIGN KEY ("championTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonChampion" ADD CONSTRAINT "SeasonChampion_runnerUpTeamId_fkey" FOREIGN KEY ("runnerUpTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
