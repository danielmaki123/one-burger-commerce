# TASK-ORDERS-RUNTIME-5B — Pedidos runtime: el read model administrativo canónico

> **Estado**: aprobada por el owner (2026-10-01). **Delivery Mode**: `high-risk-e2e`.
> **Brief pedido por el owner** en la sesión del 2026-10-01; el repo manda sobre cualquier premisa vieja
> de los documentos, y este archivo se corrigió con lo que la **auditoría real** encontró (§ *Auditoría real*).

## TASK ID

`TASK-ORDERS-RUNTIME-5B` — orden **5b** del [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md) §2.

## Título

Reemplazar `/admin/orders` por el read model administrativo canónico: listado paginado con KPI y detalle
completo, con la autorización y el recorte financiero aplicados en el servidor.

## Prioridad

`P2` (función rota + fuga de datos a un rol) con deuda `P3` asignada (`A-09`, `A-62`, `A-63`, `A-64`, `A-66`).

## Clase de riesgo

**`auth/datos`** (autorización en el servidor y recorte de datos financieros) + **`UI`**. No toca esquema,
no toca dinero: **no** cambia ninguna regla de `money` ni de `payments`, sólo las **consume**.

## DELIVERY MODE

- [ ] `docs-only`
- [ ] `runtime-e2e`
- [x] **`high-risk-e2e`** — toca autorización (puertas nuevas, recorte en servidor) y la
      proyección de datos financieros. Gates de [`security-change`](../../.agents/skills/security-change/SKILL.md);
      **sin** migración y **sin** escritura de dinero, así que `money-change` no aplica como clase.

## STOP CONDITIONS específicas de esta TASK

1. **Desviación material** contra `ops/design/screens/orders-desktop-reference.html` (Design Freeze del
   2026-09-27): se modifica primero la spec y la decide el owner.
2. Cualquier necesidad de **cambiar una regla de `payments`/`money`** (por ejemplo, convertir
   `unresolvedAmount` con una tasa): fuera de alcance por definición — si aparece, se para.

---

## PROBLEMA

`/admin/orders` es el **tablero viejo de comandas**: carriles, botón de aviso sonoro, tablero de cocina y
un listado que trae **todo** de **todos** los pedidos del rango. Cuatro defectos concretos, todos medidos
en el código:

1. **No es un read model.** `listOrders` de Prisma trae `items` + `modifiers` + `statusHistory` completo de
   **cada** fila y **no** pagina (`prisma-order-repository.ts:521-536`); la respuesta incluye
   `orderLookupTokenHash` y GPS porque serializa el `OrderRecord` entero (`A-61`).
2. **La autorización no coincide con el producto.** La entrada de navegación se ofrece a **todos**
   (`admin-layout-helpers.ts:100`) y la API le responde **403** al `cashier`
   (`api/admin/orders/route.ts:59`), que sí necesita localizar el pedido que va a cobrar; el `kitchen`
   entra a Órdenes por URL y el detalle le muestra **montos, PIN, cobros y factura** (`A-60`, `A-66`).
3. **La home por rol no existe.** `/admin` redirige a `/admin/orders` (`admin/page.tsx:12`), el shell
   calcula su `homeHref` con un `role === "owner"` a mano (`admin-shell.tsx:120`) y el login vuelve a
   `/admin`: **tres** implementaciones de la misma decisión, y ninguna manda a Cocina a `/admin/kitchen`
   (`A-10`).
4. **El detalle no cuenta lo que pasó.** No muestra el historial real ni **quién** movió el pedido
   (`A-09`), formatea las fechas con la zona del **navegador** (`A-63`), y conserva un `ORDER_JOURNEY`
   propio que **no** es el recorrido real del pedido (`A-64`).

## AUDITORÍA REAL (lo que el repo ya tiene y los documentos daban por faltante)

Revalidado contra `main` = `4d33a0e` (2026-10-01). **El repo manda**: las premisas viejas de `orders.md`
(«`Order.source` FALTA», «el estado financiero FALTA», «`canViewOrderFinancials` falta») **ya no son
ciertas** y se corrigieron en el mismo commit de esta TASK.

