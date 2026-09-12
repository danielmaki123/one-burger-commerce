-- AlterEnum
ALTER TYPE "CouponType" ADD VALUE 'bogo';

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "buyQuantity" INTEGER,
ADD COLUMN     "freeQuantity" INTEGER,
ADD COLUMN     "scopeId" TEXT,
ADD COLUMN     "scopeType" TEXT DEFAULT 'all';
