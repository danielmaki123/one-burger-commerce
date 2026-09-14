-- TASK-104: turnos de caja.
--
-- Aditiva y sin downtime: crea un tipo y una tabla nuevos, sin tocar columnas existentes.
--
-- El último `CREATE UNIQUE INDEX` es la parte que **no** se puede declarar en `schema.prisma`: el
-- DSL de Prisma no tiene índices parciales. La regla del negocio es "un solo turno abierto por
-- local a la vez" (si no, dos cajas abren el mismo turno y el arqueo queda partido en dos), y se
-- expresa como índice único parcial: solo las filas `open` compiten entre sí, así que el historial
-- de turnos cerrados del mismo local no estorba. Hay un test de contrato que exige este índice.
CREATE TYPE "ShiftStatus" AS ENUM ('open', 'closed');

CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "closingAmount" DECIMAL(10,2),
    "expectedAmount" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shift_locationId_status_idx" ON "Shift"("locationId", "status");

CREATE INDEX "Shift_userId_idx" ON "Shift"("userId");

CREATE INDEX "Shift_openedAt_idx" ON "Shift"("openedAt");

-- Un solo turno abierto por local. Parcial a propósito (ver el comentario de arriba).
CREATE UNIQUE INDEX "Shift_one_open_per_location_key" ON "Shift"("locationId") WHERE "status" = 'open';

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shift" ADD CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