| Documento decía | El repo dice |
|---|---|
| `Order.source` «FALTA» | **Existe**: `OrderSource` en `order.types.ts:12`, columna `Order.source` (`schema.prisma:696`), escrita por las dos puertas (`D-015`) |
| Estado financiero «FALTA» | **Existe**: `payments` con `projectOrderPaymentStatus` (`payments/domain/order-financial-status.ts`) y `paidAmount` / `outstandingAmount` / `unresolvedAmount` |
| `canViewOrderFinancials` «falta» | **Existe** en `admin-permissions.ts:126` — pero **sin un solo consumidor en producción** (sólo tests) |
| Sellos por etapa «FALTA» | **Existen**: `resolveOrderStageTimes` (`orders/domain/order-stage-times.ts:92`) |
| «Cinco mapas estado→etapa» | Quedan **tres** en `orders` (`ORDER_JOURNEY` en el detalle, `comandaLane`, `getAdminOrderSolidStatus`) — `A-64` sigue vivo pero es **remanente** |

## REUSE AUDIT

```md
Objetivo:                 localizar un pedido (del turno o viejo) y revisarlo con su historia, sus items y
                          su estado de cobro, sin depender de la memoria del turno.
Capacidad existente:      listAdminOrders + readAdminOrders + sanitizeOrderQuery (listado y saneamiento);
                          order-search.ts (búsqueda); order-visibility.ts / order-scope.ts (alcance por
                          sucursal); getOrder + GET /api/admin/orders/[id] (detalle); order-totals.ts
                          (montos); order-workflows.ts (transiciones); order-stage-times.ts (sellos);
                          list-kitchen-orders + KitchenOrderProjection (Cocina, ya separada);
                          payments/features/get-order-payment-status + order-financial-status (estado
                          financiero); money/format-money detrás de format-currency; invoices (documento);
                          getOrderStatusHistory (historial con actor); AdminStatusSolid / AdminEmptyState /
                          AdminPickupTimingChip (UI del panel); register-order-payment (cobro, orden 6).
Qué se reutiliza:         TODO lo anterior tal como está. El listado **consume** el estado financiero de
                          `payments` (no lo recalcula), el alcance de `order-visibility`, la búsqueda de
                          `order-search`, los sellos de `order-stage-times`, los montos de `order-totals`,
                          el historial real de `getOrderStatusHistory` y el formato de `money`.
Qué es realmente nuevo:   1. la puerta nominal `canViewOrders`;
                          2. `OrderListProjection` (mínima, paginada, con `financialState` y `kpi` del
                             filtro completo) y el puerto de lectura que la sirve;
                          3. `OrderDetailProjection` (la composición del detalle, con historial + actor +
                             sellos + permiso financiero aplicado en el servidor);
                          4. el **resolutor único de landing por rol** (`resolveAdminLanding`);
                          5. la composición de la **pantalla** (listado denso paginado y detalle en dos
                             columnas), que es UI, no regla.
                          No se crea ningún dominio nuevo y ningún cálculo nuevo de dinero.
```

## SPEC / REFERENCE / DESIGN FREEZE

- **SPEC aprobada**: [`ops/design/screens/orders.md`](../design/screens/orders.md) (corregida en este
  commit: se retiran las premisas obsoletas de `Order.source`, estado financiero y `canViewOrderFinancials`).
- **`reference.html`**: **Sí** —
  [`orders-desktop-reference.html`](../design/screens/orders-desktop-reference.html), aprobada por el owner
  el **2026-09-27**. Es **contrato** de composición, jerarquía, densidad y responsive (Reference Fidelity).
- **Design Freeze**: quedan congeladas la composición, la información y el comportamiento principal del
  **listado** (cabecera compacta con 4 KPI, una fila de filtros, encabezado de tabla fijo, filas de ≈84 px)
  y del **detalle** (dos columnas: pedido/cliente/retiro/historial a la izquierda; pago/operación/documentos
  a la derecha). Una desviación **material** la decide el owner.
- **Viewport Contract**: `1366×768` · `1280×720` · `768×1024` · `375×812`. En escritorio el listado usa el
  alto útil y scrollea **el listado**, no la página; sin scroll horizontal en ninguno.
