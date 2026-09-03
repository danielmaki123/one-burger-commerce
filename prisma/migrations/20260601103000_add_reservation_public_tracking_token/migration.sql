-- AlterTable
ALTER TABLE "Reservation"
ADD COLUMN "reservationLookupTokenHash" TEXT,
ADD COLUMN "reservationNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_reservationNumber_key" ON "Reservation"("reservationNumber");
