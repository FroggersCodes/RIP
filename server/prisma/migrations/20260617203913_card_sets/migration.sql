-- AlterTable
ALTER TABLE "CardInstance" ADD COLUMN     "setKey" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "setKey" TEXT NOT NULL DEFAULT 'chrome';