- **Cierre**: auditoría independiente que compara la implementación real contra la spec y la referencia,
  con capturas en los cuatro viewports.

## EVIDENCIA

- `src/modules/orders/adapters/prisma-order-repository.ts:521-536` — `listOrders` trae `items` +
  `modifiers` + `statusHistory` completo, sin `take`/`skip`.
- `src/app/api/admin/orders/route.ts:59` — la API pide `canManageOrderOperations` (cocina incluida) y le
  responde 403 al `cashier`.
- `src/app/(admin)/admin/admin-layout-helpers.ts:100` — la entrada «Órdenes» se ofrece a todos los roles
  (`canSee: everyRole`).
- `src/app/(admin)/admin/orders/[id]/page.tsx:412,306` — `toLocaleTimeString()` / `toLocaleString()` sin
  zona (zona del navegador).
- `src/app/api/admin/orders/[id]/invoice/route.ts:18` — el `GET` sólo exige sesión; el `POST` agrega
  `canUsePOS` en `invoice-composition.ts:39` y **ninguno** aplica el alcance por sucursal (`A-70`).
- `src/app/(admin)/admin/orders/[id]/invoice/print/page.tsx:29` — la hoja se abre con
  `canManageOrderOperations`, que **incluye cocina**.
- Backlog: `A-09`, `A-10`, `A-60`, `A-61`, `A-62`, `A-63`, `A-64` (remanente), `A-66`, `A-70`.

## CAUSA RAÍZ

**El read model nunca existió.** `/admin/orders` creció como tablero de comandas y para dibujar una comanda
completa necesita el pedido **entero**; cuando la pantalla pasó a ser una bandeja, la consulta no cambió, y
como el alcance se resolvía en React (mostrar u ocultar entradas), la autorización quedó a cargo de la UI.
La misma causa explica las tres copias de «dónde aterriza cada rol»: no hay **una** función que lo decida, así
que cada superficie lo resolvió con su propio `if`.

## INVARIANTE

1. `kpi` y `meta.total` describen **el filtro completo**, nunca la página: cambiar de página no puede
   cambiar un KPI.
2. Ningún rol sin `canViewOrderFinancials` recibe, por **ninguna** ruta (`listado`, `detalle`, `invoice`,
   `print`), un campo financiero, el `pickupPin` ni los cobros.
3. `unresolvedAmount` **nunca** se convierte con una tasa vigente.
4. Todo pedido que un rol puede leer está dentro de su alcance por sucursal.
5. `resolveAdminLanding(role)` es la **única** respuesta a «dónde aterriza este rol».

## BOUNDED CONTEXT

`orders` (dueño del read model y del ciclo de vida) + `auth` (la puerta nueva y el resolutor de landing).
**Consume** `payments`, `money`, `invoices`, `locations`, `business-settings`. No crea módulos.

---

## SCOPE IN

