# CONTEXT.md — cómo está construido One Burger Commerce

**Qué es este archivo**: el contexto **estable** del sistema. Responde «cómo está construido
esto» y «qué existe hoy», no «en qué andamos». Verificado contra el código, no contra la prosa de
documentos viejos.

**Qué NO va acá**: la tarea actual, el SHA desplegado, los bugs abiertos de una auditoría, el deploy
del día ni nada que cambie semana a semana. Eso vive en [`../ops/CURRENT.md`](../ops/CURRENT.md),
[`../ops/audit-backlog.md`](../ops/audit-backlog.md) y [`../ops/tasks/`](../ops/tasks/).

Si este archivo y el código se contradicen, **gana el código** y este archivo se corrige en el mismo
commit (hay un contrato que verifica que las rutas citadas existan:
`src/shared/contracts/agent-system-contract.test.ts`).

---

## 1. Propósito

Plataforma de pedidos para un restaurante (**One Burger**, Nicaragua), **solo retiro en el local**.

- No hay pasarela de pago: se cobra **en el local al retirar** y el panel tiene su propio POS con
  caja, turnos, arqueo, devoluciones y factura.
- La propina es **opcional y viene desmarcada**.
- Multi-sucursal: hay 3 locales reales (**Camino de Oriente**, **Carretera Masaya**, **Casa Antigua**)
  y cada uno tiene su dirección, su horario, su tiempo de preparación y **su propio menú y precios**.
- La moneda es `C$` / `NIO` y el prefijo telefónico `+505`.

## 2. Superficies

Un **solo build** sirve todas las superficies; el ruteo se decide por el host de la request
(`src/shared/config/host-routing.ts`, puro y con tests).

| Superficie | Ruta / host | Qué es |
|---|---|---|
| **Landing** | apex y `www` (`src/app/(landing)/landing/page.tsx`) | Pantalla completa con animación de scroll y botón MENU; redirige (307) las páginas de la app hacia `menu.*` |
| **App pública** (menú y pedido) | `menu.oneburgernic.com` (`src/app/(public)/**`) | Home, menú, detalle de producto, carrito, checkout para retirar, confirmación, seguimiento del pedido y «Mi actividad» |
| **Panel** | `admin.oneburgernic.com` (`src/app/(admin)/admin/**`) | Todas las pantallas internas; su raíz redirige a `/admin` |
| **Órdenes / KDS** (comandas) | `/admin/orders` | Tablero del turno en tres carriles (por aceptar, en preparación, listas) con urgencia por etapa, auto-refresh, aceptar/rechazar, búsqueda y filtros |
| **POS** | `/admin/pos` | Venta de mostrador sobre el catálogo real, con modificadores, cobro y vuelto |
| **Caja** | `/admin/cash`, `/admin/cash/config`, `/admin/cash/report` | Turno (abrir/cerrar), arqueo por moneda y denominación, cierres, aprobaciones y configuración de caja |
| **Historial** | `/admin/history/cierres`, `/admin/history/facturas` | Cierres de caja y facturas emitidas |

`localhost`, las IPs y el host por defecto de la plataforma quedan **fuera** de la clasificación:
siguen sirviendo la app de pedidos tal cual, así que el entorno local y el E2E no dependen de los
subdominios.

## 3. Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript estricto**
- **Prisma 6** + **PostgreSQL 17**
- **Tailwind CSS 4** con tokens CSS propios en `src/app/globals.css`
- **Vitest** (unitarios y contratos) · **Playwright** (E2E) · **ESLint**
- **Docker** multi-stage → **Easypanel** (build desde GitHub `main`)
- **GHCR** para la imagen publicada (`ghcr.io/danielmaki123/one-burger-commerce`)

## 4. Arquitectura (DDD)

```
src/modules/<módulo>/{domain,features,ports,adapters}
src/app/**              rutas (App Router) + API routes
src/shared/{ui,lib,config,pwa,contracts}
src/infrastructure/**   prisma, event bus
```

| Capa | Qué contiene | Qué **no** puede hacer |
|---|---|---|
| `domain` | Tipos, invariantes, políticas, value objects, transiciones y reglas financieras del módulo | I/O; importar `app/`, `adapters/`, `infrastructure/` ni `@prisma/client` (lo verifica `module-contract.test.ts`) |
| `features/<caso-de-uso>` | Orquesta el caso de uso con dependencias inyectadas (`{ repository, ... }`) y define la transacción cuando corresponde | Instanciar Prisma |
| `ports` | Interfaces de repositorio o servicio externo que necesitan dominio y aplicación | — |
| `adapters` | Prisma, cookies, Telegram, servicios externos, `in-memory-*` para tests | — |

