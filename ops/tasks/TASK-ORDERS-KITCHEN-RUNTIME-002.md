# TASK-ORDERS-KITCHEN-RUNTIME-002 — Cocina runtime (`/admin/kitchen` como proyección de `orders`)

> **Qué es**: la TASK de **runtime** de `Pedidos / Cocina` (orden **3b** del
> [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md)), autorizada por el owner. Implementa la
> **superficie `/admin/kitchen`** como **proyección de `orders`**, con el carril de `confirmed` corregido,
> el **canal de origen** (`Order.source`) y la separación de permisos/capacidad de Cocina.
>
> **Autoridades** (este brief **no** las reemplaza: las ejecuta): [`roadmap/NEXT.md`](../roadmap/NEXT.md)
> § *NEXT* (alcance exacto y lo prohibido de duplicar), la spec
> [`design/screens/kitchen.md`](../design/screens/kitchen.md) con su contrato
> [`kitchen-reference.html`](../design/screens/kitchen-reference.html) (**aprobado por el owner el
> 2026-09-27**), y el brief de fundaciones
> [`TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md`](TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md) (auditoría, ownership,
> matrices y contrato de autorización).

## TASK ID

`TASK-ORDERS-KITCHEN-RUNTIME-002`

## Título

Implementar Cocina como superficie propia (`/admin/kitchen`) proyectando `orders`, sin dinero y sin duplicar
reglas.

## Prioridad

`P1` — la TASK cierra una **fuga de datos a un rol** (`kitchen` lee totales, cobros y factura por el detalle
compartido: `A-60`) y mueve una regla de negocio (estado→carril) fuera de React. No hay plata en riesgo *por
esta TASK*: no toca `Payment`, ni el saldo, ni la factura.

## Clase de riesgo

`auth/datos` + `migración` — toca `src/modules/auth/domain/admin-permissions.ts` (autorización de servidor) y
`prisma/schema.prisma` (una columna nueva). La más alta que aplica: **`auth/datos`**.

## DELIVERY MODE

- [ ] `docs-only`
- [ ] `runtime-e2e`
- [x] **`high-risk-e2e`**

Lo declara [`roadmap/NEXT.md`](../roadmap/NEXT.md) y lo confirma esta auditoría: hay **esquema + migración** y
**autorización**. Corre el flujo completo de [`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md) §1
hasta **deploy y QA de producción**, con los gates de
[`database-migration`](../../.agents/skills/database-migration/SKILL.md) y
[`security-change`](../../.agents/skills/security-change/SKILL.md).

## STOP CONDITIONS específicas de esta TASK

Además de las diez de [`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md) §3:

1. Si aparece una **contradicción material** entre la spec `kitchen.md` y su `kitchen-reference.html` que
   cambie composición, información o comportamiento, se para y lo decide el owner (Design Freeze).
2. Si el canal de origen **no se puede escribir explícitamente** en alguna de las dos puertas de creación
   (menú público y POS) sin heurística, se para: está prohibido inferirlo.
3. Si el recorte financiero exigiera tocar `payments`, `money`, `invoices` o el saldo, se para: **fuera de
   alcance** por pedido explícito del owner.
4. Si el carril corregido de `confirmed` rompiera una superficie que **no** es de Cocina ni de Pedidos
   (POS, seguimiento público, reportes), se para y se reporta antes de tocar esa superficie.

---

## PROBLEMA

`Órdenes` (`/admin/orders`) es **una** superficie con tres dueños distintos (bandeja del turno, cocina y
detalle con la plata). De ahí salen los cuatro defectos que esta TASK cierra:

1. **Cocina no tiene superficie propia y sí acceso al detalle con dinero.** La cocina vive como *modo* de
   `/admin/orders` (`use-comanda-view.ts`, `kitchen-mode.ts`, `kitchen-tabs.ts`), y **toda** la bandeja lee
   `GET /api/admin/orders` (`api/admin/orders/route.ts:116`), que devuelve el `OrderRecord` completo
   —`subtotal`, `discount`, `total`, `tipAmount`, `paidWithAmount`, `pickupPin`, `orderLookupTokenHash`—:
   es la fuga `A-60`, y el recorte **no puede** hacerse en React (no es frontera de autorización).
2. **`confirmed` está en el carril equivocado.** `comanda-helpers.ts:42` mapea
   `confirmed | accepted | preparing → preparing`: un pedido aceptado aparece «en el fuego» sin que nadie
   haya empezado a cocinarlo. La spec lo manda a **ENTRADA** (`kitchen.md` § *Carriles*).
3. **La preparación real se mide mal.** `order-stage-times.ts:78` calcula el promedio desde `createdAt`
   (`createdAt → readyAt`), cuando la preparación real es **`preparingAt → readyAt`**; y no existe la
   derivación de los sellos por etapa (`confirmedAt`, `preparingAt`, `pickedUpAt`, `closedAt`) ni el
   **inicio recomendado** del programado (`pickupTime − Location.pickupLeadMinutes`).
4. **No existe el canal de origen.** Nada distingue un pedido del menú público de uno del POS: el POS crea el
   pedido con el **mismo** caso de uso (`commit-sale.ts:62` → `createOrder`), sin dejar rastro. La tarjeta de
   Cocina tiene que poder decir `MENÚ` / `POS` sin inventarlo.

Además, la regla **estado → carril** está escrita **cinco veces** (`comandaLane`, `orderBucket`,
`getAdminOrderSolidStatus`, `ORDER_JOURNEY`, `DISPATCHED_STATUSES`: `A-64`) con dos respuestas distintas para
`confirmed`, y la puerta de autorización es una sola y gruesa (`canManageOrderOperations`), sin capacidad
nominal para operar Cocina.

## REUSE AUDIT