| Archivo | Qué cambia |
|---|---|
| `src/modules/auth/domain/admin-permissions.ts` | **Nuevo** `canViewOrders` (owner · manager · cashier; `kitchen` no) |
| `src/modules/auth/domain/admin-landing.ts` | **Nuevo** `resolveAdminLanding(role)` — el resolutor único |
| `src/modules/orders/domain/admin-order-filters.ts` | **Nuevo** rangos de fecha (Hoy/Ayer/7d/30d) y el filtro por estado de pago |
| `src/modules/orders/domain/order-stage.ts` | **Nuevo consolidado**: un solo mapa estado→etapa y un solo formateador «hace cuánto» (`A-64`) |
| `src/modules/orders/features/list-admin-orders/order-list-projection.ts` | **Nuevo** tipo mínimo + `financialState` + `kpi` |
| `src/modules/orders/features/list-admin-orders/list-admin-orders.ts` | Pasa a devolver `OrderListProjection` + `meta` + `kpi` (pagina y agrega en el servidor) |
| `src/modules/orders/ports/order-repository.ts` | **Nuevo** `listAdminOrderRows(filter)` (fila mínima + cobros) |
| `src/modules/orders/adapters/{prisma,in-memory}-order-repository.ts` | Implementan el puerto nuevo |
| `src/modules/orders/features/get-order/order-detail-projection.ts` | **Nuevo** `OrderDetailProjection` con recorte por capacidad |
| `src/modules/orders/features/get-order/get-order.ts` | Devuelve historial + sellos; el recorte financiero lo aplica la proyección |
| `src/app/api/admin/orders/route.ts` | Baja a ≤50 líneas: `canViewOrders`, zod de los 7 filtros, paginación y KPI |
| `src/app/api/admin/orders/order-list-query.ts` | **Nuevo**: el zod y la composición de filtros (el route sólo orquesta) |
| `src/app/api/admin/orders/[id]/route.ts` | `canViewOrders` + `OrderDetailProjection` con la capacidad del rol |
| `src/app/api/admin/orders/[id]/invoice/{route,invoice-composition}.ts` | **`A-70`**: capacidad financiera + alcance por sucursal en `GET` y `POST` |
| `src/app/(admin)/admin/orders/[id]/invoice/print/page.tsx` | **`A-70`**: puerta financiera + alcance por sucursal |
| `src/app/(admin)/admin/orders/page.tsx` | Reescrita: listado denso paginado (el tablero de comandas se va) |
| `src/app/(admin)/admin/orders/[id]/page.tsx` | Reescrita como composición de paneles, con historial real |
| `src/app/(admin)/admin/orders/**` | Componentes nuevos del listado y del detalle |
| `src/app/(admin)/admin/admin-layout-helpers.ts` | La entrada «Órdenes» usa `canViewOrders` |
| `src/app/(admin)/admin/page.tsx`, `admin-shell.tsx`, `login/page.tsx` | Usan `resolveAdminLanding` |
| `src/shared/contracts/route-contract.test.ts` | Baja el techo de `api/admin/orders/route.ts` (queda ≤50) |
| `src/shared/contracts/ui-contract.test.ts`, `src/shared/config/design-tokens.allow.json`, `src/shared/ui/registry.json` | Techos de UI que **bajan** + registro de los componentes nuevos |
| `tests/e2e/admin-orders.spec.ts` | **Nuevo** E2E de Pedidos (listado, filtros, paginación, KPI, cocina, factura) |
| `tests/e2e/orders-visual-check.spec.ts` | **Nuevo** QA visual con capturas en los cuatro viewports |
| `tests/e2e/helpers.ts` | El aterrizaje del panel ahora depende del rol (`ADMIN_LANDING_PATTERN`) |
| `tests/e2e/admin-order-scope.spec.ts`, `admin-kitchen.spec.ts`, `admin-finance.spec.ts`, `admin-pos.spec.ts`, `admin.spec.ts` | Se actualizan al aterrizaje por rol y a que Cocina ya no vive en Órdenes |
| `ops/design/screens/orders.md`, `ops/CURRENT.md`, `ops/roadmap/{NEXT,EXECUTION-MAP}.md`, `ops/audit-backlog.md`, `ops/product/CAPABILITY-REUSE-MAP.md` | Cierre documental |
| `src/shared/ui/select.tsx` | `hideLabel`: el rótulo queda para el lector de pantalla (densidad del 20%) |

## SCOPE OUT

- **Cobrar** un pedido y el **handoff** Órdenes → POS: es el **orden 6** (`A-67`). No se toca
  `register-order-payment` ni el POS.
- **Nueva lógica de `payments` o de `money`**: se consumen tal como están. No se crea ninguna segunda
  fuente de «pagado» y no se convierte `unresolvedAmount`.
- **Cocina** (`/admin/kitchen`): no se toca salvo lo necesario para que su rol **no** aterrice en Órdenes.
- **Cash ownership** (orden 7), **refund/void**, **reforma fiscal de `Invoice`** (orden 9).
- **`A-12`** (filtro «solo sin aceptar»), que la spec pide y el owner ya había resuelto como innecesario.
- No se reabre `A-71`, `A-81`…`A-90` ni ningún hallazgo financiero cerrado.

## DEPENDENCIAS

