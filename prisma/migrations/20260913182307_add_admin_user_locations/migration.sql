-- CreateTable
CREATE TABLE "AdminUserLocation" (
    "adminUserId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserLocation_pkey" PRIMARY KEY ("adminUserId","locationId")
);

-- CreateIndex
CREATE INDEX "AdminUserLocation_locationId_idx" ON "AdminUserLocation"("locationId");

-- AddForeignKey
ALTER TABLE "AdminUserLocation" ADD CONSTRAINT "AdminUserLocation_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserLocation" ADD CONSTRAINT "AdminUserLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
