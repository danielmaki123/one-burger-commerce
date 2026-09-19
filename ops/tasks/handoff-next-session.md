# Arranque de sesión — One Burger Commerce · Puntos 1 y 2 cerrados, sigue el Punto 3

Sos el agente de implementación de **One Burger Commerce**, un SaaS gastronómico multi-tenant (un
restaurante por ahora, varias sucursales): plataforma de pedidos con **solo retiro en el local** —home,
menú, carrito, checkout, seguimiento— más un panel de administración (órdenes/KDS, POS de mostrador,
caja, menú, locales, usuarios, personalización). Repo: `github.com/danielmaki123/one-burger-commerce`,
rama de trabajo y deploy **`main`**, sin push directo (rama → PR → CI verde → merge `--squash`). Stack: Next.js 16 (App Router) + React 19
+ TypeScript estricto · Prisma 6 + PostgreSQL 17 · Tailwind 4 con tokens propios · Vitest + Playwright ·
ESLint · deploy por Docker a Easypanel.

## Reglas de trabajo (leé `AGENTS.md` completo antes de tocar código)

`AGENTS.md` es la única fuente de verdad de proceso. Lo esencial:

- **TDD real**: test que falla primero, confirmá el rojo **por la razón correcta**, implementá lo mínimo,
  refactorizá, cerrá con la validación completa. Si el rojo **no se observa**, se documenta en el commit
  **con el motivo** (regla formalizada el 2026-09-18).
- **Un commit por punto**, en español, con prefijo (`feat|fix|refactor|docs|test(<área>)`), y el cuerpo
  explica el problema y la evidencia.
- **Gates entre puntos** (todos tienen que estar en verde antes de commitear):
  ```bash
  npm run test && npm run lint && npm run typecheck && npm run build && npm run security:secrets
  npx vitest run src/shared/contracts          # 50 contratos
  npm run build:webpack                        # obligatorio si tocás una page.tsx
  npx prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code
  ```
- **No parar entre puntos**: cerrá cada punto entero (implementación + tests + gates + commit + push +
  deploy + capturas + reporte) y seguí con el siguiente. **Solo parás si aparece algo fuera del spec**
  (producto nuevo, dependencia nueva, una decisión que el plan no toma): ahí preguntás y no inventás.
- **UI**: la fuente de verdad visual es `ops/references/stitch/design-system.md` (panel **oscuro**,
  público claro) con las 7 pantallas de referencia en `ops/references/stitch/`. Componentes: primero
  `src/shared/ui/`, después `(admin)/admin/_components/`; registro en `src/shared/ui/registry.json` en el
  mismo commit si el archivo nuevo va en `_components/`. Números en `font-mono` + `tabular-nums`,
  controles ≥44 px (`min-h-11`), estados del sistema (`--status-pending|prep|ready|sla`), cero `#hex` /
  `rgba()` / paleta cruda / `text-[Npx]` / `rounded-[Npx]` / `shadow-[...]`, y **techos de UI que solo
  bajan** (`src/shared/config/design-tokens.allow.json`).
- **Tamaños**: ≤400 líneas por archivo, ≤80 por función, ≤50 por route handler. Los archivos que ya los
  pasan son deuda congelada: **no crecen** y se parten si los tocás.

## Estado actual (2026-09-18)

**Último deploy a producción: `build-20260918-152408`, commit `2b86bb9`** — acción `done`, readiness
`ready`, smokes 7/7 (menú) y 6/6 (hosts).

| # | Punto del roadmap | Estado |
|---|---|---|
| 1 | **Layout unificado de Órdenes** (opción (a): carriles conservados) | **cerrado** (`a83e3a1`, deploy `build-20260918-145218`) |
| 2 | **Sección Historial** (`/admin/history`: cierres + facturas) | **cerrado** (`2b86bb9`, deploy `build-20260918-152408`) |
| 3 | **Modo cocina opt-in** | **pendiente** ← el trabajo de esta sesión |
| 4 | **Checkbox fiscal en el POS** | **pendiente** |

Tests: **2855 unitarios en 419 archivos + 50 de contrato**.

**Dónde está el estado completo** (leelo antes de arrancar):
- `ops/project-state.md` — estado real, qué está desplegado y cómo continuar (**leer primero**).
- `ops/audit-backlog.md` — backlog con lo reportado (A-29 mobile del chrome, A-30 PDF del cierre,
  A-31 TDD formalizado, **A-32 el desvío a verificar**).
- `ops/tasks/audit-ui/pos-fase2-status.md` — inventario de la Fase 2 del POS, con la tabla de esta ronda.
- `ops/production-readiness.md` — runbook de deploy, entorno y rollback.
- `ops/tasks/START-HERE.md` — mapa de documentos y cola de pendientes.