Órdenes 4 y 5 (Money/Payments) **cerrados y desplegados**; Cocina runtime (`/admin/kitchen`) **desplegada**.
Sin migración, sin credencial nueva, sin decisión de producto pendiente.

## ARCHIVOS PROBABLES

Los de § *SCOPE IN*. Consumidores del radio de impacto: `tests/e2e/admin-order-scope.spec.ts`,
`tests/e2e/admin-kitchen.spec.ts`, `tests/e2e/admin-order-actions.spec.ts`,
`src/app/(admin)/admin/admin-ui-contract.test.ts`, `src/app/(admin)/admin/admin-layout-helpers.test.ts`,
`src/app/(admin)/admin/orders/page.test.tsx`, `src/app/(admin)/admin/orders/[id]/page.test.tsx`.

---

## TEST ROJO

1. `src/modules/auth/domain/admin-permissions.test.ts` — `canViewOrders`: **rojo** porque la función no
   existe (falla por import inexistente, que **no** es el rojo válido: el rojo de verdad se toma con la
   función creada y devolviendo el valor viejo/comodín).
2. `src/modules/auth/domain/admin-landing.test.ts` — `resolveAdminLanding("kitchen") === "/admin/kitchen"`
   y `"manager"/"cashier" → "/admin/orders"`: **rojo real**, porque hoy la decisión está repartida en tres
   archivos y Cocina aterriza en Órdenes.
3. `src/app/api/admin/orders/route.test.ts` — `kitchen` recibe **403** y `cashier` recibe **200**:
   **rojo real** contra el comportamiento actual (cocina 200, cajero 403).
4. `src/app/api/admin/orders/route.test.ts` — el listado **no** serializa `orderLookupTokenHash`, GPS,
   items, modificadores ni `statusHistory`: **rojo real** hoy.
5. `src/modules/orders/features/list-admin-orders/list-admin-orders.test.ts` — los cuatro KPI se calculan
   sobre el **filtro completo** y no cambian al cambiar de página: **rojo real** hoy (no hay `kpi`).
6. `src/modules/payments/**` no se toca: la prueba de que el estado financiero **no** se recalcula es un
   test de contrato que verifica que el listado importa `getOrderPaymentStatus` y no suma `Payment.amount`.
7. `src/app/api/admin/orders/[id]/route.test.ts` — con `kitchen` el detalle **no** trae `financialState`,
   `pickupPin`, `payments` ni factura: **rojo real** hoy (los trae).
8. `src/app/api/admin/orders/[id]/invoice/route.test.ts` — un rol de **otra sucursal** recibe **403**
   (hoy: 200).

## ESTRATEGIA

Un **read model de listado** (`OrderListProjection`) que se resuelve en **dos tiempos**: el repositorio
devuelve las filas **mínimas** del filtro con el resumen de sus cobros, y el caso de uso resuelve el estado
financiero con `payments`, aplica el filtro por estado de pago, calcula los cuatro KPI sobre el **conjunto
filtrado completo** y recién entonces recorta la página. El detalle se resuelve con una proyección que
**decide por capacidad**: sin `canViewOrderFinancials` los campos financieros no existen en la respuesta
(no se esconden en React). La pantalla es una traducción de la referencia aprobada a los primitivos del
sistema, con el scroll en el listado y sin scroll horizontal.

Por qué así y no con `skip`/`take` en SQL: el filtro «Pendientes = `pending` + `partial`» y los KPI se
derivan del **estado financiero**, que es una proyección de `payments` y **no** vive en `Order`. Empujar ese
filtro a SQL obligaría a reimplementar la regla de `D-020` en SQL, que es exactamente lo que la ley de
*Single Owner* prohíbe.

## DDD

- `domain` (puro): `admin-order-filters` (rangos y filtros), `order-stage` (mapa de etapa y formateador),
  `admin-landing` (la decisión de aterrizaje) y `admin-permissions` (la puerta).
- `features`: `list-admin-orders` (proyección + KPI + paginación) y `get-order` (detalle + recorte).
- `ports`: `OrderRepository.listAdminOrderRows`.
- `adapters`: Prisma y memoria.
- `route`: sólo zod, auth/authz, adaptador y caso de uso (≤50 líneas).
  Nada de I/O entra en `domain/`.

