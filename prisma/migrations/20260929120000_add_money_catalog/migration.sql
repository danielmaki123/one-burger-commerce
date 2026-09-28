-- Money / Payments runtime (TASK-MONEY-PAYMENTS-RUNTIME-001, D-016/D-018/D-019).
--
-- Las tres tablas de `money`: el catálogo de monedas, la fila única que dice cuál es la moneda base del
-- negocio, y el historial de tasas. Aditivas puras y sin backfill de hechos: ningún `Payment`, `Refund`,
-- `Shift` ni `Invoice` se toca.
--
-- 1. `Currency` — una moneda **no se borra**: se apaga (`isActive`), porque un cobro de ayer sigue
--    nombrándola. El código puede ser un ISO conocido o un código interno de una moneda personalizada
--    (D-019): el catálogo es conveniencia, no una restricción. `decimals` es del catálogo y no del
--    formateador.
-- 2. `BusinessCurrencySettings` — una sola fila (`id = 'default'`). Cuál es la moneda base **no** es un
--    campo del catálogo: es esta fila, y cambiarla es una operación explícita y auditada (D-018).
-- 3. `ExchangeRate` — la tasa es un **hecho con fecha**. Registrar una tasa nueva cierra la vigente
--    (`effectiveTo`) y agrega una fila; nunca se actualiza in place. `toCurrencyCode` guarda contra qué
--    moneda base se registró, así un cambio de moneda base no reinterpreta las tasas anteriores.
--
-- La semilla es **configuración**, no historia: siembra las monedas que el negocio ya usa (la de
-- `BusinessSettings.currencyCode`, que hasta ahora era la autoridad, y el dólar si hay tasa cargada) y
-- copia esa autoridad a su lugar nuevo. No rellena ningún hecho.

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isKnown" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessCurrencySettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "baseCurrencyCode" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'es-NI',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "BusinessCurrencySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "fromCurrencyCode" TEXT NOT NULL,
    "toCurrencyCode" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");

-- CreateIndex
CREATE INDEX "Currency_isActive_sortOrder_idx" ON "Currency"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "BusinessCurrencySettings_baseCurrencyCode_idx" ON "BusinessCurrencySettings"("baseCurrencyCode");

-- CreateIndex
CREATE INDEX "ExchangeRate_fromCurrencyCode_toCurrencyCode_effectiveTo_idx" ON "ExchangeRate"("fromCurrencyCode", "toCurrencyCode", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrencyCode_toCurrencyCode_effectiveFrom_key" ON "ExchangeRate"("fromCurrencyCode", "toCurrencyCode", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "BusinessCurrencySettings" ADD CONSTRAINT "BusinessCurrencySettings_baseCurrencyCode_fkey" FOREIGN KEY ("baseCurrencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_fromCurrencyCode_fkey" FOREIGN KEY ("fromCurrencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_toCurrencyCode_fkey" FOREIGN KEY ("toCurrencyCode") REFERENCES "Currency"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed: las monedas que el negocio ya usa. Sin backfill de hechos.
--
-- La moneda base sale de `BusinessSettings.currencyCode` (la autoridad de hoy) con su símbolo y su locale:
-- es una **copia de configuración**, no una reinterpretación. `isKnown = true` para las dos que el producto
-- conoce de fábrica; una moneda que cargue el negocio nace `isKnown = false`.
DO $$
DECLARE
  base_code TEXT;
  base_symbol TEXT;
  base_locale TEXT;
  usd_rate DOUBLE PRECISION;
BEGIN
  SELECT "currencyCode", "currencySymbol", "locale", "usdExchangeRate"
    INTO base_code, base_symbol, base_locale, usd_rate
    FROM "BusinessSettings" WHERE "id" = 'default';

  base_code := COALESCE(UPPER(NULLIF(TRIM(base_code), '')), 'NIO');
  base_symbol := COALESCE(NULLIF(TRIM(base_symbol), ''), 'C$');
  base_locale := COALESCE(NULLIF(TRIM(base_locale), ''), 'es-NI');

  IF base_code = 'NIO' THEN
    INSERT INTO "Currency" ("id", "code", "name", "symbol", "decimals", "isKnown", "isActive", "sortOrder", "updatedAt")
    VALUES ('cur_nio', 'NIO', 'Córdoba nicaragüense', 'C$', 2, true, true, 0, CURRENT_TIMESTAMP)
    ON CONFLICT ("code") DO NOTHING;
  ELSE
    INSERT INTO "Currency" ("id", "code", "name", "symbol", "decimals", "isKnown", "isActive", "sortOrder", "updatedAt")
    VALUES ('cur_base', base_code, base_code, base_symbol, 2, true, true, 0, CURRENT_TIMESTAMP)
    ON CONFLICT ("code") DO NOTHING;
  END IF;

  -- El dólar entra sólo si el negocio **ya** lo usaba: como moneda base o con una tasa cargada. No se
  -- inventa un catálogo mundial.
  IF base_code = 'USD' OR (usd_rate IS NOT NULL AND usd_rate > 0) THEN
    INSERT INTO "Currency" ("id", "code", "name", "symbol", "decimals", "isKnown", "isActive", "sortOrder", "updatedAt")
    VALUES ('cur_usd', 'USD', 'Dólar estadounidense', 'US$', 2, true, true, 1, CURRENT_TIMESTAMP)
    ON CONFLICT ("code") DO NOTHING;
  END IF;

  INSERT INTO "BusinessCurrencySettings" ("id", "baseCurrencyCode", "locale", "updatedAt")
  VALUES ('default', base_code, base_locale, CURRENT_TIMESTAMP)
  ON CONFLICT ("id") DO NOTHING;

  -- La tasa vigente de `BusinessSettings` pasa a ser el primer hecho del historial, con `effectiveFrom`
  -- **declarado** (`CURRENT_TIMESTAMP`): no se le inventa una fecha histórica.
  IF usd_rate IS NOT NULL AND usd_rate > 0 AND base_code <> 'USD' THEN
    INSERT INTO "ExchangeRate" ("id", "fromCurrencyCode", "toCurrencyCode", "rate", "effectiveFrom", "createdAt")
    VALUES ('rate_usd_seed', 'USD', base_code, usd_rate, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("fromCurrencyCode", "toCurrencyCode", "effectiveFrom") DO NOTHING;
  END IF;
END $$;