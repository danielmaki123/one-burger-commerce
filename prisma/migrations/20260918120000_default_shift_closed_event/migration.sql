-- Decisión del owner (2026-09-17): el cierre de cada turno avisa al grupo por defecto, y reemplaza al
-- «resumen diario» (que nunca se disparó solo). Es aditivo: no borra ninguna configuración existente, solo
-- agrega el evento nuevo a la fila del negocio (que es una sola: `id = 'default'`).
ALTER TABLE "NotificationSettings" ALTER COLUMN "eventsEnabled" SET DEFAULT '["shift_closed"]';

UPDATE "NotificationSettings"
   SET "eventsEnabled" = "eventsEnabled" || '["shift_closed"]'::jsonb
 WHERE NOT "eventsEnabled" @> '["shift_closed"]'::jsonb;
