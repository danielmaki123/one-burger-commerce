-- Catálogo de medios de pago (TASK-MONEY-PAYMENTS-RUNTIME-001, D-017).
--
-- Separa la **semántica contable** (`kind`: cash · card · bank_transfer · wallet · other) del **medio
-- comercial** configurable («Tarjeta BAC», «Zelle»). `mixed` **no** existe acá: se deriva cuando una venta
-- tiene más de un `Payment`. El enum `PaymentMethodType` del cobro se conserva tal como está —incluido
-- `mixed`, que puede existir en la base— y **no** se convierte en una segunda lista.
--
-- `entityId` apunta a `Bank`: el catálogo de entidades de cobro es el que ya existe y se amplía con su
-- tipo; **no** se crea uno paralelo.
--
-- `PaymentMethodLocation` es el patrón de `LocationBank`: dónde se ofrece cada medio. Sin filas, el medio
-- se ofrece en todas las sucursales.
--
-- La semilla son los medios que el negocio **ya usa** (Efectivo, Tarjeta, Transferencia), sin inventar
-- entidades (nacen con `entityId` nulo: asignarlas es trabajo del dueño en la pantalla de Finanzas).

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PaymentMethodKind" NOT NULL,
    "entityId" TEXT,
    "currencyCodes" TEXT[],
    "requiresReference" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethodLocation" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "paymentMethodConfigId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_name_key" ON "PaymentMethodConfig"("name");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_isActive_sortOrder_idx" ON "PaymentMethodConfig"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_entityId_idx" ON "PaymentMethodConfig"("entityId");

-- CreateIndex
CREATE INDEX "PaymentMethodLocation_locationId_isActive_idx" ON "PaymentMethodLocation"("locationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodLocation_locationId_paymentMethodConfigId_key" ON "PaymentMethodLocation"("locationId", "paymentMethodConfigId");

-- AddForeignKey
ALTER TABLE "PaymentMethodConfig" ADD CONSTRAINT "PaymentMethodConfig_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Bank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodLocation" ADD CONSTRAINT "PaymentMethodLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethodLocation" ADD CONSTRAINT "PaymentMethodLocation_paymentMethodConfigId_fkey" FOREIGN KEY ("paymentMethodConfigId") REFERENCES "PaymentMethodConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: los medios con los que el negocio ya cobra.
--
-- `currencyCodes` vacío significa «todas»: la configuración de qué moneda acepta cada local no se inventa
-- acá (vive en `cash-config` y en la pantalla de Finanzas). `requiresReference` es `true` para la
-- transferencia, que es la que se concilia contra un comprobante.
INSERT INTO "PaymentMethodConfig" ("id", "name", "kind", "currencyCodes", "requiresReference", "isActive", "sortOrder", "updatedAt") VALUES
  ('pmc_cash', 'Efectivo', 'cash', ARRAY[]::TEXT[], false, true, 0, CURRENT_TIMESTAMP),
  ('pmc_card', 'Tarjeta', 'card', ARRAY[]::TEXT[], false, true, 1, CURRENT_TIMESTAMP),
  ('pmc_transfer', 'Transferencia', 'bank_transfer', ARRAY[]::TEXT[], true, true, 2, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;