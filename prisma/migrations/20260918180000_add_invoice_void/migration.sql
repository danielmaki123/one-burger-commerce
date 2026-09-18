-- Anulación de facturas (Punto 2 del roadmap, 2026-09-18).
--
-- Soft delete: la fila no se borra nunca (una factura puede estar en la mano del cliente), se marca
-- con cuándo y quién la anuló y con qué motivo. Las tres columnas son nullable: las facturas ya
-- emitidas quedan como están y no hay backfill.
--
-- El índice por estado y fecha es el de la pantalla de Historial › Facturas (filtra por estado y
-- ordena por fecha).

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByUserId" TEXT,
ADD COLUMN     "voidReason" TEXT;

-- CreateIndex
CREATE INDEX "Invoice_status_issuedAt_idx" ON "Invoice"("status", "issuedAt");
