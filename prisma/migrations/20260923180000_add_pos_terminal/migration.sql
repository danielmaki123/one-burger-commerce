-- Fase 6 del rediseño de Caja (2026-09-23) — la terminal del POS y el turno por terminal.
--
-- Tres cosas, todas aditivas salvo el índice de la última sección:
--
-- 1. `PosTerminal`: la **estación física** de una sucursal («Caja 1», «Barra»). Es una tabla propia y no una
--    etiqueta del banco (decisión del owner, 2026-09-23): una estación puede tener dos posnets (BAC +
--    Banpro) y un banco puede tener posnets en dos estaciones; mezclarlas obligaría a duplicar registros.
--    Nace **vacía**: las estaciones del local son datos del negocio, igual que los bancos (Fase 3).
-- 2. `Shift.terminalId` y `Payment.shiftId`: el turno sabe en qué terminal se abrió, y cada cobro sabe a
--    qué turno entró. Lo segundo es lo que hace **correcto** tener dos cajas abiertas en el mismo local:
--    el arqueo de cada turno lee **sus** cobros, no los de la ventana de tiempo del local.
-- 3. El índice único parcial pasa de una caja abierta **por local** a una por **(local, terminal)**:
--    `COALESCE("terminalId", '')` deja los turnos sin terminal (los de antes de esta fase y las sucursales
--    que todavía no cargaron terminales) en el mismo cubo, así que ahí sigue habiendo uno solo por local.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "shiftId" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "terminalId" TEXT;

-- CreateTable
CREATE TABLE "PosTerminal" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosTerminal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PosTerminal_locationId_isActive_idx" ON "PosTerminal"("locationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PosTerminal_locationId_label_key" ON "PosTerminal"("locationId", "label");

-- CreateIndex
CREATE INDEX "Payment_shiftId_idx" ON "Payment"("shiftId");

-- CreateIndex
CREATE INDEX "Shift_terminalId_idx" ON "Shift"("terminalId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosTerminal" ADD CONSTRAINT "PosTerminal_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_terminalId_fkey" FOREIGN KEY ("terminalId") REFERENCES "PosTerminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La regla de concurrencia del turno cambia de sujeto: de «una caja abierta por local» (TASK-104) a «una
-- caja abierta por terminal, dentro del local» (Fase 6). El contrato de la migración vieja
-- (`shift-migration-contract.test.ts`) sigue exigiéndola, ahora con este nombre y esta expresión.
DROP INDEX "Shift_one_open_per_location_key";

CREATE UNIQUE INDEX "Shift_one_open_per_terminal_key" ON "Shift"("locationId", COALESCE("terminalId", '')) WHERE "status" = 'open';
