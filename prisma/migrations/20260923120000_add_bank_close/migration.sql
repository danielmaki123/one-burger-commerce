-- Fase 3 del rediseño de Caja (2026-09-23) — el cuadre por banco.
--
-- Tres tablas nuevas y dos columnas en `Shift`, todo **aditivo**: los despliegues anteriores siguen
-- funcionando sin tocar una fila. `Bank` nace **vacía a propósito**: las entidades con las que liquida el
-- local son datos del negocio y el contrato anti-hardcode prohíbe inventarlas en el código o sembrarlas
-- por migración; se cargan desde Config de Caja → Bancos.
--
-- `bankDifferenceAmount` congela la diferencia del cuadre por banco al cerrar (el lote de una terminal no
-- se recalcula después) y `differenceNotifiedAt` firma cuándo salió el aviso del cierre al grupo del
-- dueño, que es el mensaje donde viaja la diferencia.

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "bankDifferenceAmount" DECIMAL(10,2),
ADD COLUMN     "differenceNotifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationBank" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftBankClose" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "declaredAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "lote" TEXT,
    "terminalLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftBankClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bank_name_key" ON "Bank"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bank_code_key" ON "Bank"("code");

-- CreateIndex
CREATE INDEX "Bank_isActive_sortOrder_idx" ON "Bank"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "LocationBank_locationId_isActive_idx" ON "LocationBank"("locationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LocationBank_locationId_bankId_key" ON "LocationBank"("locationId", "bankId");

-- CreateIndex
CREATE INDEX "ShiftBankClose_shiftId_idx" ON "ShiftBankClose"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftBankClose_bankId_idx" ON "ShiftBankClose"("bankId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftBankClose_shiftId_bankId_currency_key" ON "ShiftBankClose"("shiftId", "bankId", "currency");

-- AddForeignKey
ALTER TABLE "LocationBank" ADD CONSTRAINT "LocationBank_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationBank" ADD CONSTRAINT "LocationBank_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftBankClose" ADD CONSTRAINT "ShiftBankClose_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftBankClose" ADD CONSTRAINT "ShiftBankClose_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "Bank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
