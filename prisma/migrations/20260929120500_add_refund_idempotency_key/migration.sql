-- Idempotencia del **pedido** de devolución (TASK-MONEY-PAYMENTS-RUNTIME-001, A-73).
--
-- Con el cupo bloqueado (`lockPaymentRow`) dos requests simultáneos ya no pueden consumirlo dos veces;
-- esta clave cierra el otro camino: el **reintento** de la misma request (doble click, retry de red). La
-- unicidad la garantiza la base con un índice **parcial** —el `NULL` de las devoluciones que ya existen no
-- colisiona— y la clave la manda el cliente.

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE INDEX "Refund_idempotencyKey_idx" ON "Refund"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_idempotency_key_unique" ON "Refund"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;