-- `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-88`, `A-89`, `A-90`) — aditiva y sin BOM.
--
-- Tres columnas nuevas, ninguna con backfill inventado:
--
-- 1. `Order.currencyCode` (`A-89`): la moneda en la que están expresados los montos del pedido. Nace
--    NULLABLE y **no se rellena**: los pedidos anteriores no tienen moneda demostrable y quedan como
--    legacy/`unresolved` (D-020/D-022). Inventarles una con la configuración de hoy es exactamente lo que
--    la ley 7 prohíbe.
-- 2. `LocationCashConfig.countedCurrencyCodes` (`A-88`): las monedas contables de la sucursal, como lista.
--    Su valor inicial sale de forma **determinística** de la configuración que ya existe (`usdEnabled` +
--    la moneda base vigente): no reinterpreta ningún hecho histórico, sólo traduce una configuración
--    persistida a la forma nueva. `usdEnabled` se conserva como legacy.
-- 3. `Shift.baseCurrencyCode` + `Shift.exchangeRatesByCurrency` (`A-90`): con qué moneda base y con qué
--    tasa por moneda se firmó el cierre. Nacen NULLABLE y **no se rellenan**: un cierre firmado no se
--    re-firma ni se recalcula.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "currencyCode" TEXT;

-- AlterTable
ALTER TABLE "LocationCashConfig" ADD COLUMN "countedCurrencyCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "baseCurrencyCode" TEXT,
ADD COLUMN "exchangeRatesByCurrency" JSONB;

-- La configuración de conteo por sucursal pasa a la forma nueva, sin reinterpretar nada: la moneda base
-- vigente está siempre y el dólar entra sólo donde el interruptor legacy decía que sí. El fallback a
-- 'NIO' cubre una instalación sin fila de `BusinessCurrencySettings` (el default del módulo).
--
-- El resultado es el mismo conjunto que producía `toCashCountConfig` con `usdEnabled`: base + USD donde
-- estaba prendido, sólo la base donde no. A partir de acá la lista manda y `usdEnabled` queda como legacy.
UPDATE "LocationCashConfig"
SET "countedCurrencyCodes" = CASE
  WHEN "usdEnabled" THEN ARRAY[
    COALESCE(
      (SELECT "baseCurrencyCode" FROM "BusinessCurrencySettings" WHERE "id" = 'default'),
      'NIO'
    ),
    'USD'
  ]
  ELSE ARRAY[]::TEXT[]
END;
