-- Datos fiscales del negocio para la factura simple (2026-09-18).
--
-- Aditiva: dos columnas opcionales en BusinessSettings (direccion y telefono fiscales). La razon
-- social y el RUC ya vinieron con la migracion de la factura. **No** es una factura fiscal.

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "taxAddress" TEXT,
ADD COLUMN     "taxPhone" TEXT;
