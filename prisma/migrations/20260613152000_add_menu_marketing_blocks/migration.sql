-- CreateEnum
CREATE TYPE "MenuMarketingBlockType" AS ENUM ('promo', 'event', 'combo', 'featured', 'info');

-- CreateEnum
CREATE TYPE "MenuMarketingBlockCtaType" AS ENUM ('none', 'product', 'category', 'url');

-- CreateTable
CREATE TABLE "MenuMarketingBlock" (
    "id" TEXT NOT NULL,
    "type" "MenuMarketingBlockType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaType" "MenuMarketingBlockCtaType" NOT NULL DEFAULT 'none',
    "ctaTarget" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuMarketingBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuMarketingBlock_isActive_idx" ON "MenuMarketingBlock"("isActive");

-- CreateIndex
CREATE INDEX "MenuMarketingBlock_sortOrder_idx" ON "MenuMarketingBlock"("sortOrder");
