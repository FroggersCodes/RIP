-- AlterEnum
ALTER TYPE "Parallel" ADD VALUE 'AUTOGRAPH';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "guaranteeNumbered" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packsPerBox" INTEGER NOT NULL DEFAULT 1;
