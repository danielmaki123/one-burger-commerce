# TASK-ORDERS-KITCHEN-FOUNDATIONS-001 — Consolidar auditoría, ownership, secuencia y Design Freeze de Pedidos / Cocina

> **Qué es**: la **TASK de fundaciones** de `Pedidos / Cocina` (orden 3 del
> [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md)). Saca del chat y versiona la auditoría real, el
> **ownership**, la matriz de reutilización, las **specs corregidas** y las **referencias aprobadas**, para
> que las TASK siguientes arranquen desde `main` sin contexto externo. **No implementa nada.**
>
> **Una sola arquitectura y un solo roadmap**: donde este brief y una autoridad existente se contradicen,
> gana la autoridad y este brief se corrige; donde el brief **decide** algo nuevo, se escribe en el documento
> que ya posee esa autoridad (spec de pantalla, `MODULE_ARCHITECTURE.md`, roadmap, backlog) y acá queda el
> puntero.

## TASK ID

`TASK-ORDERS-KITCHEN-FOUNDATIONS-001`

## Título

Consolidar la auditoría, el ownership, la secuencia y el Design Freeze de Pedidos / Cocina.

## Prioridad

`P2` — no hay función rota ni plata en riesgo **por esta TASK** (no toca runtime); lo que cierra es el riesgo
de que la próxima TASK reconstruya capacidades que ya existen o duplique reglas de otro dueño.

## Clase de riesgo

`docs/CI`.

## DELIVERY MODE

- [x] `docs-only`
- [ ] `runtime-e2e`
- [ ] `high-risk-e2e`

