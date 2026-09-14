-- TASK-101: idempotencia del alta pública.
--
-- Aditiva y sin downtime: la columna es nullable, así que las filas que ya existen quedan en NULL
-- (sin clave, que es lo correcto: nadie la mandó) y no hace falta backfill. El índice único admite
-- múltiples NULL en PostgreSQL, así que los pedidos sin clave no se estorban entre sí.
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
