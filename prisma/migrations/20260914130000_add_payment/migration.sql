-- TASK-103: cobros registrados sobre un pedido.
--
-- Aditiva y sin downtime: crea un tipo y una tabla nuevos, sin tocar ninguna columna existente y
-- sin backfill. `Order.paymentMethod` se mantiene: la declaración del cliente en el checkout y el
-- cobro real del mostrador son dos cosas distintas.
CREATE TYPE "PaymentMethodType" AS ENUM ('cash', 'card', 'transfer', 'mixed', 'other');

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethodType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tip" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
