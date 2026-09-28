-- Snapshot monetario del cobro (TASK-MONEY-PAYMENTS-RUNTIME-001, D-017/D-020). Cierra la mitad de A-72.
--
-- El hecho financiero tiene que poder explicarse **para siempre** sin consultar la configuración de hoy
-- (ley 7). Estas columnas son el snapshot que faltaba: la moneda base contra la que se convirtió, la tasa
-- que se aplicó, el equivalente que produjo, y el medio con su **tipo canónico** del momento.
--
-- Todas son **nullable a propósito**: los cobros que ya existen quedan en `null`, que significa
-- «equivalente **no demostrable**» — **no** «cero» y **no** «se convierte con la tasa de hoy» (D-020). El
-- pasado no se rellena: no hay backfill. La obligatoriedad de los cinco campos en un cobro **nuevo** es
-- una regla de dominio y de transacción, no un `NOT NULL` de la columna (los legacy tienen que poder
-- seguir leyéndose).
--
-- `methodKind` se congela **junto** a `paymentMethodId` a propósito: el medio comercial se puede renombrar
-- o cambiar de tipo y el hecho tiene que seguir explicando con qué semántica contable entró esa plata.

-- CreateEnum
CREATE TYPE "PaymentMethodKind" AS ENUM ('cash', 'card', 'bank_transfer', 'wallet', 'other');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "baseCurrencyCode" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(18,8),
ADD COLUMN     "baseAmount" DECIMAL(10,2),
ADD COLUMN     "paymentMethodId" TEXT,
ADD COLUMN     "methodKind" "PaymentMethodKind",
ADD COLUMN     "entityId" TEXT;