El **dominio no depende de los adapters**. Un módulo nuevo nace con las cuatro capas.

## 5. Bounded contexts

`src/modules/` (el estado «MVP / fuera del MVP» de cada uno está en su `README.md`):

| Módulo | Contexto | Estado |
|---|---|---|
| `orders` | El pedido y su ciclo de vida: alta, estados e historial, seguimiento público, aceptación, turnos de caja y totales | MVP |
| `menu` | Catálogo: categorías, subcategorías, productos, grupos de modificadores y bloques de marketing | MVP |
| `locations` | Sucursales: dirección, horario, preparación y menú/precios por local | MVP |
| `customers` | Identidad del cliente (OTP por WhatsApp, sesión) | MVP con proveedor pendiente |
| `auth` | Sesión y permisos **del panel**: login, logout, cookie, roles y usuarios del admin | MVP |
| `business-settings` | Configuración del negocio: identidad, contacto, horarios, moneda, propina, zona horaria | MVP |
| `notifications` | Avisos por **outbox** (Telegram del negocio y webhooks) | MVP (canal según entorno) |
| `pos` | Venta de mostrador: borrador, vista del catálogo, cobro | MVP |
| `cash-config` | Reglas con las que se firma un arqueo: monedas, denominaciones, arqueo ciego | MVP |
| `banks` | Bancos/estaciones de cobro del desglose por medio de pago | MVP |
| `invoices` | Facturas emitidas | MVP |
| `coupons` | Cupones (el motor de promos vive en `orders`) | **carpeta reservada, sin código** |
| `table-ordering` | Pedido por QR desde la mesa | **carpeta reservada, sin código** |
| `inventory` | Stock, recepciones, conteos, mermas y alertas | **fuera del MVP** |
| `reservations` | Reservas de mesa | **fuera del MVP** |
| `dashboard` | Resumen y reportes | **fuera del MVP** |
| `tables` | Mesas (solo `lib`) | **fuera del MVP** |
| `audit` | Log de acciones sensibles | Soporte |
| `landing` | Reglas del landing | Soporte |

Fuera del MVP = **el código existe y tiene tests, pero no se ofrece en la UI ni en las APIs públicas**.
No se reactiva sin pedido explícito del owner.

## 6. Persistencia

- Esquema único en `prisma/schema.prisma`; migraciones versionadas en `prisma/migrations/`.
- El contenedor aplica `prisma migrate deploy` **al arrancar y antes de servir tráfico** (con
  reintentos), salvo `MIGRATIONS_AUTO=false`.
- `prisma/seed.ts` es **solo para local/demo** (`admin@example.com` / `Admin1234!`): **nunca** en
  producción.
- Las migraciones van **sin BOM** (un BOM rompe `migrate deploy` en cualquier base nueva) y hay un
  test que lo verifica.
- Modelos centrales del dinero: `Payment`, `Refund`, `Shift`, `ShiftCashCount`, `ShiftBankClose`,
  `CashMovement`, `Invoice`, `Coupon`, `OutboxEvent`.
- **Medios de cobro del POS**: `POS_PAYMENT_METHODS` = `cash`, `card`, `transfer`, `other` — una sola
  lista para la pantalla, la API del cobro y la venta en espera (`src/modules/pos/domain/pos-sale.ts`).
  `mixed` **no se elige**: se deriva de que el cobro se partió en más de un medio. Cada `Payment` se
  firma con el `shiftId` de la terminal **al cobrar**, y el cierre congela el desglose por medio
  (`cashSalesAmount`, `cardSalesAmount`, `transferSalesAmount`, `otherSalesAmount`, `tipsAmount`).
- `CashMovement` es plata que entra o sale del cajón **sin ser un cobro** (retiro/ingreso, con motivo
  obligatorio y responsable): afecta el esperado del turno, no es parte de una venta.
- `Invoice` es una **factura simple, explícitamente no fiscal** (sin autorización de la DGI ni rango
  oficial de numeración): se emite por su **propio caso de uso/API** (`emit-invoice`,
  `POST /api/admin/orders/[id]/invoice`), **no** dentro del cobro del POS.

## 7. Eventos y outbox

- `OutboxEvent` (`status`, `attemptCount`, `lockedAt`, `processedAt`, índices por `status`,
  `eventType`, agregado y `createdAt`) es el registro durable del hecho.
- `src/modules/notifications` entrega después, con `NOTIFICATIONS_DRIVER`
  (`dummy` descarta todo; `telegram_alerts` usa un bot **del SaaS**) y un procesador de outbox
  (`OUTBOX_PROCESSOR_*`) que corre por scheduler.
