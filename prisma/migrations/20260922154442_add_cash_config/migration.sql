-- CreateTable
CREATE TABLE "LocationCashConfig" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "usdEnabled" BOOLEAN NOT NULL DEFAULT false,
    "blindCount" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "LocationCashConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDenomination" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashDenomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocationCashConfig_locationId_key" ON "LocationCashConfig"("locationId");

-- CreateIndex
CREATE INDEX "LocationCashConfig_usdEnabled_idx" ON "LocationCashConfig"("usdEnabled");

-- CreateIndex
CREATE INDEX "CashDenomination_currency_isActive_idx" ON "CashDenomination"("currency", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CashDenomination_currency_value_key" ON "CashDenomination"("currency", "value");

-- AddForeignKey
ALTER TABLE "LocationCashConfig" ADD CONSTRAINT "LocationCashConfig_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: las denominaciones que hoy se cuentan (Fase 2 del rediseño de Caja, 2026-09-22).
--
-- Son los billetes y monedas que estaban hardcodeados en el dominio del turno
-- (`orders/domain/shift-cash.ts`) y que ahora viven en la configuración. Se siembran para que el conteo
-- siga funcionando igual después del deploy: sin estas filas, la grilla caería a los defaults del módulo
-- (mismo resultado, pero la config quedaría mintiendo hasta que alguien la abra).
--
-- Los valores salen de `src/modules/cash-config/domain/cash-config-defaults.ts`; el test de contrato
-- `cash-config-migration-contract.test.ts` falla si los dos se desincronizan.
INSERT INTO "CashDenomination" ("id", "currency", "value", "isActive", "sortOrder", "updatedAt") VALUES
  ('den_nio_1000', 'NIO', 1000.00, true, 0, CURRENT_TIMESTAMP),
  ('den_nio_500', 'NIO', 500.00, true, 1, CURRENT_TIMESTAMP),
  ('den_nio_200', 'NIO', 200.00, true, 2, CURRENT_TIMESTAMP),
  ('den_nio_100', 'NIO', 100.00, true, 3, CURRENT_TIMESTAMP),
  ('den_nio_50', 'NIO', 50.00, true, 4, CURRENT_TIMESTAMP),
  ('den_nio_20', 'NIO', 20.00, true, 5, CURRENT_TIMESTAMP),
  ('den_nio_10', 'NIO', 10.00, true, 6, CURRENT_TIMESTAMP),
  ('den_nio_5', 'NIO', 5.00, true, 7, CURRENT_TIMESTAMP),
  ('den_nio_1', 'NIO', 1.00, true, 8, CURRENT_TIMESTAMP),
  ('den_usd_100', 'USD', 100.00, true, 0, CURRENT_TIMESTAMP),
  ('den_usd_50', 'USD', 50.00, true, 1, CURRENT_TIMESTAMP),
  ('den_usd_20', 'USD', 20.00, true, 2, CURRENT_TIMESTAMP),
  ('den_usd_10', 'USD', 10.00, true, 3, CURRENT_TIMESTAMP),
  ('den_usd_5', 'USD', 5.00, true, 4, CURRENT_TIMESTAMP),
  ('den_usd_2', 'USD', 2.00, true, 5, CURRENT_TIMESTAMP),
  ('den_usd_1', 'USD', 1.00, true, 6, CURRENT_TIMESTAMP)
ON CONFLICT ("currency", "value") DO NOTHING;