PR → CI verde → squash merge → `main` verde → estado. **Sin deploy, sin runtime, sin migraciones, sin APIs,
sin navegación.** Declarar `docs-only` una TASK que toca runtime está prohibido
([`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md) §6): esta TASK **no** toca `src/`, `prisma/`,
`tests/` ni `.github/`. La única carpeta no-`ops` que se toca es `ops/design/screens/` (specs y referencias).

## STOP CONDITIONS específicas de esta TASK

1. **Si un hallazgo de la auditoría no se reproduce**, se corrige el hallazgo (no se copia la conclusión).
2. **Si aparece una contradicción nueva**, se resuelve en el documento que **ya** posee esa autoridad; está
   **prohibido** crear un segundo documento normativo, un segundo roadmap o una segunda arquitectura.
3. **Si la evidencia contradice la hipótesis de orden del owner** (Cocina runtime antes de Money/Payments),
   se cambia el orden en el roadmap maestro y se justifica acá.

Ninguna de las tres se activó: ver § *Verificación de las premisas del pedido*.

---

## PROBLEMA

`Órdenes` (`/admin/orders`) es **una sola superficie** que mezcla tres cosas con dueños distintos: la bandeja
de operación del turno, la vista de cocina y el detalle con la plata. Eso produjo, verificado en el código:

1. **Una capacidad de negocio sin dato canónico**: hoy **no existe** ninguna fuente que distinga un pedido
   creado desde el menú público de uno creado desde el POS, y el POS crea el pedido con el **mismo** caso de
   uso que el checkout (`production-pos-sale.ts:90` → `createOrder`). Nada lo registra y nada lo infiere.
2. **La misma regla escrita cinco veces**: `comandaLane`, `orderBucket`, `getAdminOrderSolidStatus`,
   `ORDER_JOURNEY` y `DISPATCHED_STATUSES` mapean estado→etapa, y `confirmed` cae hoy en el carril de
   preparación (`comanda-helpers.ts:42`, `orders-page-helpers.ts:103`).
3. **Dos reglas monetarias distintas para el mismo hecho**: el POS convierte cada `Payment` a la moneda del
   negocio antes de compararlo contra el total (`pos-sale.ts:50-74`), mientras el cobro de un pedido que ya
   existe compara `Payment.amount` **crudo** contra `Order.total` (`register-order-payment.ts:124-140`) y
   recibe `businessCurrencyCode`/`usdExchangeRate` que **nunca usa**.
4. **El estado financiero del pedido no existe**: no hay `pending` / `partial` / `paid`, `paidAmount` ni
   `outstandingAmount` en ningún lado; el único "saldo" se calcula ad-hoc dentro de dos casos de uso y una
   pantalla de React suma montos crudos de monedas distintas para mostrar «Cobrado».
5. **Una fuga de dato a un rol**: `kitchen` pasa la puerta del detalle, del monto de envío y de la impresión
   de la factura (`A-60`), y la ruta de la factura no tiene puerta de rol ni alcance por sucursal.
6. **Una contradicción de autorización**: la navegación ofrece Órdenes a los cuatro roles
   (`admin-layout-helpers.ts:97`, `canSee: everyRole`) y es la **home** del `cashier`
   (`admin-shell.tsx:120`), mientras la API le responde 403 (`api/admin/orders/route.ts:59`); la pantalla lo
   presenta como «Sesión de administrador requerida», que es falso (`A-66`).

Sin resolver esto primero, la TASK de Cocina y la de Pedidos **reconstruirían** lo que ya existe o
**duplicarían** reglas de `money`/`payments`/`invoices`/`auth`.

## REUSE AUDIT

```md
Objetivo:  que un operador mueva un pedido de "entró" a "entregado" (Cocina) y que alguien localice y
           revise un pedido con su historia y su estado de cobro (Pedidos), sin inventar capacidades.

Capacidad existente:
  - Ciclo de vida y transiciones: `src/modules/orders/domain/order-workflows.ts` (una sola fuente).
  - Alta del pedido: `src/modules/orders/features/create-order/create-order.ts` — la usan el checkout
    público (`src/app/api/orders/route.ts:177`) y el POS (`production-pos-sale.ts:90`).
  - Idempotencia del alta: `Order.idempotencyKey @unique` + `createOrder` (TASK-101).
  - Sellos de tiempo: `src/modules/orders/domain/order-stage-times.ts` (`stageChangedAt`, `readyAt`,
    `averagePrepMinutes`) sobre `OrderStatusHistory`.
  - Solicitud/cobro de un pedido existente: `src/modules/orders/features/register-order-payment/**` +
    `POST /api/admin/orders/[id]/payment` con `lockOrderRow` y `lockShiftRow`.
  - Tablero de comandas: `order-comanda-board.tsx`, `order-comanda-card.tsx`, `comanda-helpers.ts`,
    `comanda-url.ts`, `kitchen-tabs.ts`, `kitchen-mode.ts`, `use-comanda-view.ts`,
    `admin-alert-sound.ts`, `orders-page-helpers.ts` (`sortQueueOrders`).
  - Búsqueda y alcance: `src/modules/orders/domain/order-search.ts`, `order-visibility.ts`,
    `src/app/api/admin/orders/order-scope.ts`.
  - Factura: `src/modules/invoices/**` (una por pedido, correlativo asignado, anulación, hoja de 80 mm).
  - Dinero: `src/shared/lib/money-conversion.ts`, `POS_PAYMENT_METHODS` (`pos-sale.ts`),
    `PaymentRepository`, arqueo (`shift-cash.ts`, `close-shift.ts`).
  - Puertas: `src/modules/auth/domain/admin-permissions.ts`.

Qué se reutiliza:  TODO lo anterior, sin cambios de dueño. Cocina es una **proyección** de `orders` (no un
  módulo nuevo) y Pedidos es el **read model** de `orders`. El cobro del pedido existente se **compone**, no
  se reconstruye. Las specs nuevas no crean reglas: mueven el carril de `confirmed` y leen el estado
  financiero de su dueño.

Qué es realmente nuevo (y con qué dueño):
  1. `Order.source` (canal de origen) — propiedad **de `orders`**, escrita al crear. **MISSING** hoy.
  2. Los tres contratos de lectura `OrderListProjection` / `OrderDetailProjection` /
     `KitchenOrderProjection` — **contratos de lectura de `orders`**, sin dominios nuevos.
  3. Los sellos por etapa (`confirmedAt`, `preparingAt`, `readyAt`, `pickedUpAt`, `closedAt`) derivados de
     `OrderStatusHistory` en **una** función de `orders/domain`, y el inicio recomendado
     (`pickupTime - Location.pickupLeadMinutes`).
  4. El **estado financiero canónico** (`pending` / `partial` / `paid` + `paidAmount` + `outstandingAmount`)
     — dueño **`payments`** (módulo objetivo).
  5. Las **puertas nominales** de autorización (ver/localizar · operar Cocina · ver datos financieros) —
     dueño **`auth`**.

Una implementación paralela exigiría una responsabilidad de dominio distinta y no la hay: por eso **no** se
crea `modules/kitchen`, **no** se crea un módulo de Pedidos y **no** se crea una tercera regla de dinero.
```

---

## Verificación de las premisas del pedido (re-auditoría contra código real)

Cada premisa del pedido, con el veredicto y la evidencia. Lo que **no** se reprodujo se dice.

| Premisa del pedido | Veredicto | Evidencia |
|---|---|---|
| No existe una fuente canónica que distinga menú público de POS | **CONFIRMADA** | `Order` no tiene campo de origen (`prisma/schema.prisma:516-591`); el POS crea el pedido con el mismo caso de uso que el checkout (`production-pos-sale.ts:90-101` → `createOrder`); `CreateOrderRequest` no tiene `source` (`create-order.ts:60-113`); ninguna superficie muestra el origen y **ninguna heurística lo infiere** (grep de `source`/`canal`/`origin` en `src/app/(admin)/admin/orders/**`: sólo `orderTypePresentation(order.type)`, que es el **tipo**, no el canal — `order-comanda-card.tsx:118`) |
| `confirmed` cae hoy en el carril de preparación | **CONFIRMADA** | `comanda-helpers.ts:42` (`confirmed \| accepted \| preparing` → `preparing`) y `orders-page-helpers.ts:103` (`confirmed \| accepted \| preparing` → `cocina`) |
| La preparación real debería ser `preparingAt → readyAt` y hoy se mide desde `createdAt` | **CONFIRMADA** | `order-stage-times.ts:70-93`: `startedAt = Date.parse(order.createdAt)` (`:78`) |
| El POS convierte los `Payment` a moneda del negocio mientras el cobro de un pedido existente compara `Payment.amount` contra `Order.total` | **PARCIAL — la divergencia es real; el mecanismo del POS es distinto de lo supuesto** | El POS **convierte para comparar** (`register-pos-sale.ts:170-174`, `commit-sale.ts:71-75`) pero **no** convierte el monto que persiste ni congela la tasa (`commit-sale.ts:220-221`; no hay columna de tasa en `Payment`, `schema.prisma:836-874`). El cobro del pedido existente compara la suma **cruda** (`register-order-payment.ts:124-140`) con `businessCurrencyCode`/`usdExchangeRate` declarados y **sin usar** (`:57-58`) → `A-68` |
| `canEmitInvoiceFor` valida existencia de algún `Payment`, no saldo cero | **CONFIRMADA** | `invoice.ts:87-108` (sólo `status === "cancelled"` y `!hasPayments`), llamado con `hasPayments: countPayments > 0` (`emit-invoice.ts:161-164`, `production-invoice.ts:29`) |
| La factura actual es "simple, no fiscal" | **CONFIRMADA** | `invoice.ts:4-6`, `schema.prisma:439-441`, pie impreso «Documento no fiscal.» (`invoice-print-sheet.tsx:266`) |
| Hay contradicción entre navegación, API y roles | **CONFIRMADA** | Navegación `everyRole` (`admin-layout-helpers.ts:73,97`) + home del cajero (`admin-shell.tsx:120`) vs 403 de la API (`api/admin/orders/route.ts:59`, `[id]/route.ts:18`); la pantalla lo muestra como falta de sesión (`order-list-api.ts:124-126` → `page.tsx:866-878`) |
| `POST /api/admin/orders/[id]/payment` ya existe con sus casos de uso y locks | **CONFIRMADA** | `route.ts:18-36` → `payment-composition.ts` (`canUsePOS` `:76`, alcance `:90-94`) → `register-order-payment.ts` (`lockOrder` `:116`, saldo `:124-140`, `lockShift` `:149-160`) |
| Cocina es hoy un modo de la misma pantalla de Órdenes | **CONFIRMADA** | `use-comanda-view.ts` (clase `comandas-view` en `<html>`, `:59`), `kitchen-tabs.ts`, `kitchen-mode.ts` |
| No existe `modules/kitchen` | **CONFIRMADA** | `src/modules/` no tiene `kitchen` |
| Dos `pickupLeadMinutes` (negocio y local) | **CONFIRMADA (hallazgo nuevo)** | `Location.pickupLeadMinutes` (`schema.prisma:197`) y `BusinessSettings.pickupLeadMinutes` (`:814`); el checkout resuelve `location?.pickupLeadMinutes ?? settings.pickupLeadMinutes` (`src/app/(public)/checkout/page.tsx:251`, `api/orders/route.ts:150-162`) |
| Los pedidos del POS no tienen hora prometida | **CONFIRMADA (hallazgo nuevo)** | `commit-sale.ts:183-184` (`pickupTime: null, pickupScheduled: false`); el checkout siempre guarda una hora concreta (`api/orders/route.ts:184`) |

---

## Matriz `REUSE / ADAPT / CONSOLIDATE / NEW / MISSING / OUT`

`REUSE` se usa tal cual · `ADAPT` existe y cambia · `CONSOLIDATE` hay varias implementaciones y pasa a una ·
`NEW` no existe y se crea (con su dueño) · `MISSING` falta el **dato** de negocio · `OUT` fuera de alcance o
prohibido para esa superficie.

### Order

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| Creación desde el menú público | REUSE | `orders` | `createOrder` + `POST /api/orders` (`api/orders/route.ts:88-197`), con gate de aceptación y propina del servidor |
| Creación desde el POS | REUSE | `orders` + `pos` | `registerPosSale` → `createOrder` dentro de una transacción (`production-pos-sale.ts:79-110`) |
| `Order.type` | REUSE | `orders` | `enum OrderType { delivery, pickup, table }` (`schema.prisma:408-412`). **No es el origen** |
| `OrderStatus` | REUSE | `orders` | `schema.prisma:449-462`; transiciones en `order-workflows.ts:3-34` (fuente única) |
| `OrderStatusHistory` | REUSE | `orders` | `schema.prisma:625-638`, con `changedByUserId` (`A-09` sigue abierto: no se muestra) |
| `pickupScheduled` | REUSE | `orders` | `schema.prisma:542`; derivado por el servidor (`api/orders/route.ts:185`) |
| `pickupTime` | REUSE + ADAPT | `orders` | Existe (`:538`); **es `null` en los pedidos del POS** → toda superficie tiene que soportar «sin hora» sin inventarla |
| Items / modificadores / notas | REUSE | `orders` | `OrderItem` + `OrderItemModifier` + `OrderItem.notes` (`schema.prisma:593-623`) |
| Sucursal | REUSE | `orders` + `locations` | `locationId` obligatorio (`:521`), local se resuelve al leer (`get-order.ts:43`, `list-admin-orders.ts:27`) |
| Totales | REUSE | `shared` | `calculateOrderTotals` (`src/shared/lib/order-totals.ts`) — prohibido sumar a mano |
| Búsqueda | CONSOLIDATE | `orders` | La regla vive **dos veces**: `order-search.ts` (dominio) y su gemela en SQL (`prisma-order-repository.ts:488-501`) |
| Scope por sucursal | REUSE | `orders` + `auth` | `order-visibility.ts`, `order-scope.ts` |
| Lifecycle | REUSE | `orders` | `order-workflows.ts`; el flujo de retiro **ya** tiene la forma objetivo (`new → confirmed → preparing → ready_for_pickup → picked_up → closed`, `:13-20`) |
| Idempotencia del alta | REUSE | `orders` | `Order.idempotencyKey @unique` (`:526`) + `createOrder` (`:167-176`) |
| **Origen del pedido (`source`)** | **MISSING** | `orders` | No existe el campo, ni el parámetro, ni la escritura, ni la superficie. **Prohibido** inferirlo por `Payment`, por el nombre «Mostrador», por el turno, por el método de pago o por cualquier heurística |

### Tiempos

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `order-stage-times.ts` | REUSE + ADAPT | `orders` | `resolveStageChangedAt` / `resolveReadyAt` se reutilizan tal cual (`:30-59`) |
| `stageChangedAt` | REUSE | `orders` | Derivado del historial (`prisma-order-repository.ts:177`) |
| `readyAt` | REUSE | `orders` | Primer `ready`/`ready_for_pickup` (`order-stage-times.ts:48-59`) |
| `averagePrepMinutes` | ADAPT | `orders` | Hoy mide `createdAt → readyAt` (`:78`) y **debe** medir `preparingAt → readyAt`; sin `preparingAt` el pedido **no** entra al promedio (no se inventa un inicio) |
| `OrderStatusHistory` como fuente de los sellos | REUSE + NEW | `orders` | El historial ya tiene todo; **falta** la función que deriva `confirmedAt`, `preparingAt`, `readyAt`, `pickedUpAt`, `closedAt` en `orders/domain` |

### Programados

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `pickupScheduled` / `pickupTime` | REUSE | `orders` | `schema.prisma:538-542` |
| `Location.pickupLeadMinutes` | REUSE | `locations` | `schema.prisma:197`. Es la autoridad **por local** del inicio recomendado |
| `BusinessSettings.pickupLeadMinutes` | CONSOLIDATE | `business-settings` | Copia de negocio (`:814`) que hoy sólo actúa de respaldo cuando no hay local (`api/orders/route.ts:157-162`). Se conserva como respaldo; **manda el del local** |
| `acceptAlertMinutes` / `prepAlertMinutes` | REUSE | `locations` | `schema.prisma:201-203`; los consume `comandaThresholds` (`comanda-helpers.ts:116-135`) |
| Inicio recomendado `pickupTime - pickupLeadMinutes` | **NEW** | `orders` | No existe hoy. **Una** función en `orders/domain`; prohibido recalcularlo en cada UI |
| «El horario orienta, no bloquea» | REUSE | `orders` | `update-order-status.ts:42-44` no bloquea `confirmed → preparing` por horario |

### Cocina

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `OrderComandaBoard` / `OrderComandaCard` | REUSE | `orders` (proyección) | `order-comanda-board.tsx`, `order-comanda-card.tsx`. La tarjeta **ya no muestra totales ni PIN** (`:23`) |
| `comanda-helpers` · `sortQueueOrders` · mapas estado→etapa | CONSOLIDATE | `orders` | Hoy cinco mapas (`A-64`): `comandaLane`, `orderBucket`, `getAdminOrderSolidStatus`, `ORDER_JOURNEY`, `DISPATCHED_STATUSES`. Pasa a **un** mapa canónico en `orders/domain`, consumido por las dos superficies |
| Carril de `confirmed` | ADAPT | `orders` | Hoy `confirmed` está en preparación (`comanda-helpers.ts:42`); pasa a **ENTRADA** junto con `new` |
| Polling | REUSE | `orders` | `POLL_INTERVAL_MS = 15_000` (`orders/page.tsx:115,405`) |
| Frescura de los datos | REUSE | `orders` | `lastUpdatedAt` + `formatUpdatedAgo` (`orders-page-helpers.ts:180-190`), `offline={error !== null}` |
| Offline | REUSE | `orders` | La pantalla ya distingue «bandeja vieja» de error sin datos |
| Sonido | REUSE | `orders` | `admin-alert-sound.ts` |
| Scope / búsqueda / tabs / modo cocina | REUSE | `orders` + `auth` | `order-visibility`, `order-search`, `kitchen-tabs.ts`, `kitchen-mode.ts` |
| Workflow existente | REUSE | `orders` | `order-workflows.ts`; Cocina opera **sólo** `new→confirmed`, `confirmed→preparing`, `preparing→ready_for_pickup` |
| `modules/kitchen` | **OUT** | — | Prohibido: Cocina es una proyección de `orders` |
| Que Cocina llegue a cobro, saldo, `Payments`, PIN financiero, `Invoice` o retirada/cierre | **OUT** | — | Requisito duro; hoy se incumple por el detalle compartido (`A-60`) |

### Pedidos

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `/admin/orders` como read model denso y paginado | ADAPT | `orders` | Hoy la lista trae `items` + `modifiers` + historial **completo** de **todas** las filas y **no** pagina (`prisma-order-repository.ts:503-518`: sin `take`/`skip`) |
| La query pesada como solución final | **OUT** | — | `A-61`: proyecta `orderLookupTokenHash` y campos de GPS que ninguna vista lee, ignora `lateOnly`/`limit` y no pagina |
| `OrderListProjection` | **NEW** | `orders` | Contrato de lectura del listado (sin dominio nuevo) |
| `OrderDetailProjection` | **NEW** | `orders` | Contrato de lectura del detalle |
| `KitchenOrderProjection` | **NEW** | `orders` | Contrato de lectura de Cocina (**sin** campos de dinero) |
| KPI del header sobre el filtro completo | **NEW** | `orders` | Hoy los contadores salen de lo que ya vino al cliente; con paginación tienen que venir del servidor |
| Detalle con historia real e hitos de etapa | ADAPT | `orders` | El historial no se dibuja hoy; las fechas usan la zona del navegador (`A-63`) |

### Money / Payments

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `shared/lib/money-conversion.ts` | REUSE | `money` (objetivo) | Es la aritmética canónica; 5 importadores, todos legítimos |
| `pos/domain/payment-conversion.ts` | CONSOLIDATE | `money` | No duplica la aritmética: traduce el fallo a `PosError`. El mapeo está **repetido 6 veces** (`shift-cash.ts`, `close-shift.ts`, `shift-payment-mix.ts`, `shift-refund.ts`) |
| `pos/domain/pos-sale.ts` | ADAPT | `money` + `payments` | `paymentsTotalInBusinessCurrency` / `recordedPaymentsTotalInBusinessCurrency` (`:50-102`) son la regla canónica de «cuánto cubre este cobro» y hoy viven en `pos` |
| `PaymentRepository` | REUSE + ADAPT | `payments` (objetivo) | El puerto está completo (`payment-repository.ts:53-117`); `getPaymentSummary` suma **crudo** (`prisma-payment-repository.ts:161-176`) |
| Cobro de un pedido existente (`register-order-payment`) | ADAPT | `orders` → `payments` | `A-68`: compara montos sin la conversión canónica |
| Void de un cobro | REUSE | `orders` → `payments` | `canVoidPayment` (sólo owner), guarda `voidedAt: null` en el `WHERE`, `NOT_VOIDED` en cada consulta |
| Refunds | REUSE + CONSOLIDATE | `orders` → `payments` | La fórmula del cupo devolvible está **duplicada** (`request-refund.ts:79-85` y `update-order-status.ts:67-72`) y las dos hardcodean `"NIO"` como moneda implícita |
| `shift-refund.ts` | CONSOLIDATE | `money` | Hardcodea `"USD"`, usa `.toFixed(2)` y lanza `Error` genérico en vez de la aritmética compartida (`:41-50`) |
| Reconciliación | REUSE | `orders` → `cash` | `payment-reconciliation.ts` (totales **por moneda**, a propósito) |
| Caja / arqueo | REUSE | `orders` + `pos` → `cash` | `close-shift.ts:417-537`, `shift-cash.ts`, `shift-payment-mix.ts` |
| «Cobrado» calculado en React | **OUT** | — | `pos-payment.tsx:104-107` suma montos crudos de monedas distintas: prohibido en la arquitectura objetivo |

### Estado financiero

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `pending` / `partial` / `paid` | **NEW** | `payments` | **No existe**: grep de `paymentStatus\|isPaid\|paidInFull\|outstanding` en `src/` → 0 coincidencias |
| `paidAmount` / `outstandingAmount` | **NEW** | `payments` | Hoy se calculan ad-hoc: `alreadyPaid` (`register-order-payment.ts:125`), `pending` (`update-order-status.ts:71`), `remaining` (`request-refund.ts:85`) |
| Que `Orders` sea dueño de `Payments` | **OUT** | — | Prohibido: `orders` **consume** el estado financiero |
| Que React calcule el saldo | **OUT** | — | El cálculo vive en el servidor; React sólo dibuja |

### Invoice

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| Una factura por pedido | REUSE | `invoices` | `orderId String @unique` (`schema.prisma:1249`) |
| Correlativo | REUSE | `invoices` | Asignado en una sola operación con reintento acotado (`prisma-invoice-repository.ts:170-199`), no leído-y-escrito |
| Snapshot existente | REUSE | `invoices` | 31 campos congelados al emitir (`invoice.ts:21-61`, `emit-invoice.ts:185-210`) |
| Anulación | REUSE | `invoices` | Soft delete, sólo owner, motivo de lista cerrada (`invoice-void.ts:10-16`, `void-invoice.ts:38-40`) |
| Impresión 80 mm | REUSE | `invoices` | `invoice-print-sheet.tsx:58` (`80mm`), `@page { size: 80mm auto }` |
| «Guardar PDF» | REUSE | `invoices` | Es `window.print()` del navegador (`invoice-print-button.tsx:17`); **no hay** generador de PDF (`A-71`) |
| Datos fiscales existentes | REUSE | `business-settings` + `customers` | `BusinessSettings.legalName/taxId/taxAddress/taxPhone`, `Customer.legalName/taxId` |
| «Simple, no fiscal» | REUSE | `invoices` | Declarado en dominio, esquema y papel |
| `canEmitInvoiceFor` | ADAPT | `invoices` + `payments` | Hoy valida **existencia** de un cobro (`invoice.ts:99-105`): tiene que consumir el estado financiero canónico de `payments` |
| Automatizar `Payment → Invoice` | **OUT** | — | Prohibido en esta TASK; la factura sigue siendo una acción explícita |
| Reformar `Invoice` | **OUT** | — | Fuera de alcance |

### Permisos

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| Ver/localizar pedidos | ADAPT | `auth` | Hoy `canManageOrderOperations` (`admin-permissions.ts:39-45`: owner, manager, **kitchen**) |
| Operar Cocina | **NEW** | `auth` | No existe una puerta que separe «avanzar la comanda» de «administrar el pedido» |
| Ver datos financieros del pedido | **NEW** | `auth` | **No existe** (`A-60`): `kitchen` lee montos, PIN, cobros y factura |
| Cobrar | REUSE | `auth` | `canUsePOS` (`:54-60`) + alcance del POS (`requirePosLocation`) |
| Emitir factura | REUSE | `auth` | `canUsePOS` en la composición (`invoice-composition.ts:39-41`) |
| Anular cobro / factura | REUSE | `auth` | `canVoidPayment` (owner) · `assertCanVoidInvoice` (owner) |
| Administrar/anular operaciones | ADAPT | `auth` | `canManageOrderOperations` es una **puerta gruesa**: pasa a capacidades nominales |
| `canRefund` sin call site | ADAPT | `auth` | Definida (`:82-84`) y sin llamador de servidor: la devolución se pide con `canManageCash` |
| Implementar permisos | **OUT** | — | Esta TASK documenta el contrato; lo implementa la TASK de cada superficie |

### Handoff Pedido → POS

| Capacidad | Veredicto | Dueño | Evidencia / nota |
|---|---|---|---|
| `POST /api/admin/orders/[id]/payment` | REUSE | `orders` → `payments` | Existe con `canUsePOS`, alcance por sucursal y los dos locks. **No se reconstruye** |
| Superficie para cobrar un pedido del menú | **MISSING** | `orders` + `pos` | `A-67`: se eliminó del POS en `SCREEN-POS-QUICK-SALE-001.1` y no se reemplazó |
| Idempotencia del cobro de un pedido existente | **MISSING** | `payments` | `Payment` no tiene clave de idempotencia y el cuerpo de la ruta tampoco (`A-71`) |

---

## Matriz de ownership (conclusiones)

Escrita en [`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md) §5 — **ahí vive**; acá
queda el resumen de lo que esa tabla gana con esta TASK:

| Capacidad | Dueño canónico | Qué **no** puede hacer otro módulo |
|---|---|---|
| `Order`, items, lifecycle, scheduling y tiempos de etapa | `orders` | Ninguna UI ni `pos` recalcula transiciones, carriles ni sellos de tiempo |
| **Canal de origen del pedido (`Order.source`)** | `orders` | Prohibido inferirlo desde `payments`, el nombre del cliente, el turno, el medio de pago o una heurística |
| Configuración operativa por local (horario, `pickupLeadMinutes`, umbrales, `posEnabled`) | `locations` | El negocio sólo conserva el respaldo global |
| Moneda, locale, FX y conversión | `money` (objetivo) | Prohibido convertir en `pos`, en `orders` o en React |
| `Payment`, saldo, `pending`/`partial`/`paid`, refund, void y snapshots monetarios | `payments` (objetivo) | `orders` **consume** el estado financiero; no lo posee |
| Documentos y snapshots | `invoices` | Prohibido que la factura invente su definición de «pagado» |
| Autorización | `auth` | Prohibido decidir autorización en React |
| Cocina como superficie | **proyección de `orders`** | Prohibido crear `modules/kitchen` |

## Dependencias entre Order, Locations, Money, Payments, Invoice y Auth

```text
orders ──consume──► locations   (umbrales, horario, lead, punto de retiro)
orders ──consume──► money       (conversión y moneda)            ← objetivo, hoy vive en shared + pos
orders ──consume──► payments    (estado financiero del pedido)   ← objetivo, hoy no existe
orders ──consume──► invoices    (documento del pedido)
orders ──consume──► auth        (puertas de autorización)
payments ──consume──► money     (conversión antes de comparar contra el total)
invoices ──consume──► payments  (estado financiero canónico, no una definición propia)
invoices ──consume──► business-settings + customers (datos fiscales; se congelan al emitir)
```

**Dirección prohibida**: `payments`, `money` o `invoices` **no** dependen de `orders` para decidir una regla
de dinero; y `orders` **no** absorbe ninguna de las tres.

---

## SPEC / REFERENCE / DESIGN FREEZE

- **SPEC aprobadas**: `ops/design/screens/orders.md` (**Pedidos**: listado + detalle) y
  `ops/design/screens/kitchen.md` (**Cocina**), corregidas y creadas por esta TASK.
- **`reference.html`**: `Sí — [orders-desktop-reference.html](../design/screens/orders-desktop-reference.html)`
  (vistas de **listado** y **detalle**) y `Sí — [kitchen-reference.html](../design/screens/kitchen-reference.html)`
  (Cocina escritorio). **Aprobación del owner: 2026-09-27**, congeladas en `ops/design/screens/` con su hash.
- **Design Freeze**: aprobadas la spec y la referencia, quedan congeladas la **composición**, la **information
  architecture** y el **comportamiento principal**. Una desviación **material** modifica **primero** la spec y
  la decide el owner; si aparece durante la implementación, es **Stop Condition**.
- **Viewport Contract** (superficies operativas): `1366×768`, `1280×720`, `768×1024` y `375×812` — declarado
  en las dos specs.
- **Cierre**: la implementación real se compara contra la SPEC y la referencia **antes** de cerrar cada TASK, y
  la auditoría independiente repite esa comparación sobre el runtime después del deploy.

## EVIDENCIA

Toda la de § *Verificación de las premisas* y de las matrices, con `archivo:línea`. Los hallazgos **nuevos**
de esta auditoría quedan en [`../audit-backlog.md`](../audit-backlog.md) como `A-68`, `A-69`, `A-70` y
`A-71`; los que ya existían (`A-09`, `A-60`…`A-67`) se referencian, no se duplican.

## CAUSA RAÍZ

`Órdenes` creció como **una** pantalla que resolvía tres responsabilidades a la vez (operar el turno,
cocinar y administrar el pedido con su plata) y, como no tenía una frontera declarada, cada necesidad nueva se
resolvió donde estaba más cerca: el carril de `confirmed` se agregó al mapa que ya existía, la búsqueda del
pedido se escribió dos veces (dominio y SQL), la conversión de moneda se aplicó sólo en el camino que la
necesitaba en ese momento, y el detalle mostró todo el pedido porque no había una capacidad que dijera qué
parte es financiera. No es «faltaba un `if`»: es que **no había dueño declarado** para el canal de origen, ni
para el estado financiero, ni para las capacidades de autorización del pedido.

## INVARIANTE

1. Después de esta TASK, **cada capacidad de Pedidos/Cocina tiene un dueño escrito** y ninguna superficie
   nueva puede implementarla por su cuenta.
2. **La preparación real de un pedido es `preparingAt → readyAt`** y se calcula en un solo lugar.
3. **Un pedido de Cocina no expone dinero**: ninguna proyección de Cocina incluye totales, cobros, PIN
   financiero ni factura.
4. **El saldo del pedido tiene una sola autoridad** (`payments`) y no se calcula en React.
5. **El canal de origen no se infiere**: se escribe al crear o no existe.

## BOUNDED CONTEXT

**Ninguno** — esta TASK no toca `src/`. Los cambios de código que documenta pertenecen a `orders`, `pos`,
`money` (objetivo), `payments` (objetivo), `invoices`, `auth` y `locations`.

---

## SCOPE IN

- `ops/tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md` (este brief: auditoría, reuse audit, matrices,
  dependencias, secuencia).
- `ops/design/screens/orders.md` — spec de **Pedidos** corregida (premisas obsoletas incluidas).
- `ops/design/screens/kitchen.md` — spec de **Cocina** (nueva).
- `ops/design/screens/orders-desktop-reference.html` y `ops/design/screens/kitchen-reference.html` —
  referencias aprobadas, versionadas **sin modificar** el artefacto del owner.
- `ops/product/MODULE_ARCHITECTURE.md` — sólo las conclusiones de ownership, sin repetir leyes.
- `ops/roadmap/PRODUCT-UX-ROADMAP.md` — orden corregido a la luz de la evidencia.
- `ops/roadmap/NEXT.md`, `ops/roadmap/README.md`, `ops/roadmap/DECISIONS.md` (decisión del owner sobre el
  rol `cashier`).
- `ops/CURRENT.md` — resumen operativo.
- `ops/tasks/START-HERE.md` — la línea de «lo que sigue».
- `ops/audit-backlog.md` — hallazgos nuevos `A-68` a `A-71`.

## SCOPE OUT

- **Runtime**: ningún archivo de `src/` (ni un `page.tsx`, ni un componente, ni un caso de uso, ni un
  contrato). Nada de `prisma/`, migraciones, APIs ni navegación.
- **No se implementa** `Order.source`, ni las proyecciones, ni los sellos de tiempo, ni el estado financiero,
  ni las puertas de autorización, ni `/admin/kitchen`.
- **No se reforma** `Invoice` (ni su snapshot, ni `canEmitInvoiceFor`).
- **No se automatiza** `Payment → Invoice`.
- **No se toca** el roadmap de remediación técnica (`AUDIT-REMEDIATION-ROADMAP.md`) ni se cierran hallazgos
  que no se hayan verificado.
- **No se crea** un segundo roadmap, una segunda arquitectura, un `modules/kitchen` ni una tercera regla de
  dinero.

## DEPENDENCIAS

- **Owner**: aprobó las referencias el **2026-09-27** y autorizó esta TASK (`docs-only`); resolvió el modelo
  de roles objetivo, incluido el alcance del `cashier` (`D-014`).
- **TASK previa**: `TASK-GOV-001` (gobierno, leyes, arquitectura objetivo y roadmap), cerrada.
- **Credencial / migración**: `N/A — ninguna`.

## ARCHIVOS PROBABLES

| Archivo | Quién más lo consume |
|---|---|
| `ops/design/screens/orders.md` | `.agents/skills/screen-design`, `ui-change`, `PRODUCT-UX-ROADMAP.md`, `MODULE_ARCHITECTURE.md` |
| `ops/design/screens/kitchen.md` | ídem, y la TASK de Cocina |
| `ops/product/MODULE_ARCHITECTURE.md` | `AGENTS.md`, `CURRENT.md`, `START-HERE.md`, skills `new-task` y `ui-change` |
| `ops/roadmap/PRODUCT-UX-ROADMAP.md` | `AGENTS.md`, `CURRENT.md`, `START-HERE.md`, `NEXT.md`, `ops/roadmap/README.md` |
| `ops/audit-backlog.md` | `CURRENT.md`, `DECISIONS.md`, los briefs de remediación |

---

## TEST ROJO

`N/A — docs-only, no hay código nuevo`. La red de seguridad son los contratos que **ya** vigilan estos
documentos y que tienen que seguir verdes: `src/shared/contracts/governance-consolidation-contract.test.ts`
(las 17 entradas del orden autoritativo, en orden; `NEXT.md` ≤ 60 líneas y con «**Ninguno.**»; la arquitectura
visible objetivo; las cuatro clasificaciones), `agent-system-contract.test.ts` (techos de tamaño, incluido
`MODULE_ARCHITECTURE.md` ≤ 422 líneas y `ops/CURRENT.md` ≤ 250) y `docs-sync-contract.test.ts` (ningún
documento del camino de entrada puede referenciar un archivo inexistente).

## ESTRATEGIA

Auditar contra el código real antes de escribir una sola línea, corregir el pedido donde no coincidía
(la premisa del POS era **parcial**), y volcar cada conclusión en el documento que **ya** tiene esa autoridad:
la spec de la pantalla para la composición y los datos, `MODULE_ARCHITECTURE.md` para el ownership, el roadmap
para el orden, el backlog para lo que no se corrige acá y `CURRENT.md` para el estado. El brief queda como el
registro único de la auditoría, la matriz y las dependencias, y **enlaza** en vez de copiar.

## DDD

`N/A — esta TASK no cambia ninguna capa`. Las specs y el brief **declaran** dónde vive cada regla para que la
TASK siguiente no la ponga en React ni en el adaptador.

## TRANSACCIÓN

`N/A — no hay escritura`. (El reparto de responsabilidades de la venta del mostrador y del cierre de turno ya
está documentado y no se toca.)

## CONCURRENCIA

`N/A — no hay escritura`. Se **registra** (`A-68`, `A-71`) que el cobro de un pedido existente ya protege la
carrera con `lockOrderRow`/`lockShiftRow` (`register-order-payment.ts:106-160`) pero **no** tiene clave de
idempotencia.

## IDEMPOTENCIA

`N/A — no hay escritura`. El alta del pedido **sí** tiene clave (`Order.idempotencyKey`); el cobro de un
pedido existente **no** (`A-71`).

## AUTORIZACIÓN

Esta TASK **documenta** el contrato y **no** lo implementa. Capacidades nominales objetivo — separadas porque
hoy `canManageOrderOperations` es una sola puerta gruesa (`admin-permissions.ts:39-45`):

| Capacidad | Puerta objetivo | Owner | Manager | Kitchen | Cashier |
|---|---|---|---|---|---|
| Ver / localizar pedidos | `canViewOrders` (nueva) | ✓ | ✓ (según scope) | ✓ | ✓ (para cobrar desde el flujo canónico) |
| Operar Cocina (avanzar la comanda) | `canOperateKitchen` (nueva) | ✓ | ✓ (según scope) | ✓ | ✗ |
| Ver los datos financieros del pedido | `canViewOrderFinancials` (nueva) | ✓ | ✓ | **✗** | ✓ (en el cobro) |
| Cobrar | `canUsePOS` (existe) | ✓ | ✓ | ✗ | ✓ |
| Emitir factura | `canUsePOS` (existe) | ✓ | ✓ | ✗ | ✓ |
| Anular cobro / factura | `canVoidPayment` · `assertCanVoidInvoice` (existen) | ✓ | ✗ | ✗ | ✗ |
| Administrar / anular operaciones del pedido | nominal, derivada de las anteriores | ✓ | ✓ | ✗ | ✗ |

**Regla de implementación**: cada TASK de runtime implementa la puerta de **la superficie que crea**
(Cocina → `canOperateKitchen` y el recorte financiero del servidor; Pedidos → `canViewOrders` y
`canViewOrderFinancials`), con pruebas negativas. **No se implementa ninguna acá.** El recorte financiero es
requisito **de Cocina** porque hoy el detalle compartido le entrega montos, PIN, cobros y factura (`A-60`).

## MIGRACIÓN

`N/A — sin cambios de esquema`. La migración que hará falta (`Order.source`, aditiva y **nullable**) se
**declara** en las specs y en el roadmap: `null` significa «no declarado» para los pedidos que existieron
antes de la columna y **no se reconstruye** con heurísticas (ley 7: el pasado no se reescribe con la
configuración de hoy). La ejecuta la TASK de Cocina runtime.

## OBSERVABILIDAD

`N/A — sin runtime`. Se **registra** que `OrderStatusHistory` ya guarda `changedByUserId` (el actor del
cambio) y que `A-09` sigue abierto porque ninguna vista lo lee.

---

## TESTS UNITARIOS

`N/A — docs-only`. Los contratos de gobernanza y sincronización de documentos son la verificación.

## TESTS DE INTEGRACIÓN

`N/A — docs-only`.

## E2E

`N/A — docs-only`.

## MUTATION CHECK

`N/A — docs-only`. Equivalente aplicado: se **verificó cada premisa contra el código** y se corrigieron tres
enunciados (el mecanismo del POS, el `pickupTime` nulo del POS y la duplicación de `pickupLeadMinutes`) en vez
de copiarlos del pedido.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

`npm run build:webpack` no aplica (no se toca ninguna página). No se corren E2E (no se toca ningún flujo).

## CRITERIOS DE ACEPTACIÓN

- [ ] El brief existe, sigue la plantilla (`ops/tasks/TEMPLATE.md`) y **no deja campos en silencio**.
- [ ] Cada premisa del pedido tiene veredicto con `archivo:línea`; las que no se reprodujeron están
      corregidas (el mecanismo del POS, el `pickupTime` del POS, los dos `pickupLeadMinutes`).
- [ ] Las tres referencias aprobadas están versionadas en `ops/design/screens/`, con la fecha **2026-09-27** y
      sin modificar el artefacto del owner.
- [ ] `orders.md` ya no afirma «no se pide ningún dato nuevo / no hay FALTA» y declara los `FALTA` con su
      dueño y su dependencia.
- [ ] `kitchen.md` declara el flujo objetivo, el fin en **Listo**, el carril corregido de `confirmed` y las
      prohibiciones de dinero y documento.
- [ ] `MODULE_ARCHITECTURE.md` registra **sólo** las conclusiones de ownership y sigue en **≤ 422 líneas**.
- [ ] El roadmap conserva sus 17 entradas autoritativas, en orden, e incorpora los pasos intercalados con su
      justificación por dependencia real.
- [ ] `NEXT.md` apunta a **una sola** TASK siguiente, con la lista exacta de runtime que podrá tocar y la
      lista de lo que tiene prohibido duplicar.
- [ ] `CURRENT.md` queda como resumen operativo (≤ 250 líneas).
- [ ] Los hallazgos nuevos están en `audit-backlog.md` con ID y severidad, sin duplicar los existentes.
- [ ] CI verde (los cuatro checks) y merge por PR con `--squash`.

## REGRESIÓN

Los contratos de gobernanza fallan si: el roadmap pierde o desordena una de sus 17 entradas; `NEXT.md` deja de
declarar que no hay TASK activa o crece más de 60 líneas; `MODULE_ARCHITECTURE.md` pierde la arquitectura
visible objetivo, los módulos objetivo o las cuatro clasificaciones, o pasa de 422 líneas; o un documento del
camino de entrada referencia un archivo inexistente.

## ROLLBACK

`revert` del commit del merge. No hay base, ni migración, ni deploy: el rollback es documental y no deja
estado a medias.

## DOCUMENTACIÓN

Este brief, `ops/design/screens/orders.md`, `ops/design/screens/kitchen.md`, las dos referencias,
`ops/product/MODULE_ARCHITECTURE.md`, `ops/roadmap/PRODUCT-UX-ROADMAP.md`, `ops/roadmap/NEXT.md`,
`ops/roadmap/README.md`, `ops/roadmap/DECISIONS.md`, `ops/CURRENT.md`, `ops/tasks/START-HERE.md` y
`ops/audit-backlog.md`.

## MEMORY

`Sí — una lección reutilizable`: **una capacidad que todavía no tiene dueño no se inventa en la superficie que
la necesita**; el caso medido es la conversión de moneda aplicada sólo en el camino del POS (que la necesitaba
en ese momento) y ausente en el cobro del pedido existente, con la misma regla escrita dos veces y dos
resultados distintos sobre la misma plata (`A-68`). Va a `.agents/MEMORY.md` con el puntero al hallazgo.

## DEFINITION OF DONE

- [x] Tests verdes: rojo observable `N/A — docs-only` (documentado arriba); contratos de gobernanza verdes.
- [x] `security:secrets`, `lint`, `typecheck`, `test`, `test:contracts` y `build` verdes.
- [x] Verificación en navegador real: `N/A — no toca UI` (no se modifica ningún `src/`).
- [x] Ningún techo de deuda subió (los techos de documentos **solo bajan** y se respetan).
- [x] `ops/CURRENT.md` actualizado; `ops/audit-backlog.md` con los hallazgos nuevos; `MEMORY.md` con la lección.
- [ ] Commit + push a la rama, **PR abierto**, **CI verde**.
- [x] Deploy: `N/A — el Delivery Mode es `docs-only``.
