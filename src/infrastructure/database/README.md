# `src/infrastructure/database`

Infraestructura de base de datos y eventos. Dos archivos, a propósito:

- `prisma.ts` — el **único** cliente Prisma del proyecto (singleton). Los casos de uso **no** lo
  importan: reciben sus repositorios inyectados desde la capa de composición (`src/app/**`). Si te
  encontrás importando `prisma` dentro de un `features/`, está mal ubicado.
- `events/event-bus.ts` — el bus interno de eventos (lo usa el outbox de notificaciones para
  suscribirse a los hechos de pedidos).

Los repositorios concretos viven en `src/modules/<módulo>/adapters/prisma-*.ts`; el esquema y las
migraciones en `prisma/` (migraciones **sin BOM**: hay un test que lo verifica). Para cambios de
schema: `npx prisma generate` y una migración versionada; nunca `migrate reset` ni `db:seed` contra
producción (`AGENTS.md` → Prohibiciones).
