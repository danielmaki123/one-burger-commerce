-- Tipo de entidad de cobro sobre `Bank` (TASK-MONEY-PAYMENTS-RUNTIME-001, D-019/D-020).
--
-- El catálogo de entidades de cobro **es** `banks` y se amplía: no se crea un catálogo paralelo. Lo que
-- faltaba era que una entidad declarara **qué clase** es: banco, adquirente, proveedor digital u otro.
--
-- El default es `other` **explícito** para las entidades que ya existen: el tipo **no** se infiere por el
-- nombre («BAC» no implica `acquirer`), y un `NOT NULL` con default deja la columna fuerte sin backfill.

-- CreateEnum
CREATE TYPE "BankEntityType" AS ENUM ('bank', 'acquirer', 'digital_provider', 'other');

-- AlterTable
ALTER TABLE "Bank" ADD COLUMN     "entityType" "BankEntityType" NOT NULL DEFAULT 'other';

-- CreateIndex
CREATE INDEX "Bank_entityType_isActive_idx" ON "Bank"("entityType", "isActive");