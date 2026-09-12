-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addressLine" TEXT,
    "city" TEXT,
    "addressReference" TEXT,
    "mapsUrl" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "phone" TEXT,
    "whatsapp" TEXT,
    "businessHours" JSONB NOT NULL,
    "pickupLeadMinutes" INTEGER NOT NULL DEFAULT 25,
    "pickupMaxMinutes" INTEGER,
    "isAcceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "closedMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationProduct" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceOverride" DECIMAL(10,2),
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_slug_key" ON "Location"("slug");

-- CreateIndex
CREATE INDEX "Location_isActive_sortOrder_idx" ON "Location"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LocationProduct_locationId_productId_key" ON "LocationProduct"("locationId", "productId");

-- CreateIndex
CREATE INDEX "LocationProduct_productId_idx" ON "LocationProduct"("productId");

-- AddForeignKey
ALTER TABLE "LocationProduct" ADD CONSTRAINT "LocationProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationProduct" ADD CONSTRAINT "LocationProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: el local primario hereda la operación que hoy vive en BusinessSettings.
-- El LEFT JOIN con una fila fija garantiza que se cree **siempre**, incluso en una base
-- nueva donde todavía no hay configuración (ahí usa los mismos valores por defecto que
-- el dominio).
INSERT INTO "Location" (
    "id", "name", "slug", "isActive", "sortOrder",
    "addressLine", "city", "addressReference", "mapsUrl", "latitude", "longitude",
    "phone", "whatsapp",
    "businessHours", "pickupLeadMinutes", "pickupMaxMinutes",
    "isAcceptingOrders", "closedMessage",
    "createdAt", "updatedAt"
)
SELECT
    'loc_principal',
    'Principal',
    'principal',
    true,
    0,
    bs."addressLine",
    bs."city",
    bs."addressReference",
    bs."mapsUrl",
    bs."latitude",
    bs."longitude",
    bs."phone",
    bs."whatsapp",
    COALESCE(
        bs."businessHours",
        '{"mon":{"open":"12:00","close":"22:00","closed":false},"tue":{"open":"12:00","close":"22:00","closed":false},"wed":{"open":"12:00","close":"22:00","closed":false},"thu":{"open":"12:00","close":"22:00","closed":false},"fri":{"open":"12:00","close":"22:00","closed":false},"sat":{"open":"12:00","close":"22:00","closed":false},"sun":{"open":"12:00","close":"22:00","closed":false}}'::jsonb
    ),
    COALESCE(bs."pickupLeadMinutes", 25),
    bs."pickupMaxMinutes",
    COALESCE(bs."isAcceptingOrders", true),
    bs."closedMessage",
    now(),
    now()
FROM (SELECT 1) AS seed
LEFT JOIN "BusinessSettings" bs ON bs."id" = 'default';

-- AlterTable: Order.locationId en tres pasos. Agregarla directo como NOT NULL fallaría
-- con los pedidos que ya existen (229 en la base local), así que se agrega nullable, se
-- backfillea al local primario y recién ahí se vuelve obligatoria.
ALTER TABLE "Order" ADD COLUMN "locationId" TEXT;

UPDATE "Order" SET "locationId" = 'loc_principal' WHERE "locationId" IS NULL;

ALTER TABLE "Order" ALTER COLUMN "locationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Order_locationId_idx" ON "Order"("locationId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
