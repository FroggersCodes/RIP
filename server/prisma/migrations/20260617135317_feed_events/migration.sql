-- CreateTable
CREATE TABLE "FeedEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "parallel" TEXT,
    "marketValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedEvent_createdAt_idx" ON "FeedEvent"("createdAt");