**Gate obligatorio** (ley 2, *Reuse Audit*; [`MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md)
§10.1–§10.3). Auditoría hecha contra el código real, no contra el brief.

```md
Objetivo:  que la cocina mueva las comandas del turno de "entró" a "listo" —viendo antes lo que está por
           vencerse y respetando los programados— sin ver un solo dato de dinero, y que ese tablero sea una
           superficie propia (/admin/kitchen) y no un modo de Órdenes.

Capacidad existente (verificada, con archivo:línea):
  - Ciclo de vida y transiciones:        src/modules/orders/domain/order-workflows.ts:13-20
                                         (pickup: new→confirmed→preparing→ready_for_pickup→picked_up→closed)
  - Tablero de tres carriles:            src/app/(admin)/admin/orders/order-comanda-board.tsx (215)
  - Tarjeta de comanda (sin total/PIN):  src/app/(admin)/admin/orders/order-comanda-card.tsx:23-42
  - Carriles/urgencia/umbrales:          src/app/(admin)/admin/orders/comanda-helpers.ts
  - Tabs y modo inmersivo:               kitchen-tabs.ts, kitchen-mode.ts, use-comanda-view.ts
  - Acciones por tarjeta:                order-actions.tsx + order-action-helpers.ts
  - Sonido:                              admin-alert-sound.ts (WebAudio, opt-in)
  - Frescura / offline / polling:        orders-page-helpers.ts:180-190 · page.tsx:115,404-422
  - Orden de la cola por hora prometida: orders-page-helpers.ts:142-156 (sortQueueOrders)
  - Sellos de etapa (parcial):           src/modules/orders/domain/order-stage-times.ts
  - Lectura de la cola:                  ports/order-repository.ts:26-33,148 (listOrders → OrderQueueRecord)
  - Alcance por sucursal:                domain/order-visibility.ts + api/admin/orders/order-scope.ts
  - Búsqueda:                            domain/order-search.ts (+ su gemela en SQL)
  - Umbrales por local:                  Location.acceptAlertMinutes / prepAlertMinutes / pickupLeadMinutes
  - Idempotencia del alta:               Order.idempotencyKey @unique + createOrder
  - Lectura de locales:                  modules/locations/ports/location-repository.ts:16

Qué se reutiliza (sin reconstruir):
  TODO lo anterior. Cocina es una **proyección** de `orders`: se **mueven** los componentes del tablero a
  `src/app/(admin)/admin/kitchen/` y se **comparten** con Pedidos los helpers puros de presentación. El
  workflow, los totales, el polling, el sonido, la búsqueda, el alcance por sucursal y el scheduling **no se
  reimplementan**: se consumen.

Qué es realmente nuevo (con su dueño):
  1. `Order.source` (canal de origen) — dueño `orders`. **MISSING** hoy; se escribe explícitamente en las dos
     puertas (`api/orders/route.ts` → `menu`; `commit-sale.ts` → `pos`). Prohibido inferirlo o backfillearlo.
  2. `KitchenOrderProjection` — contrato de lectura de `orders` **sin un solo campo financiero**.
  3. La **ruta** `/admin/kitchen` + `GET /api/admin/kitchen/orders` + el caso de uso
     `list-kitchen-orders`. Responsabilidad distinta de la del listado del panel: **la cola de cocina**, no el
     read model denso.
  4. `orders/domain/order-lanes.ts` — el mapa canónico estado→carril en **un** lugar (se **mueve** el que hoy
     vive en la app: `A-64` no puede crecer).
  5. `orders/domain/order-stage-times.ts` — sellos por etapa derivados de `OrderStatusHistory` y preparación
     real `preparingAt → readyAt` (`averagePrepMinutes` corregido + la preparación más larga).
  6. `orders/domain/order-scheduling.ts` — inicio recomendado (`pickupTime − Location.pickupLeadMinutes`).
  7. `canOperateKitchen` + `assertKitchenStatusTransition` — la puerta nominal de `auth` y la capacidad de
     Cocina aplicada **en el servidor**.

Una implementación paralela exigiría una responsabilidad de dominio distinta y **no la hay**: por eso **no**
se crea `modules/kitchen`, ni un segundo workflow, ni un segundo cálculo de totales, ni un segundo sistema de
scheduling, ni un segundo scope de sucursal, ni una segunda lógica de polling/sonido/frescura.
```

## SPEC / REFERENCE / DESIGN FREEZE

- **SPEC aprobada**: [`design/screens/kitchen.md`](../design/screens/kitchen.md) (250 líneas) — ruta, roles,
  propósito, decisiones, flujo objetivo, datos, jerarquía, carriles, acciones, estados, viewports.
- **`reference.html`**: `Sí — ops/design/screens/kitchen-reference.html`, **aprobada por el owner el
  2026-09-27** y versionada sin modificar. Es **contrato** de composición, jerarquía, densidad y
  comportamiento responsive: se **traduce** a los componentes reales, no se copia el HTML.
- **Design Freeze**: congeladas la composición (tres carriles + conmutador en tablet/móvil), la información
  (número, canal, cliente, hora, urgencia, items) y el comportamiento (una acción primaria por tarjeta; sin
  acción en Listos). Una desviación **material** modifica **primero** la spec y la decide el owner; si
  aparece durante la implementación es **Stop Condition** (§ arriba, 1).
- **Divergencias declaradas de entrada** (ya escritas en `kitchen.md` § *Divergencias declaradas* y
  respetadas acá): `Retiro: lo antes posible` para el pedido del POS (no se inventa una hora); `Objetivo` = el
  umbral del local (`preAlertMinutes`), no un objetivo de negocio separado; la etiqueta de canal sólo se
  dibuja si `Order.source` tiene valor.
- **Divergencias adicionales detectadas en el preflight** (se resuelven **a favor de la referencia aprobada**
  y se corrigen en la spec en el mismo commit, por ser la referencia la autoridad de composición y
  comportamiento):
  | Punto | La spec dice | La referencia (contrato) muestra | Qué se implementa |
  |---|---|---|---|
  | Cronómetro del carril PREPARANDO | «tiempo en la etapa actual» (`hace N min`) | `PREP 08m` / `PREP 24m` | tiempo en la etapa **desde `preparingAt`**, rotulado `PREP N m` |
  | «Más larga» | dato **FALTA** en el carril LISTOS | `Más larga 24 min` en la cabecera | se deriva de `preparingAt → readyAt` de los pedidos listos del turno |
- **Viewport Contract** (superficie **operativa**, `DESIGN_SYSTEM.md` §12): `1366×768`, `1280×720`,
  `768×1024` y `375×812`; el scroll vive en el **cuerpo de cada carril**, la página no scrollea.
- **Cierre**: la implementación real se compara contra la SPEC y la referencia **antes** de cerrar la TASK;
  la auditoría independiente repite la comparación sobre el runtime **después** del deploy.

## EVIDENCIA

| Premisa | Veredicto | Evidencia |
|---|---|---|
| Cocina es hoy un modo de `/admin/orders` | **CONFIRMADA** | `use-comanda-view.ts:23,59` (`html.comandas-view`), `kitchen-mode.ts`, `kitchen-tabs.ts`; `orders-toolbar.tsx:124-139` |
| La bandeja lee el `OrderRecord` completo (fuga a `kitchen`) | **CONFIRMADA** | `api/admin/orders/route.ts:116` devuelve `listAdminOrders` → `OrderQueueRecord = OrderRecord & {stageChangedAt, readyAt}` (`ports/order-repository.ts:26`) con `total`, `subtotal`, `tipAmount`, `paidWithAmount`, `pickupPin`, `orderLookupTokenHash` (`domain/order.types.ts:88-152`) |
| `confirmed` cae en preparación | **CONFIRMADA** | `comanda-helpers.ts:42`; `orders-page-helpers.ts:103` |
| La preparación se mide desde `createdAt` | **CONFIRMADA** | `order-stage-times.ts:78` (`Date.parse(order.createdAt)`) |
| No existe el canal de origen | **CONFIRMADA** | `Order` sin campo de origen (`schema.prisma:516-591`); `CreateOrderInput` (`ports/order-repository.ts:49-87`) y `CreateOrderRequest` (`create-order.ts:60-113`) sin `source` |
| Las cinco puertas del POS y del menú crean el pedido sin canal | **CONFIRMADA** | `api/orders/route.ts:177-194` (menú) y `commit-sale.ts:62,141-192` (POS) |
| `kitchen` pasa la puerta de operaciones y ve todo | **CONFIRMADA** | `admin-permissions.ts:39-45` (`canManageOrderOperations` incluye `kitchen`); `api/admin/orders/[id]/route.ts:26` → `getOrder` con `payments` (`get-order.ts:44-47`) |
| La navegación ofrece Órdenes a los cuatro roles | **CONFIRMADA** | `admin-layout-helpers.ts:97` (`everyRole`) |
| `Location.pickupLeadMinutes` existe y es la autoridad por local | **CONFIRMADA** | `schema.prisma:197` (default 25) |
| Los pedidos del POS no tienen hora prometida | **CONFIRMADA** | `commit-sale.ts:183-184` (`pickupTime: null, pickupScheduled: false`) |
| El promedio de preparación es lo único derivado de `OrderStatusHistory` en la cola | **CONFIRMADA** | `order-stage-times.ts:30-59` (`resolveStageChangedAt`, `resolveReadyAt`) |

## CAUSA RAÍZ

No es «faltaba un `if`». **No había una frontera declarada** entre tres responsabilidades del pedido (operar
el turno, cocinar y administrar con la plata), así que cada necesidad nueva se resolvió **donde estaba más
cerca**: el carril de `confirmed` se agregó al mapa que ya existía —sin dueño de esa regla—, la comanda nació
como un modo de la pantalla que ya tenía la plata, y el canal de origen nunca se modeló porque nadie era dueño
del dato. Cuando una regla no tiene dueño, la superficie que la necesita la escribe, y cinco superficies
escribieron cinco mapas con dos respuestas distintas (`A-64`).

## INVARIANTE

1. **Cocina no ve dinero**, y no lo ve **por API**: ningún campo financiero existe en
   `KitchenOrderProjection`, así que no puede llegar al cliente ni con React manipulado. (Ausencia de campo,
   no ocultamiento en UI.)
2. **La preparación real de un pedido es `preparingAt → readyAt`** y se calcula en **un solo lugar**
   (`orders/domain`). Un pedido sin `preparingAt` **no entra** al promedio: no se le inventa un inicio.
3. **El canal de origen no se infiere**: `Order.source` es `null` (no declarado, para todo el pasado) o el
   valor que la puerta de creación escribió explícitamente. No existe ninguna función que lo deduzca.
4. **`confirmed` pertenece a ENTRADA**: aceptado no es «en el fuego». La preparación empieza en
   `confirmed → preparing`.
5. **Cocina termina en Listo**: las únicas transiciones que la puerta de Cocina autoriza son
   `new → confirmed`, `confirmed → preparing` y `preparing → ready_for_pickup` (más `→ cancelled` con motivo).
6. **Cada capacidad de Cocina tiene su puerta aplicada en el servidor**: la ruta responde 403 sin
   `canOperateKitchen`, aunque el rol hoy coincida con otra puerta.

## BOUNDED CONTEXT

Un solo módulo dueño: **`orders`** (`domain`, `features`, `ports`, `adapters`). Se **consumen** `auth`
(puertas, `canOperateKitchen`) y `locations` (umbrales y `pickupLeadMinutes`). **No** se toca `payments`,
`money`, `invoices` ni `pos` más allá de la escritura del canal de origen en la puerta del POS
(`commit-sale.ts`: un campo del alta, sin regla nueva).

---

## SCOPE IN

**Dominio (`src/modules/orders/domain/`)**

- `order-lanes.ts` (**nuevo**): el mapa **canónico** estado→carril en un solo lugar (se **mueve** desde la
  app), con los tres carriles `ENTRADA` · `PREPARANDO` · `LISTOS`, sus grupos internos, los estados
  equivalentes (`accepted`/`ready`) y los contadores. `confirmed` entra en **ENTRADA**.
- `order-stage-times.ts` (**adaptar**): sellos por etapa (`confirmedAt`, `preparingAt`, `readyAt`,
  `pickedUpAt`, `closedAt`) derivados de `OrderStatusHistory` en **una** función;
  `averagePrepMinutes` pasa a medir `preparingAt → readyAt` (sin `preparingAt` el pedido no cuenta) y se
  agrega la **preparación más larga** del conjunto.
- `order-scheduling.ts` (**nuevo**): inicio recomendado (`pickupTime − pickupLeadMinutes`), si el pedido es
  programado y si es de **otro día** (grupo *Programados* de ENTRADA).
- `order-kitchen-transitions.ts` (**nuevo**): las tres transiciones que Cocina puede ejecutar, como
  capacidad de dominio derivada de `order-workflows.ts` (no un segundo workflow).
- `order.types.ts` (**adaptar**): `OrderSource` (`menu` | `pos`) y `source` en `OrderRecord`.

**Puertos y adaptadores**

- `ports/order-repository.ts`: `source` en `CreateOrderInput`; la cola expone los sellos que la proyección
  necesita (`preparingAt`) y un `listKitchenOrders(filter)` que **no** proyecta campos financieros.
- `adapters/prisma-order-repository.ts` y `adapters/in-memory-order-repository.ts`: implementan lo anterior
  (los dos, porque los dos tienen que decir lo mismo).

**Caso de uso**

- `features/list-kitchen-orders/**` (**nuevo**): la proyección de Cocina, con el local y los umbrales
  resueltos en el servidor. Devuelve **cero** campos financieros, por construcción del tipo.

**Ruta**

- `src/app/api/admin/kitchen/orders/route.ts` (**nuevo**, ≤ 50 líneas, sin Prisma): sesión →
  `canOperateKitchen` → alcance por sucursal (reusa `order-visibility`, sin un segundo scope) → caso de uso.

**Esquema y migración**

- `prisma/schema.prisma`: `enum OrderSource { menu pos }` + `Order.source OrderSource?` (nullable, **sin**
  default y **sin** backfill: `null` = «no declarado»).
- **Una** migración aditiva sin BOM (`prisma/migrations/<ts>_add_order_source/`).

**Escritura explícita del canal (las dos puertas)**

- `src/app/api/orders/route.ts` (menú público) → `source: "menu"`.
- `src/modules/pos/features/register-pos-sale/commit-sale.ts` (`saleOrderRequest`) → `source: "pos"`.
- `src/modules/orders/features/create-order/create-order.ts`: acepta y persiste `source` **tal como llega**.

**Autorización**

- `src/modules/auth/domain/admin-permissions.ts` + su test: **`canOperateKitchen`** (owner, manager,
  kitchen).
- `src/app/api/admin/orders/[id]/status/route.ts`: la capacidad de Cocina se aplica **en el servidor**
  (`assertKitchenStatusTransition`) además de la puerta existente.

**UI (Cocina propia; Órdenes sin el modo Cocina)**

- `src/app/(admin)/admin/kitchen/**` (**nuevo**): `page.tsx` + su test, y los componentes del tablero
  **movidos** desde `orders/` (`order-comanda-board.tsx`, `order-comanda-card.tsx`, `kitchen-toolbar.tsx`,
  `use-comanda-view.ts`, `kitchen-mode.ts`, `kitchen-tabs.ts` con sus tests) + el fetch de la proyección.
- `src/app/(admin)/admin/orders/**`: **sólo** lo necesario para sacar el modo/tablero de Cocina
  (`page.tsx`, `orders-toolbar.tsx`, `orders-board-view.ts`, `orders-page-helpers.ts` y los tests que lo
  fijan) y para que el carril corregido venga del dominio compartido.
- `src/app/(admin)/admin/admin-layout-helpers.ts`: la entrada **Cocina** en Operación, con su puerta.
- `src/app/globals.css`: sólo si hace falta ajustar la clase del modo inmersivo que se conserva.
- `src/shared/contracts/test-integrity-baseline.json` y `design-tokens.allow.json` **sólo si un techo baja**
  (nunca sube).

**Documentación**

- `ops/CURRENT.md` (estado), `ops/design/screens/kitchen.md` (las dos divergencias del § *Design Freeze*),
  `ops/tasks/START-HERE.md`, `ops/roadmap/NEXT.md` (deja Cocina cerrada y apunta la próxima), y este brief.

## SCOPE OUT

- **Dinero, en cualquier forma**: `Payment`, `payments`, `money`/`money-conversion`, el saldo
  `pending`/`partial`/`paid`, `paidAmount`/`outstandingAmount`, la propina, el PIN financiero, el cobro de un
  pedido existente (`POST /api/admin/orders/[id]/payment`, que se **compone**, no se reconstruye).
- **`Invoice` / facturas**: ni el documento, ni `canEmitInvoiceFor`, ni la impresión, ni su puerta.
- **Caja** (`cash`, turnos, arqueo, devoluciones) y **`Orders runtime 5b`** (el rediseño del listado y del
  detalle: paginación, KPIs, `OrderListProjection`, `OrderDetailProjection`).
- **`modules/kitchen`**, un segundo workflow, un segundo cálculo de totales, un segundo sistema de scheduling,
  un segundo scope de sucursal o una segunda lógica de polling/sonido/frescura.
- **`order-workflows.ts`** (la máquina de estados **no se toca**: ya tiene las tres transiciones),
  `calculateOrderTotals`, `order-search.ts`, `order-visibility.ts`, los umbrales del local y el alcance por
  sucursal.
- **El recorte financiero del detalle** (`api/admin/orders/[id]/route.ts` + `getOrder`): pertenece a
  **Pedidos runtime (5b)**. Acá Cocina **no llega** a un detalle con dinero porque `/admin/kitchen` no
  enlaza a ninguno; `A-60` **no se declara cerrado** por esta TASK (queda con su remanente anotado).
- **Reactivar** estados de delivery/mesa, `BusinessSettings.pickupLeadMinutes` como autoridad (manda el del
  local), ni el POS (más allá del campo `source`).

## DEPENDENCIAS

- **Owner**: autorizó `TASK-ORDERS-KITCHEN-RUNTIME-002` como orden **3b** con Delivery Mode
  `high-risk-e2e`; aprobó la spec y la referencia de Cocina el **2026-09-27**.
- **TASK previa**: `TASK-ORDERS-KITCHEN-FOUNDATIONS-001` (cerrada, `docs-only`, mergeada sin deploy).
- **Credencial**: `N/A — ninguna nueva`. El deploy usa el `EASYPANEL_TOKEN` **por entorno** que ya existe.
- **Migración**: **sí**, una, **aditiva** y nullable (ver § *MIGRACIÓN*).

## ARCHIVOS PROBABLES

| Archivo | Quién más lo consume |
|---|---|
| `src/modules/orders/domain/order-lanes.ts` | `/admin/kitchen`, `/admin/orders`; reemplaza el mapa de `comanda-helpers.ts` |
| `src/modules/orders/domain/order-stage-times.ts` | `list-admin-orders.ts`, `list-kitchen-orders`, el adaptador de Prisma y el de memoria |
| `src/modules/orders/domain/order-scheduling.ts` | sólo Cocina (y, a futuro, Pedidos) |
| `prisma/schema.prisma` + migración | `prisma-order-repository.ts`, `in-memory-order-repository.ts`, seed |
| `src/app/api/admin/kitchen/orders/route.ts` | Cocina (única consumidora) |
| `src/modules/orders/features/list-kitchen-orders/**` | esa ruta |
| `src/modules/auth/domain/admin-permissions.ts` | `admin-layout-helpers.ts`, las rutas de Cocina y de órdenes |
| `src/app/(admin)/admin/kitchen/**` | nada más: superficie nueva |
| `src/app/(admin)/admin/orders/**` | los E2E `admin-comandas.spec.ts`, `admin.spec.ts` y `page.test.tsx` |
| `src/app/(admin)/admin/admin-layout-helpers.ts` | `admin-shell.tsx`, `admin-mobile-nav.tsx` y sus tests |

---

## TEST ROJO

Se escribe **primero** y se observa el rojo por la razón correcta (no por un import roto). Los cinco rojos
que abren la TASK:

1. `src/modules/orders/domain/order-lanes.test.ts` (nuevo) — `resolveOrderLane("confirmed")` es `"entry"`.
   **Rojo esperado hoy**: el mapa vive en la app y devuelve `preparing` (`comanda-helpers.ts:42`).
2. `src/modules/orders/domain/order-stage-times.test.ts` (adaptado) — `averagePrepMinutes` **ignora** un
   pedido sin `preparingAt` y mide `preparingAt → readyAt`. **Rojo esperado hoy**: mide desde `createdAt`
   (`order-stage-times.ts:78`), así que un pedido sin `preparingAt` **entra** al promedio.
3. `src/modules/auth/domain/admin-permissions.test.ts` (adaptado) — `canOperateKitchen(cashier)` es `false` y
   `canOperateKitchen(kitchen)` es `true`. **Rojo esperado hoy**: la función no existe.
4. `src/app/api/admin/kitchen/orders/route.test.ts` (nuevo) — sin `canOperateKitchen` responde **403**; con
   permiso, el cuerpo **no tiene ninguna clave financiera**. **Rojo esperado hoy**: la ruta no existe (404).
5. `src/modules/orders/features/create-order/create-order.test.ts` (adaptado) — `createOrder` persiste
   `source: "menu"` cuando llega y `null` cuando no. **Rojo esperado hoy**: el dato se descarta (no existe el
   campo).

## ESTRATEGIA

TDD por capas y de adentro hacia afuera: **dominio puro** (carriles, sellos, scheduling, transiciones) →
**puertos y adaptadores** (los dos dicen lo mismo) → **caso de uso** (la proyección sin dinero) → **ruta
(la puerta)** → **UI (la referencia traducida)**. El mapa estado→carril se **mueve**, no se copia: la copia
que queda en la app pasa a importar del dominio, y el techo de deuda `A-64` **baja** en el mismo commit. La
UI se arma **reutilizando** los componentes del tablero que ya existen (se mueven de carpeta), no
reescribiéndolos.

## DDD

Cambian **las cuatro capas**, con una sola dueña (`orders`):

- **domain** (puro, sin Next/Prisma/HTTP): `order-lanes.ts`, `order-stage-times.ts`, `order-scheduling.ts`,
  `order-kitchen-transitions.ts`, `order.types.ts`.
- **ports**: `order-repository.ts` (`source`, `listKitchenOrders`, sellos de la cola).
- **adapters**: `prisma-order-repository.ts`, `in-memory-order-repository.ts`.
- **features**: `list-kitchen-orders` (nuevo); `create-order` (acepta `source`).
- **route**: `api/admin/kitchen/orders/route.ts` (nueva), `api/admin/orders/route.ts` y
  `api/admin/orders/[id]/status/route.ts` (puerta/canal).
- **UI**: `src/app/(admin)/admin/kitchen/**` (nueva) y `orders/**` (la salida del modo Cocina).

El dominio **no** gana I/O: los umbrales y el `pickupLeadMinutes` entran **por parámetro** desde el caso de
uso, que es quien consulta `locations`.

## TRANSACCIÓN

`N/A — no hay escritura multi-paso nueva`. Las dos escrituras que esta TASK introduce son **una columna más
en un `INSERT` que ya existe** (`createOrder` → `insertOrder`, dentro de la transacción que ya tiene el POS) y
`N/A` en la lectura de Cocina, que es sólo lectura. La transición de estado ya es atómica
(`$transaction` de `order.update` + `orderStatusHistory.create`, `prisma-order-repository.ts:531-546`) y **no
se toca**.

## CONCURRENCIA

**No hay invariante nueva que proteger**, y se dice por qué: la TASK **no** agrega ninguna
lectura-y-después-escritura. Las transiciones de Cocina siguen validándose contra `order-workflows.ts` y
siguen siendo *last-write-wins* con historia append-only, exactamente como hoy. Lo que **sí** se endurece es
la **autorización** (una capacidad nueva en el servidor), no la carrera. El promedio y los sellos de la
proyección son **de sólo lectura**: dos requests simultáneos devuelven la misma foto o una más nueva, sin
escribir nada.

## IDEMPOTENCIA

`N/A — no hay operación reintentable nueva`. El alta del pedido sigue protegida por
`Order.idempotencyKey @unique` + `createOrder` (TASK-101) y el canal de origen viaja **dentro** de esa misma
escritura, así que un reintento devuelve el pedido ya creado **con el `source` de la primera vez** (no se
reescribe). La lectura de Cocina es un `GET`: repetirlo no cambia nada.

## AUTORIZACIÓN

Puertas de [`admin-permissions.ts`](../../src/modules/auth/domain/admin-permissions.ts), **aplicadas en el
servidor** (una UI nunca es frontera de autorización). Regla de esta TASK: se implementa la puerta **de la
superficie que crea** (Cocina), no las de Pedidos.

| Operación | Puerta | Owner | Manager | Kitchen | Cashier |
|---|---|---|---|---|---|
| Ver la cola de Cocina y **operar la comanda** | **`canOperateKitchen` (nueva)** | ✓ | ✓ | ✓ | ✗ |
| Ver/localizar pedidos (`/admin/orders`) | `canManageOrderOperations` (existente, **no se toca**) | ✓ | ✓ | ✓ | ✗ |
| Transición de estado aplicada por la superficie de Cocina | `assertKitchenStatusTransition` (dominio) **+** `canOperateKitchen` | ✓ | ✓ | ✓ | ✗ |
| Cobrar / emitir factura / ver financieros | `canUsePOS` y compañía (**no se tocan**) | ✓ | ✓ | ✗ | ✓ |

**Pruebas negativas obligatorias** ([`security-change`](../../.agents/skills/security-change/SKILL.md)):
1. **401** sin sesión en `GET /api/admin/kitchen/orders`.
2. **403** con sesión de `cashier` (no opera Cocina) — el rol que hoy **sí** pasaría una puerta gruesa.
3. El cuerpo de la respuesta **no contiene** ninguna clave financiera: se afirma sobre las **claves reales**
   del payload (`total`, `subtotal`, `tipAmount`, `paidWithAmount`, `pickupPin`, `orderLookupTokenHash`,
   `discount`, `packagingAmount`, `deliveryFeeAmount`, `payments`), no sobre la ausencia de un string.
4. **403** para el `kitchen` que intente una transición que **no** es de Cocina (`ready_for_pickup →
   picked_up`) desde la ruta de estado.
5. Alcance por sucursal: un pedido de otra sucursal **no** aparece en la cola (reusa `order-visibility`).

## MIGRACIÓN

**Una** migración **aditiva** y **sin BOM**
([`database-migration`](../../.agents/skills/database-migration/SKILL.md)):

```prisma
enum OrderSource {
  menu
  pos
}

model Order {
  /// Canal de origen del pedido. `null` = **no declarado**: los pedidos que existieron antes de la
  /// columna no se reconstruyen con heurísticas (ley 7: el pasado no se reescribe).
  source OrderSource?
}
```

- **Upgrade**: `ALTER TYPE`/`CREATE TYPE` + `ADD COLUMN` nullable. **Sin `NOT NULL`, sin default y sin
  backfill**: no hay forma de saber de dónde vino un pedido viejo, y adivinarlo está prohibido.
- **Compatibilidad**: la columna es opcional en el modelo, así que la app vieja y la nueva conviven durante
  el deploy (la vieja simplemente no la escribe).
- **Índices**: **ninguno**. El canal no se filtra ni se ordena en esta TASK (la cola de Cocina no filtra por
  origen): un índice sería deuda sin consulta.
- **Rollback operativo**: la columna se puede dejar en su lugar (nullable, nadie la lee si la app se
  revierte) o `DROP COLUMN`; **no** se pierde ningún dato de negocio, porque sólo contiene el canal que la
  app nueva escribió. **No hay down-migration**: se revierte con `revert` del commit y, si hace falta, un
  `DROP COLUMN` manual (fix-forward).
- **Riesgo**: **bajo** — aditiva, nullable, sin backfill y sin lectura en el camino crítico del cobro.
  **Backup**: **no requiere** backup manual ([`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md) §4:
  migración aditiva segura), y así se declara en el release.

## OBSERVABILIDAD

- **`OrderStatusHistory`** sigue siendo el registro de qué pasó: cada transición de Cocina escribe su fila con
  `changedByUserId` (`prisma-order-repository.ts:536-545`), así que «quién aceptó esto» queda respondido
  aunque la cuenta de cocina sea compartida. La TASK **no** lo muestra (`A-09` sigue abierto: el actor no se
  dibuja en ninguna vista; mostrarlo es de Pedidos).
- **`Order.source`** es el rastro del canal: se escribe en el alta y **nunca** se reescribe, así que explica
  el pasado sin reconstruirlo.
- **Outbox**: `updateOrderStatus` sigue publicando `OrderStatusChanged` (`update-order-status.ts:94`) sin
  cambios: no se agrega ni se quita ningún evento.
- **Log**: no se agrega logging nuevo. Si el log puede faltar, el historial de estados **no**: es la fuente.

---

## TESTS UNITARIOS

Con rojo observado y por capa.

- `domain/order-lanes.test.ts` — carriles canónicos: `new`/`confirmed`/`accepted` → ENTRADA;
  `preparing` → PREPARANDO; `ready`/`ready_for_pickup` → LISTOS; `closed`/`picked_up`/`cancelled` → fuera del
  tablero; contadores; el grupo interno *Programados*.
- `domain/order-stage-times.test.ts` — sellos por etapa desde un historial desordenado; preparación
  `preparingAt → readyAt`; un pedido **sin** `preparingAt` **no** entra al promedio; la preparación más larga;
  el techo de 4 h sigue descartando un pedido colgado.
- `domain/order-scheduling.test.ts` — inicio recomendado = `pickupTime − pickupLeadMinutes`; sin hora
  prometida devuelve `null` (nunca una hora inventada); programado de otro día vs. de hoy; un
  `pickupLeadMinutes` inservible cae al valor por defecto de forma explícita.
- `domain/order-kitchen-transitions.test.ts` — sólo las tres transiciones de Cocina (más `cancelled` con
  motivo); `ready_for_pickup → picked_up` **no** es de Cocina.
- `domain/admin-permissions.test.ts` — `canOperateKitchen` por rol (tabla completa).
- `features/list-kitchen-orders/list-kitchen-orders.test.ts` — el tipo de salida no tiene campos financieros
  (se afirma sobre las claves del objeto real); umbrales por local; `source` viaja tal cual; `null` no se
  convierte en etiqueta.
- `features/create-order/create-order.test.ts` — `source` se persiste; sin `source` queda `null`; el
  reintento idempotente devuelve el `source` original.
- `app/api/admin/kitchen/orders/route.test.ts` — 401 / 403 / 200, alcance, y ausencia de claves financieras.
- `app/api/orders/route.test.ts` (adaptado) — el alta del menú manda `source: "menu"`.
- `pos/.../commit-sale.test.ts` (adaptado) — la venta del mostrador manda `source: "pos"`.
- UI: `kitchen/page.test.tsx` y los componentes movidos, con sus tests adaptados (incluido el carril
  corregido de `confirmed`).

## TESTS DE INTEGRACIÓN

- **PostgreSQL real** (`npm run test:postgres`): dos altas con la misma `idempotencyKey` —una del menú y una
  del POS— no crean dos pedidos y la segunda **no** reescribe el `source` de la primera. Es la propiedad que
  depende de la base (unique + reuso del alta) y por eso **no** se prueba con un doble en memoria.
- El contrato de migración (`migrations`) del CI: base limpia + `migrate deploy` + **drift** contra
  `schema.prisma` con la columna nueva.

## E2E

`tests/e2e/admin-comandas.spec.ts` se **reescribe** hacia la superficie nueva, con mutaciones habilitadas
(`E2E_ALLOW_MUTATIONS=true`, nunca en producción):

1. **Cocina: el pedido entra y avanza.** Se crea un pedido real desde el menú → se abre `/admin/kitchen` →
   la comanda aparece en **ENTRADA** con la etiqueta `MENÚ`; `ACEPTAR` la deja **en ENTRADA** (ya no salta a
   PREPARANDO, que es el defecto que esta TASK corrige); `INICIAR PREPARACIÓN` la mueve a PREPARANDO;
   `TERMINADO` la deja en **LISTOS** con «Preparación N min»; **LISTOS no tiene acción**.
2. **El canal del POS.** Una venta del mostrador aparece en `/admin/kitchen` con la etiqueta `POS` y
   `Retiro: lo antes posible`.
3. **Sin dinero.** En `/admin/kitchen`, ningún texto de la pantalla es un importe: se afirma que no hay
   moneda (`C$`/`NIO`/`US$`) en el DOM de Cocina.
4. **El viewport contract** en los cuatro tamaños (1366×768, 1280×720, 768×1024, 375×812): la página **no**
   scrollea, el scroll vive en el carril, el conmutador aparece en tablet/móvil y la primera tarjeta con su
   acción entra a 375 px.
5. **`/admin/orders` ya no tiene modo Cocina**: el botón «Modo cocina» no existe ahí y la entrada del panel
   lleva a `/admin/kitchen`.

## MUTATION CHECK

Después del GREEN, se reintroduce **cada** condición defectuosa y el test tiene que **fallar**; después se
restaura y **la mutación no se commitea**:

| Mutación | Test que debe fallar |
|---|---|
| `confirmed` vuelve al carril de preparación en `order-lanes.ts` | `order-lanes.test.ts` + el E2E 1 |
| `averagePrepMinutes` vuelve a medir desde `createdAt` | `order-stage-times.test.ts` |
| La proyección de Cocina agrega `total` al payload | `list-kitchen-orders.test.ts` + `route.test.ts` (claves) |
| La ruta de Cocina vuelve a `canManageOrderOperations` (acepta `cashier`) | `route.test.ts` (403) |
| `assertKitchenStatusTransition` acepta `picked_up` | `order-kitchen-transitions.test.ts` + `route.test.ts` |
| Se escribe `source: "menu"` en la puerta del POS | E2E 2 + `commit-sale.test.ts` |
| El inicio recomendado se calcula en React y no en el dominio | `order-scheduling.test.ts` |

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

Más, por lo que esta TASK toca:

- **`npm run build:webpack`** — se toca `src/app/**/page.tsx` (Cocina nueva y Órdenes modificada): Turbopack
  no valida los exports de una página.
- **`npx prisma generate`** — se toca `prisma/schema.prisma`.
- **`npm run test:postgres`** — la idempotencia del alta con PostgreSQL real.
- **E2E locales** con Postgres arriba y tasa alta, **una sola suite a la vez**:
  `BASE_URL=http://127.0.0.1:3210 E2E_ALLOW_MUTATIONS=true npm run test:e2e:prod:full`.
- **Navegador real** en los cuatro viewports del Viewport Contract, con captura antes/después.

## CRITERIOS DE ACEPTACIÓN

- [ ] `/admin/kitchen` existe como superficie propia con la **composición de la referencia** (tres carriles,
      cabecera de una línea, toolbar de una línea) y `confirmed` se dibuja en **ENTRADA**.
- [ ] Cocina opera **sólo** `new → confirmed → preparing → ready_for_pickup` (+ `cancelled` con motivo) y
      **termina en Listo**: las tarjetas de LISTOS no tienen acción.
- [ ] La preparación se deriva de `OrderStatusHistory` (`preparingAt → readyAt`); un pedido sin `preparingAt`
      no entra al promedio; «Más larga» sale del mismo cálculo.
- [ ] Los programados usan `pickupTime` + `pickupScheduled` + `Location.pickupLeadMinutes` con **inicio
      recomendado** derivado en el dominio; un pedido sin hora dice «Retiro: lo antes posible».
- [ ] `Order.source` existe, se escribe **explícitamente** en las dos puertas (menú y POS) y es `null` en el
      pasado; **no existe** ninguna heurística ni backfill.
- [ ] `KitchenOrderProjection` **no tiene un solo campo financiero** y la API de Cocina no los devuelve
      (probado sobre las claves reales del payload).
- [ ] `canOperateKitchen` existe, se aplica **en el servidor** en la ruta de Cocina y en la de estado, con
      **401/403** y pruebas negativas.
- [ ] `/admin/orders` **ya no** tiene el modo ni el tablero de Cocina, y **no** perdió nada suyo del alcance
      pedido (listado, filtros, acciones del mostrador).
- [ ] `A-64` **baja**: el mapa estado→carril vive **una** vez, en `orders/domain`, y las superficies lo
      consumen; la copia de la app importa del dominio.
- [ ] **Ningún techo de deuda subió** (`route-contract`, `module-contract`, `tdd-contract`,
      `test-integrity`, `design-guardrails`); los que bajaron, bajaron en el mismo commit.
- [ ] CI verde (los cuatro checks), PR con problema/alcance/evidencia/fuera-de-scope, merge `--squash`.
- [ ] Migración aplicada en el deploy, health/readiness, los dos smokes y **QA de producción** en los cuatro
      viewports.

## REGRESIÓN

- `order-lanes.test.ts` falla si `confirmed` vuelve a preparación.
- `order-stage-times.test.ts` falla si el promedio vuelve a `createdAt`.
- `list-kitchen-orders.test.ts` y `route.test.ts` fallan si un campo financiero vuelve a la proyección.
- `route.test.ts` (Cocina) falla si la puerta vuelve a la gruesa (entra `cashier`).
- `order-kitchen-transitions.test.ts` falla si Cocina puede retirar o cerrar.
- `commit-sale.test.ts` falla si el POS deja de declarar su canal (o lo declara como menú).
- Los contratos de gobernanza fallan si el mapa de carriles se vuelve a duplicar (`A-64`) o si un techo sube.

## ROLLBACK

- **App**: `revert` del commit del merge en `main` + una llamada a `deployService` (`forceRebuild: true`).
  `/admin/kitchen` desaparece y `/admin/orders` vuelve a su forma anterior; **ninguna** superficie de dinero
  cambia.
- **Base**: **fix-forward**. `Order.source` es nullable y **sin lectores en el camino crítico**, así que
  puede quedarse: la app vieja la ignora. Si se quiere limpiar, `DROP COLUMN`/`DROP TYPE` manual
  (no hay down-migrations). **No se pierde** ningún dato de negocio: sólo el canal que la app nueva escribió.
- **Backup**: **no** requiere backup manual (migración aditiva segura, `delivery-e2e` §4).

## DOCUMENTACIÓN

- `ops/design/screens/kitchen.md` — las dos divergencias resueltas a favor de la referencia (§ *Design
  Freeze*), con su motivo.
- `ops/product/MODULE_ARCHITECTURE.md` — **sólo** si hace falta registrar que el mapa de carriles vive en
  `orders/domain` (sin repetir leyes).
- `ops/CURRENT.md` — qué quedó desplegado, qué se cerró (`A-64` baja; `A-60` sigue abierto con su remanente)
  y qué falta. `ops/tasks/START-HERE.md` y `ops/roadmap/NEXT.md` — la secuencia.
- `ops/audit-backlog.md` — **no** se cierran hallazgos que esta TASK no haya cerrado: `A-60` se anota con su
  remanente (el detalle compartido, que es de Pedidos 5b).
- Este brief, con el resultado real de la implementación.

## MEMORY

`Sí — una lección reutilizable`: **una regla que se escribe desde la superficie que la necesita termina
escrita tantas veces como superficies haya, y con respuestas distintas.** El caso medido: el mapa
estado→carril vivió cinco veces (`A-64`) y `confirmed` cayó «en preparación» en dos de ellas porque la copia
que se tocó último decidió distinto. La regla se **mueve al dueño** (`orders/domain`) y las superficies la
consumen. Va a [`.agents/MEMORY.md`](../../.agents/MEMORY.md) con el puntero a `A-64`.

## DEFINITION OF DONE

- [ ] Tests verdes (unitarios + PostgreSQL real + contratos + E2E), con el **rojo observado** de los cinco
      tests de la § *TEST ROJO* y la **mutación** verificada.
- [ ] `security:secrets`, `lint`, `typecheck`, `test`, `test:contracts`, `build`, `build:webpack` y
      `prisma generate` verdes.
- [ ] Verificación en **navegador real** en los cuatro viewports del Viewport Contract, con captura
      antes/después.
- [ ] Ningún techo de deuda subió (y los que bajaron, bajaron acá).
- [ ] `CURRENT.md`, `START-HERE.md`, `NEXT.md`, la spec y `MEMORY.md` actualizados; `A-60`/`A-64` anotados
      con su estado real.
- [ ] Commit + push a la rama, **PR abierto**, **CI verde** (los cuatro checks), merge `--squash`.
- [ ] **Deploy** desde `main` (una sola llamada a `deployService`), migración aplicada, health/readiness,
      los dos smokes y **QA de producción** con sesión en los cuatro viewports.
- [ ] Auditoría independiente (implementación real vs SPEC/reference) con evidencia.
