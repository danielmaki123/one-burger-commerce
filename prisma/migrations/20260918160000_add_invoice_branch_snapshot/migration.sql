-- Sucursal de retiro congelada en la factura simple (2026-09-18).
--
-- Aditiva y sin backfill: seis columnas opcionales en Invoice con los datos de la sucursal al emitir.
-- Las facturas ya emitidas quedan sin bloque de sucursal (no habia dato que copiar).

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "branchAddressLine" TEXT,
ADD COLUMN     "branchCity" TEXT,
ADD COLUMN     "branchMapsUrl" TEXT,
ADD COLUMN     "branchName" TEXT,
ADD COLUMN     "branchPhone" TEXT,
ADD COLUMN     "branchWhatsapp" TEXT;
