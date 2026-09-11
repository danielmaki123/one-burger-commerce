-- AlterTable
ALTER TABLE "Order" ADD COLUMN "pickupScheduled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Order_pickupTime_idx" ON "Order"("pickupTime");
