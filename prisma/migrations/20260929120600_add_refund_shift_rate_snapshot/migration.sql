-- Snapshot monetario de la devolución y tasa del cierre (TASK-MONEY-PAYMENTS-RUNTIME-001, D-020).
--
-- Dos simetrías que faltaban:
--
-- 1. `Refund` ya congela su moneda; le faltaba la **moneda base, la tasa y el equivalente** de la
--    devolución nueva. Las viejas quedan en `null` y **no** se convierten con la tasa de hoy.
-- 2. `Shift` congela sus montos desde siempre (`expectedAmount`, `expectedByCurrency`, el desglose por
--    medio) pero **no la tasa que los produjo**: sin ella, el snapshot del cierre no se puede explicar
--    después sin volver a la configuración de hoy.
--
-- Ninguna de las dos se backfillea: los cierres y las devoluciones ya firmados **no se re-firman** ni se
-- recalculan y siguen valiendo como documento. La obligatoriedad es de la escritura nueva.

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "baseCurrencyCode" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(18,8),
ADD COLUMN     "baseAmount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "exchangeRate" DECIMAL(18,8);