-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN "withdrawalLimit" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN "withdrawalLimitAmount" DECIMAL(10,2);