## TRANSACCIÓN

`N/A — toda la TASK es de lectura.` No hay escritura nueva: las acciones que la pantalla conserva
(retirar/cerrar/cancelar/emitir) siguen usando los casos de uso existentes con su propia transacción.

## CONCURRENCIA

`N/A — sin escrituras nuevas.` La única carrera relevante ya está cubierta donde corresponde: el cambio de
estado (`update-order-status`, 409 si otro movió el pedido) y la numeración de factura (`AUD-006`).

## IDEMPOTENCIA

`N/A — sin escrituras nuevas.` El listado y el detalle son GET.

## AUTORIZACIÓN

| Rol | Órdenes (listado + detalle) | Datos financieros | Cocina |
|---|---|---|---|
| `owner` | ✓ | ✓ | ✓ |
| `manager` | ✓ | ✓ | ✓ |
| `cashier` | ✓ | ✓ | ✗ |
| `kitchen` | **✗ (403)** | ✗ | ✓ (su superficie) |

- Puerta nueva: **`canViewOrders`** (owner · manager · cashier). Aplicada en el **servidor** por
  `GET /api/admin/orders`, `GET /api/admin/orders/[id]` y la composición de la factura (`A-70`).
- Puerta existente que **se empieza a consumir**: **`canViewOrderFinancials`** — el recorte del detalle.
- Alcance por sucursal: `resolveOrderLocationScope` + `assertOrderInScope`, también en la factura y en la
  hoja de impresión.
- **Prueba negativa obligatoria**: `kitchen` → 403 en la API, `/admin/kitchen` en la home, y el detalle sin
  un solo campo financiero.

## MIGRACIÓN

`N/A — sin cambios de esquema.` `Order.source`, `Order.currencyCode` y `OrderStatusHistory.changedByUserId`
ya existen.

## OBSERVABILIDAD

El historial real (`OrderStatusHistory`, con `changedByUserId`) es lo que la pantalla muestra: el detalle
pasa a leerlo. No se agrega ningún registro nuevo; el cambio de estado sigue firmando igual.

---

## TESTS UNITARIOS

- `admin-permissions.test.ts` — familia `canViewOrders`: exactamente owner · manager · cashier; `kitchen`
  afuera; y que **no** sea la misma función que `canOperateKitchen`.
- `admin-landing.test.ts` — los cuatro roles, con el literal de cada destino.
- `admin-order-filters.test.ts` — Hoy/Ayer/7 días/30 días con la zona del **negocio**; «Pendientes» incluye
  `pending` + `partial`; «Pagados» sólo `paid`; `unresolvedAmount > 0` ⇒ `partial`.
- `order-stage.test.ts` — un solo mapa: `cancelled` no tiene etapa, `confirmed` está en entrada (la
  divergencia que `A-64` documentaba); el formateador «hace cuánto» en sus tres tramos.
- `list-admin-orders.test.ts` — paginación (page/pageSize/total), KPI sobre el filtro completo, `kpi`
  estable al cambiar de página, filtro por estado de pago, orden por más recientes.
- `get-order.test.ts` / `order-detail-projection.test.ts` — con capacidad y sin capacidad; historial con
  actor; sellos; jamás un campo financiero sin capacidad.

## TESTS DE INTEGRACIÓN

`N/A — la TASK no crea ninguna propiedad que dependa de PostgreSQL` (no hay unique, lock, transacción ni
partial write nuevos). La query nueva se valida contra el **E2E local con PostgreSQL real** (la suite de
Playwright levanta la app contra la base) y con `next build`.

## E2E

**Nuevo**: `tests/e2e/admin-orders.spec.ts`.
- `cashier`: entra, **lista** y **abre** un pedido; no recibe acciones de Cocina.
- `kitchen`: `/admin/orders` → **redirige a `/admin/kitchen`**; la API responde **403**.
- Listado: pagina; los filtros sobreviven en la URL; el KPI **no** cambia al cambiar de página.
- Filtro «Pendientes» incluye `pending` + `partial` y deja `paid` fuera.
- **Visual**: los cuatro viewports, sin scroll horizontal, con el listado usando el alto útil.
- Factura directa: rol/scope incorrecto rechazado (**`A-70`**).