- `src/infrastructure/events/event-bus.ts` es un bus **en memoria** para suscriptores locales; no
  reemplaza al outbox y su fallo no rompe el flujo principal.
- Las alertas del negocio (cierre de turno, devolución grande, diferencia de caja) se configuran en
  `/admin/settings/notifications`.

## 8. Autenticación y autorización

**Panel**: cookie de sesión (`src/modules/auth/domain/session-cookie.ts`) + `getAdminSession` /
`requireAdminSession`. Los roles son **exactamente cuatro** (`src/modules/auth/domain/admin-role.ts`,
`enum AdminRole` en `prisma/schema.prisma`):

| Rol | Alcance |
|---|---|
| `owner` | Todo, incluida la configuración crítica y la personalización del negocio |
| `manager` | Órdenes, menú, promociones, inventario, caja y devoluciones — **no** usuarios, configuración crítica ni personalización |
| `kitchen` | Solo órdenes; **no** maneja plata (sin POS) |
| `cashier` | Solo el mostrador: abre el turno, cobra y lo cierra. **No** ve el esperado del arqueo, no administra caja, no devuelve y no descuenta a mano |

Las puertas son **funciones de dominio** en `src/modules/auth/domain/admin-permissions.ts`
(`canUsePOS`, `canManageCash`, `canRefund`, `canApproveRefund`, `canManageCashConfig`,
`canPrintCashDocuments`, `canDiscountPosSale`, …), y el alcance por sucursal del staff sale de
`AdminUserLocation` (sin asignación ve todas; `owner` ve todas; fuera de alcance es 403).

**Cliente**: identidad por **OTP de WhatsApp**. No hay proveedor real configurado, así que
`/api/customer/auth/request-otp` responde **503** en producción.

**Regla transversal**: la autorización se aplica en el **servidor**. Ocultar algo en React **no** es
autorización; la UI solo refleja lo que el servidor ya decidió.

## 9. CI y despliegue

**CI**: `.github/workflows/publish-ghcr.yml` corre en cada push a `main`, en cada PR hacia `main` y a
mano. Jobs: **`verify`** (secrets, lint, typecheck, tests, build), **`contracts`** (los guardrails de
`src/shared/contracts/`), **`migrations`** (Postgres limpio + drift) y **`container`** (imagen real,
readiness y bootstrap del admin). **`publish`** (imagen a GHCR) corre **solo** en push a `main`.

**Protección de `main`**: ruleset `Protect main` sobre `refs/heads/main` con `deletion`,
`non_fast_forward` y `required_status_checks` (`verify`, `contracts`, `migrations`, `container`, con
`strict`). Detalle operativo y cómo verificarlo, en `AGENTS.md` § *PR y CI*.

**Despliegue**: Easypanel (`brunobot` / `oneburguerweb`), **una sola llamada** a `deployService` con
`forceRebuild`, **solo desde `main`** y con el OK del owner. Secuencia exacta, backups, rollback y
límites conocidos en [`../ops/production-readiness.md`](../ops/production-readiness.md).

## 10. Integraciones externas

| Integración | Estado |
|---|---|
| **Telegram** (alertas del negocio) | Token por entorno; chat, eventos y umbrales los configura el owner en el panel |
| **n8n** (webhooks de notificación) | Variables `N8N_*` presentes; el canal se elige por entorno |
| **OTP de WhatsApp** (cliente) | **Sin proveedor real**: 503 en producción |
| **Easypanel API** | Deploy y operación del servicio; el token da acceso total al servidor |
| NextAuth, Supabase, Linear | Variables heredadas del proyecto de origen: **nada las lee** |

## 11. Fuentes de verdad

| Tema | Fuente |
|---|---|
| Comportamiento del agente, límites y reglas | [`../AGENTS.md`](../AGENTS.md) |
| Cómo está construido el sistema (este archivo) | `.agents/CONTEXT.md` |
| Conocimiento estable aprendido | [`.agents/MEMORY.md`](MEMORY.md) |
| Procedimientos repetibles | [`.agents/skills/`](skills/) |
| Estado operativo actual | [`../ops/CURRENT.md`](../ops/CURRENT.md) |
| Cola de auditoría | [`../ops/audit-backlog.md`](../ops/audit-backlog.md) |
| Runbook de producción | [`../ops/production-readiness.md`](../ops/production-readiness.md) |
| UI — sistema de diseño oficial | [`../ops/references/stitch/design-system.md`](../ops/references/stitch/design-system.md) |
| Registro de componentes | `src/shared/ui/registry.json` |
| Reglas ejecutables | `src/shared/contracts/*.test.ts` |
