-- CreateEnum
CREATE TYPE "ShiftCountKind" AS ENUM ('opening', 'closing');

-- CreateTable
CREATE TABLE "ShiftCashCount" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "kind" "ShiftCountKind" NOT NULL,
    "currency" TEXT NOT NULL,
    "denomination" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftCashCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftCashCount_shiftId_kind_idx" ON "ShiftCashCount"("shiftId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCashCount_shiftId_kind_currency_denomination_key" ON "ShiftCashCount"("shiftId", "kind", "currency", "denomination");

-- AddForeignKey
ALTER TABLE "ShiftCashCount" ADD CONSTRAINT "ShiftCashCount_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
