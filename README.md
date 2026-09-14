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
- **Locales (multi-sucursal)**: si el negocio tiene mas de uno, el cliente elige donde retira; cada
  local tiene su direccion, su horario, su preparacion y **su propio menu y precios** (modulo
  `locations`, T8). El pedido guarda el local y lo muestra en la confirmacion, el historial y el admin.
- **Retiro programable**: el cliente puede elegir una hora del dia o **un dia futuro** (sin tope: el
  limite es el horario de ese dia) y el servidor valida la hora contra el horario del dia elegido.
- Admin: **comandas** (`/admin/orders`: tablero del turno en tres carriles —por aceptar, en preparación,
  listas— con la urgencia medida dentro de la etapa, auto-refresh con aviso y sonido, aceptar/rechazar
  desde la fila, búsqueda por número/nombre/WhatsApp/PIN y filtros en la URL, umbrales de aviso por local
  editables en `/admin/locations` y promedio de preparación del día), menú, usuarios y **personalización
  del negocio** (`/admin/settings`). El detalle del diseño y las decisiones está en
  [`ops/tasks/TASK-orders-console.md`](ops/tasks/TASK-orders-console.md).
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

- Modulo: `src/modules/business-settings/` (leer su `README.md`). Los **locales** (dirección,
  horario, contacto, catálogo y precios por sucursal) están en `src/modules/locations/README.md`.
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
# Si tocaste una pagina (`src/app/**/page.tsx`): el build de Turbopack no valida los exports de
# una pagina, el de Webpack si.
npm run build:webpack
```

## Operacion

- Deploy y runbook de produccion (secuencia exacta, dominio por dominio):
  [`ops/production-readiness.md`](ops/production-readiness.md). El deploy es **una sola llamada** a
  `deployService`; no usar `npm run deploy:easypanel`.
- `ops/easypanel-production.md` es **histórico**: describe el primer proyecto abandonado
  (`oneburguer`/`web`), no la producción actual.
- El contenedor valida el entorno al arrancar y aborta si falta `DATABASE_URL`, `DIRECT_URL`, `APP_ENV` o `NODE_ENV`, o si quedaron activos interruptores de debug de OTP.
- Healthcheck del contenedor: `GET /api/readiness` (hace un `SELECT 1` real y responde 503 si la base no responde).
