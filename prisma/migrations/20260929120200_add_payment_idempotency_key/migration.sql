-- Idempotencia durable del cobro (TASK-MONEY-PAYMENTS-RUNTIME-001). Cierra A-71.
--
-- `Payment` no tenía clave y el payload del POST tampoco: el reintento de un cobro **parcial** registraba
-- la misma plata dos veces mientras la suma no alcanzara el total. La garantía la da la **base**, no la UI:
-- una clave que manda el cliente más un índice único.
--
-- El índice es **parcial** (`WHERE "idempotencyKey" IS NOT NULL`) por dos motivos:
--
-- 1. los cobros que ya existen quedan en `NULL` y no pueden colisionar entre sí — un `UNIQUE` común
--    rechazaría el segundo `NULL`;
-- 2. el alcance de la clave es el **cobro**, no el pedido: dos cobros parciales legítimos conviven con
--    claves distintas, y el mismo request repetido produce uno solo.
--
-- El índice no-parcial de la columna es el que declara `schema.prisma` (soporta la búsqueda por clave);
-- el parcial es la regla.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE INDEX "Payment_idempotencyKey_idx" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotency_key_unique" ON "Payment"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;