-- Canal de origen del pedido (TASK-ORDERS-KITCHEN-RUNTIME-002).
--
-- Aditiva y **sin backfill**, a propósito:
--
-- 1. `OrderSource` es el canal por el que **entró** el pedido: `menu` (menú público) o `pos` (venta del
--    mostrador). Lo declara la puerta de creación; **no** se infiere del medio de pago, del nombre del
--    cliente ni del turno.
-- 2. `Order.source` es **nullable y sin default**. Los pedidos que ya existían quedan en `NULL`, que
--    significa «no declarado»: el pasado **no** se reconstruye con heurísticas (ley 7 del repo). La
--    pantalla dibuja la etiqueta del canal sólo cuando hay valor.
-- 3. Sin índice nuevo: esta TASK no filtra ni ordena por canal (la cola de cocina no filtra por origen),
--    así que un índice sería deuda sin consulta.

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('menu', 'pos');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" "OrderSource";
