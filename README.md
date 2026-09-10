# One Burger Commerce

MVP para pedidos de One Burger: menu publico, carrito, checkout **solo para retirar en el restaurante**, ordenes admin, menu admin y usuarios admin con roles.

## Stack

- Next.js App Router
- TypeScript
- Prisma + PostgreSQL
- Vitest
- ESLint

## Alcance MVP

- Publico: home, menu, detalle de producto, carrito, checkout pickup, confirmacion y seguimiento del pedido.
- Admin: ordenes, menu y usuarios.
- Roles: `owner`, `manager`, `kitchen`.
- Pago: se cobra **en el local al retirar**. No hay pasarela de pago.
- Propina: opcional, desmarcada por defecto, 10 % si el cliente la agrega.

Fuera del MVP: reservas, mesas, delivery, inventario, reportes avanzados y pagos online.
Ese codigo sigue en el repositorio pero no forma parte de la navegacion principal; ver `ops/production-readiness.md`.

## Validacion

```bash
npm run test
npm run lint
npm run typecheck
npm run build
npm run security:secrets
```

## Operacion

- Deploy y runbook de produccion: [`ops/production-readiness.md`](ops/production-readiness.md)
- Deploy en Easypanel (detalle de la API): [`ops/easypanel-production.md`](ops/easypanel-production.md)
- El contenedor valida el entorno al arrancar y aborta si falta `DATABASE_URL`, `DIRECT_URL`, `APP_ENV` o `NODE_ENV`, o si quedaron activos interruptores de debug de OTP.
- Healthcheck del contenedor: `GET /api/readiness` (hace un `SELECT 1` real y responde 503 si la base no responde).
