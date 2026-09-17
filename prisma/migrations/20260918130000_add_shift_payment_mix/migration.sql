-- Tarea 1.2 del roadmap + decisión del owner (2026-09-17): el cierre guarda el **desglose por medio de
-- pago** del turno (antes solo el efectivo) y las propinas como detalle. Aditiva y nullable: los turnos
-- cerrados antes de esto quedan con `NULL` y la pantalla lo dice, sin inventar el número.
ALTER TABLE "Shift" ADD COLUMN     "cardSalesAmount" DECIMAL(10,2),
ADD COLUMN     "otherSalesAmount" DECIMAL(10,2),
ADD COLUMN     "tipsAmount" DECIMAL(10,2),
ADD COLUMN     "transferSalesAmount" DECIMAL(10,2);
