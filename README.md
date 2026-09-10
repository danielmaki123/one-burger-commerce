# One Burger Commerce

MVP para pedidos de One Burger: menu publico, carrito, checkout **solo para retirar en el restaurante**, ordenes admin, menu admin y usuarios admin con roles.

## Stack

- Next.js App Router
- TypeScript
- Prisma + PostgreSQL
- Vitest
- ESLint

## Dominios

Un solo build sirve tres hosts; el ruteo se decide por el host de la request
(`src/shared/config/host-routing.ts`, puro y con tests):

| Host | Qué sirve |
|---|---|
| `oneburgernic.com` (y `www`) | Landing a pantalla completa con la animación de scroll y el botón MENU |
| `menu.oneburgernic.com` | App de pedidos (home, menú, carrito, checkout, seguimiento) |
| `admin.oneburgernic.com` | Panel de admin (redirige su raíz a `/admin`) |

`localhost`, las IPs y el host por defecto de Easypanel quedan fuera de la
clasificación: siguen sirviendo la app de pedidos tal cual, así que el entorno
local y la suite E2E no dependen de los subdominios.

Verificación de los tres dominios (solo lectura, se salta sola si `BASE_URL` no
es el dominio de marca):

```bash
BASE_URL=https://oneburgernic.com npm run test:e2e:prod:hosts
```

## Alcance MVP

- Publico: home, menu, detalle de producto, carrito, checkout pickup, confirmacion y seguimiento del pedido.
- Admin: ordenes, menu, usuarios y **personalizacion del negocio** (`/admin/settings`).
- Roles: `owner`, `manager`, `kitchen`.
- Pago: se cobra **en el local al retirar**. No hay pasarela de pago.
- Propina: opcional, desmarcada por defecto, **porcentaje configurable** desde el admin
  (el servidor es la fuente de verdad y no acepta un monto del cliente).

Fuera del MVP: reservas, mesas, delivery, inventario, reportes avanzados y pagos online.
Ese codigo sigue en el repositorio, pero **no se ofrece en la UI ni en las APIs publicas**:
las paginas de admin de esos modulos quedan solo accesibles por URL y las APIs de reservas,
mesas y zonas de delivery fueron retiradas. Ver `ops/production-readiness.md`.

## Personalizacion del negocio

Ningun dato del negocio esta escrito en el codigo: nombre, colores, tipografias, logos,
contacto, direccion, horarios, moneda, propina y textos operativos salen de la fila unica
de `BusinessSettings` y se editan en `/admin/settings` (solo `owner`). Los cambios se ven
en la siguiente carga del sitio publico, sin redeploy.

- Modulo: `src/modules/business-settings/` (leer su `README.md`).
- Valores por defecto: `domain/business-settings-defaults.ts`, el unico lugar del codigo
  donde pueden vivir esos literales. Un test de contrato
  (`anti-hardcode-contract.test.ts`) falla si reaparecen en otra superficie.
- Brief y decisiones: [`ops/tasks/TASK-whitelabel-branding.md`](ops/tasks/TASK-whitelabel-branding.md).

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