## Tarea 0 (prioritaria, antes del Punto 3): verificar y cerrar el desvío A-32

**A-32 — el Historial depende del POS para dibujarse.** Verificado por lectura de código el 2026-09-18:
`ADMIN_HISTORY_NAV_ITEM` vive en el grupo Control y `withControlGroup`
(`src/app/(admin)/admin/admin-layout-helpers.ts:114`) hace `if (!posAvailable) return groups`, donde
`posAvailable` se resuelve en `src/app/(admin)/admin/_components/admin-shell.tsx:96` desde
`GET /api/admin/pos/availability`. Consecuencia: **sin POS disponible, un manager no ve el Historial**,
aunque el Historial no dependa del POS (los cierres sí vienen de la caja).

Qué hacer: **que el grupo Control se dibuje si cualquiera de sus hijos aplica**, y que cada ítem tenga
**su propio permiso** en vez del del POS:
1. Test primero en `src/app/(admin)/admin/admin-layout-helpers.test.ts` (rojo): con
   `posAvailable: false` y rol `manager`/`owner`, el Historial **tiene que aparecer**; con `role: "cashier"`
   y `posAvailable: false`, el grupo no se dibuja si sus otros ítems tampoco aplican; con `kitchen`,
   tampoco (el Historial no es suyo).
2. Implementá lo mínimo en `withControlGroup`: construí la lista de ítems por permiso propio
   (`ADMIN_POS_NAV_ITEM` solo con POS disponible, `Caja del día` con `canUsePOS`, `Aprobaciones` con
   `canManageCash`, `Historial` con `canViewHistory`) y agregá el grupo si **hay al menos un ítem**.
3. Cerrá con los gates, un commit (`fix(nav): el Historial no depende del POS para dibujarse`), push,
   deploy y reporte. Verificá en el navegador real que el ítem sigue activo en las dos tabs.

Si de paso el owner quiere el **A-29** (mobile de Órdenes: el chrome ocupa ~49% a 375 px), se resuelve en
el Punto 3 —que ya toca esa pantalla— o se pospone, pero **decidilo vos y decilo en el reporte**.

## Punto 3 — Modo cocina opt-in (el trabajo de esta sesión)

Spec del owner (ya resuelto, **no se pregunta de nuevo**):

- **Botón «Modo cocina»** en la barra de trabajo de Órdenes (`src/app/(admin)/admin/orders/orders-toolbar.tsx`).
- **Persistencia en `localStorage`, por dispositivo** (una tablet de cocina queda en modo cocina; el
  mostrador no). Tiene que sobrevivir a recargar y a cambiar de pestaña.
- **Al activarlo**: se ocultan la **barra lateral y el encabezado**, y quedan **solo los carriles**
  (el tablero `order-comanda-board.tsx` / `order-comanda-card.tsx` **no se toca**: es la decisión de la
  opción (a) del Punto 1).
- **Botón «Salir» arriba a la derecha** para volver al panel (sin cerrar sesión).
- **Tabs del modo cocina**: `[Todas] [Nuevas] [Preparando] [Listas] [Despachadas hace poco]`
  (las últimas son las **despachadas en los últimos 30 minutos del turno**). **Sin «Cerradas» y sin
  «Historial»**.
- Es **presentación**: mismos datos, misma API, mismos filtros. **Cualquiera que pueda entrar a Órdenes
  puede activarlo** (sin restricción de rol).
- Lo que ya existe y hay que reusar: el modo que oculta el chrome ya está implementado y **apagado por
  defecto** (`src/app/(admin)/admin/orders/use-comanda-view.ts`: `useComandaView` agrega/quita la clase
  `comandas-view` en `<html>` y `COMANDA_VIEW_CLASS` la consume el CSS del shell). Hoy lo dispara el botón
  «Pantalla completa»; el Punto 3 lo convierte en «Modo cocina» con `localStorage`.

Pistas de implementación (verificá antes de asumir): el estado vive en el hook (`immersive`), la barra
lateral la dibuja `admin-shell.tsx` (fuera de la página) y el modo se limpia al desmontar; los tabs
actuales son `ORDERS_STATUS_TABS` en `orders-toolbar.tsx` y `showBoard = statusFilter !== "closed"` en
`orders/page.tsx`; «despachadas hace poco» necesita una fuente de datos (mirá si el estado `picked_up` /
`served` viaja en la lista de órdenes del día y con qué marca de tiempo: `stageChangedAt` es la que usa
la comanda para medir urgencia). Cuidado con `orders/page.tsx`: es deuda congelada (947 líneas) — **no
crece**; lo nuevo va a un módulo hermano (como `orders-toolbar.tsx`, `comanda-helpers.ts`).