**Actualizado**: `tests/e2e/admin-order-scope.spec.ts` (la cocina ya no aterriza en Órdenes) y
`tests/e2e/admin-kitchen.spec.ts` si asume la entrada por Órdenes.

## MUTATION CHECK

1. Quitar `canViewOrders` del route ⇒ el test de `kitchen` 403 falla.
2. Devolver a `kitchen` a Órdenes en `resolveAdminLanding` ⇒ el test de landing y el E2E fallan.
3. Calcular los KPI sobre la página en vez del filtro ⇒ el test de «KPI estable al paginar» falla.
4. Recalcular el estado financiero fuera de `payments` (sumar `Payment.amount` en el caso de uso) ⇒ el test
   de contrato del single owner falla.
5. Eliminar el `assertOrderInScope` del detalle ⇒ el test de alcance falla.
6. Volver a formatear la fecha con la zona del navegador ⇒ el test de timezone falla.
7. Devolver los campos financieros a la proyección sin capacidad ⇒ el test negativo del detalle falla.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
npm run build:webpack     # toca src/app/**/page.tsx
BASE_URL=http://127.0.0.1:3210 npm run test:e2e:prod:full   # con PostgreSQL arriba, una suite a la vez
```

## CRITERIOS DE ACEPTACIÓN

1. `canViewOrders` existe, tiene su test y es la puerta del listado, del detalle y de la entrada de menú.
2. `kitchen` recibe **403** en `/api/admin/orders` y aterriza en `/admin/kitchen`.
3. `cashier` **lista** y **abre** pedidos; no recibe acciones de Cocina.
4. El listado **no** serializa `orderLookupTokenHash`, GPS, items, modificadores ni historial.
5. `page`/`pageSize`/`total` funcionan y el `kpi` se calcula sobre el filtro completo.
6. Los siete filtros viven en la **URL** (`search`, `date`, `location`, `status`, `payment`, `scheduled`,
   `page`) y sobreviven a recargar.
7. «Pendientes» = `pending` + `partial`; «Pagados» = `paid`; `partial` + `unresolvedAmount > 0` muestra
   **PARCIAL · REVISAR**.
8. El detalle trae items, modificadores, notas, punto de retiro, historial real **con actor**, sellos por
   etapa, PIN y estado financiero **sólo** con la capacidad; fechas en la zona del **negocio**.
9. La factura (`GET`, `POST` y la hoja de impresión) rechaza rol y sucursal incorrectos (`A-70`).
10. `resolveAdminLanding` es la única respuesta a «dónde aterriza este rol» (login, redirects y shell).
11. Los cuatro viewports del Viewport Contract sin scroll horizontal; en escritorio el listado usa el alto
    útil y muestra la densidad aprobada.
12. `A-09`, `A-10`, `A-60`, `A-61`, `A-62`, `A-63`, `A-66` y el `A-70` mínimo quedan **cerrados con
    evidencia**; el remanente de `A-64` se mide y se declara.

## REGRESIÓN

Cada criterio tiene su test y su mutación (§ *MUTATION CHECK*): reintroducir la condición defectuosa pone
el test en rojo.

## ROLLBACK

Revert del commit en `main` y nuevo `deployService`. **La base no se toca**: no hay migración.

## DOCUMENTACIÓN

`ops/CURRENT.md` (producción pasa a estar **un release atrás** de `main` mientras el deploy no cierre),
`ops/roadmap/{NEXT,EXECUTION-MAP}.md`, `ops/design/screens/orders.md` (premisas obsoletas),
`ops/audit-backlog.md` (los ocho hallazgos) y `ops/product/CAPABILITY-REUSE-MAP.md` (el read model nuevo).

## MEMORY

**Sí**: «un tablero que se vuelve bandeja conserva la consulta del tablero» — cuando una superficie cambia
de propósito, la consulta que la alimenta es parte del cambio, no un detalle de implementación.

## DEFINITION OF DONE

Ver [`AGENTS.md`](../../AGENTS.md) § *Definition of Done*. Excepciones documentadas: ninguna prevista.
