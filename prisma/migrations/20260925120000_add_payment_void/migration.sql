-- Anulación de un cobro (TASK-AUD-059, alcance remanente de A-15).
--
-- Soft delete aditivo: el cobro **no** se borra ni se edita (es el respaldo de lo que entró al cajón), se
-- marca con cuándo, quién y por qué, y deja de contar para todo lo que sume plata. Las tres columnas son
-- nullable: los cobros ya registrados quedan como están y no hay backfill.
--
-- Sin índice nuevo: las consultas del arqueo y de la conciliación ya filtran por `shiftId`, por pedido o
-- por `createdAt`, y `voidedAt IS NULL` viaja con esos mismos filtros. Un índice propio no cambiaría el
-- plan de una tabla de cobros que se lee por ventana.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByUserId" TEXT,
ADD COLUMN     "voidReason" TEXT;