Cierre esperado: tests (hook + toolbar + los casos del filtro nuevo), gates, un commit, deploy y
**capturas a 375 y 1280 px** en `ops/tasks/audit-ui/` (hay scripts reusables:
`scripts/capture-orders-layout.mjs` y `scripts/capture-history.mjs`).

## Punto 4 — Checkbox fiscal en el POS (después del Punto 3)

Spec del owner:

- **Checkbox «Cliente pide factura con RUC»** en el POS, **después de «Correo (opcional)»**, con ícono
  `receipt_long`.
- **Al marcarlo**: **RUC (mínimo 8 caracteres) y Razón social son obligatorios**; al desmarcarlo, se
  limpian.
- **Al cobrar**: se guardan `taxId` / `legalName` en el `Customer` (se **actualiza** si ya existe) y la
  factura **congela** `customerTaxId` / `customerLegalName`.
- **6 archivos**: (1) puerto de clientes (`findCustomerById` + `updateCustomerFiscalData`) **y sus 5
  dobles de test**, (2) `PrismaCustomerAuthRepository`, (3) `findOrCreateCustomer`, (4) `createOrder`,
  (5) el POS (`sale-payload` / `register-pos-sale` / `pos-customer-fields.tsx`), (6) `emitInvoice`
  (respaldo de los datos fiscales del cliente).
- Los campos del `Customer` (`taxId`, `legalName`) y del `Invoice` (`customerTaxId`,
  `customerLegalName`) **ya existen**: no hace falta migración. `pos-client.tsx` es deuda congelada
  (916 líneas): **no crece**, lo nuevo va a `pos-customer-fields.tsx` o a un archivo hermano.

## Entorno local (para gates y capturas)

- Postgres local en el contenedor `one-burger-commerce-postgres-1`:
  `DATABASE_URL=DIRECT_URL=postgresql://postgres:postgres@localhost:5432/oneburger?schema=public`.
- Admin de demo: `admin@example.com` / `Admin1234!` (seed **solo local**, nunca en producción).
- Server local para capturas/E2E:
  ```bash
  # matá primero lo que esté escuchando en 3210 (si no, prisma generate falla con EPERM sobre el engine)
  # El secreto de sesión va con un valor de mentira para el arnés local; acá va abreviado para que el
  # gate `security:secrets` no lo lea como una credencial (en PowerShell: `$env:PORT="3210";
  # $env:APP_ENV="production"; $env:NODE_ENV="production";` y el resto de a una).
  PORT="3210" APP_ENV=production NODE_ENV=production \
  NEXTAUTH_SECRET="..." E2E_ALLOW_MUTATIONS="true" NOTIFICATIONS_DRIVER="dummy" \
  ADMIN_LOGIN_RATE_LIMIT="500" ORDER_CREATE_RATE_LIMIT="500" npm run start:production
  ```
  Para capturas, corré `npm run build` (Turbopack) **después** de `build:webpack`: el webpack deja `.next`
  sin `prerender-manifest.json` y `next start` no arranca.
- Producción: Easypanel por API (`deployService`, **una sola llamada**, proyecto `brunobot`, servicio
  `oneburguerweb`, `forceRebuild: true`; el token va por entorno, nunca en el repo; el cliente corta a los
  ~40 s pero el deploy sigue: polleá `listActions` hasta `done`). Después del deploy: `curl.exe` a
  `/api/health` y `/api/readiness`, y los dos smokes:
  `BASE_URL=https://menu.oneburgernic.com npx playwright test tests/e2e/production-smoke.spec.ts` (7) y
  `BASE_URL=https://oneburgernic.com npx playwright test tests/e2e/production-hosts.spec.ts` (6).
  El owner pidió deploy + capturas reales por punto; **no** uses `npm run deploy:easypanel`.
- Trampas del entorno: usá `curl.exe` (no `Invoke-RestMethod`) para probar HTTP y `--data-binary @archivo`
  para JSON (PowerShell rompe las comillas); en PowerShell **citá** los paths con paréntesis
  (`"src/app/(admin)/admin/…"`), si no los parte; para cirugía de archivos escribí un script `.mjs` con la
  herramienta de escritura en vez de `node -e`.

## Entregable de esta sesión

1. **Tarea 0**: A-32 cerrado (commit propio, deploy y verificación en el navegador).
2. **Punto 3**: implementado, probado, gates en verde, **un commit**, deploy, capturas 375/1280 y reporte.
3. **Punto 4**: idem, con su commit y su deploy.
4. **Reporte al final de cada punto** (qué cambió, qué se verificó, qué se desvió y por qué) y
   `ops/project-state.md` + `ops/tasks/audit-ui/pos-fase2-status.md` actualizados en el mismo cierre.
