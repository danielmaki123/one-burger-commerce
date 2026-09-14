-- TASK-105: el rol `cashier` para el punto de venta.
--
-- Aditiva: agrega un valor al final del enum. Ningún usuario existente cambia de rol y no hace falta
-- backfill: los roles que ya están siguen valiendo lo mismo.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'cashier';
