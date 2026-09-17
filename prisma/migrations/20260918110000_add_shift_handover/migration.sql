-- CreateTable
CREATE TABLE "ShiftHandover" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "handedByUserId" TEXT,
    "handedByName" TEXT,
    "receivedByName" TEXT NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "expectedByCurrency" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftHandover_shiftId_createdAt_idx" ON "ShiftHandover"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "ShiftHandover_locationId_createdAt_idx" ON "ShiftHandover"("locationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
