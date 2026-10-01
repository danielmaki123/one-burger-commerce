# TASK-ORDER-POS-OPERATIONAL-006 — POS operativo del cajero: pedido existente → cobro y entrega

## TASK ID

`TASK-ORDER-POS-OPERATIONAL-006` (orden **6** del [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md) §2:
«Pedido existente → Cobrar en POS»).

## Título

Convertir `/admin/pos` en el workspace operativo principal del cajero: KPI operacionales, panel de pedidos,
cobro atómico de un pedido existente y entrega, sin que POS sea dueño de las reglas de Orders, Payments,
Money o Kitchen.

## Prioridad

`P1` — toca **dinero** (cobro partido, saldo, idempotencia, concurrencia, entrega) y **autorización**
(`canDeliverOrder`, alcance por sucursal). Hoy la operación cotidiana del cajero no se puede completar sin
salir del POS: es el hallazgo `A-67`.

## Clase de riesgo

`dinero` (la más alta que aplica). También toca `auth/datos` (permiso nominal nuevo) y `UI` (header, panel
operacional, modo pedido existente). **Sin migración.**

## DELIVERY MODE

- [ ] `docs-only`
- [ ] `runtime-e2e`
- [x] `high-risk-e2e`

Flujo, modos y condiciones de parada: [`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md). No se
repite acá. Gates de la clase: [`money-change`](../../.agents/skills/money-change/SKILL.md) y
[`ui-change`](../../.agents/skills/ui-change/SKILL.md).

## STOP CONDITIONS específicas de esta TASK

Además de las diez de la política y de las catorce del brief del owner (§70), esta TASK para antes de:

- **crear un `OrderStatus` o un `PaymentStatus` nuevo**;
- **crear una migración** (la auditoría no encontró necesidad de schema; si aparece una real, se para);
- **crear una ruta financiera paralela** (`/api/admin/pos/pay-order` y equivalentes están prohibidas);
- **cambiar el significado histórico de `Payment.amount`**;
- **permitir pagos comerciales parciales** (no existe el abono comercial);
- **mover Shift/Cash** al nuevo módulo (es el orden 7);
- **rediseñar Kitchen u Orders**;
- **crear un segundo catálogo de medios**.

Una contradicción documental que el código resuelve claramente **no** es Stop Condition: se corrige el
documento.

---

## PROBLEMA

`/admin/pos` es hoy una superficie de **venta rápida**: catálogo, líneas, cobro, esperas. Todo lo que pasa
**después** de que el pedido existe vive en `/admin/orders` (localizar, revisar) y **no tiene superficie de
cobro**: el backend `POST /api/admin/orders/[id]/payment` existe y está probado desde
`TASK-MONEY-PAYMENTS-RUNTIME-001`, pero **ningún camino de UI llega a él** (`A-67`, declarado en
`ops/design/screens/pos-quick-sale.md` § *Reuse audit* y en `EXECUTION-MAP.md` §6).

El resultado operativo es que el cajero no puede resolver su día sin cambiar de pantalla ni sin que el
pedido del menú quede, en la práctica, sin cobrar:

1. **No ve qué tiene que hacer ahora.** No hay ninguna banda que responda «qué está en proceso, qué está
   listo, qué falta cobrar, qué viene programado» para **su** local.
2. **No puede cobrar un pedido que ya existe.** El cobro de un pedido del menú (o de un programado) no tiene
   UI; la venta rápida sí, y son flujos distintos.
3. **No puede entregar.** La transición `ready_for_pickup → picked_up` existe en el dominio
   (`order-workflows.ts`) pero no hay puerta nominal que autorice al `cashier` a ejecutarla sin darle, por
   efecto secundario, la capacidad gruesa de manejo de pedidos (`canManageOrderOperations` mete a `kitchen`
   y deja afuera al `cashier`).
4. **El landing del cajero está mal.** `resolveAdminLanding` lo manda a `/admin/orders` —la superficie
   **administrativa** de búsqueda, historial y auditoría— y no a su workspace operativo.

Además, la auditoría de este arranque encontró **dos divergencias documentales reales** que se corrigen acá:

- **`A-85` está marcado `cerrado` pero sólo el backend lo está.** `payments/domain/payment-method-availability.ts`
  implementa la regla y `pos-sale.ts` la consume en el **snapshot**, pero la UI del POS
  (`quick-sale/pos-payment.tsx:35`, `pos-payment-rows.tsx:32`) sigue construyendo los medios desde la lista
  hardcodeada `POS_PAYMENT_METHODS = ["cash","card","transfer","other"]` y decide la referencia con
  `payment.method === "transfer"` en vez de `requiresReference`. El POS visible **no** consume
  `PaymentMethodConfig`. Las monedas sí salen de `money` (eso quedó bien).
- **El cobro de un pedido existente no acepta un checkout completo.** `payment-composition.ts` valida un
  `paymentSchema` de **un solo** `method` + `amount` + `currency`; no hay forma de liquidar un saldo con dos
  medios en una sola operación. El brief §27–§31 exige que una llamada represente la **liquidación comercial
  completa** del saldo.

## REUSE AUDIT

**Gate obligatorio** ([`../product/MODULE_ARCHITECTURE.md`](../product/MODULE_ARCHITECTURE.md) §10.1–§10.3).

```md
Objetivo:                 el cajero resuelve su operación cotidiana (ver, cobrar, entregar) sin salir del POS
Capacidad existente:      orders: lifecycle (order-workflows), scheduling (order-scheduling), source
                          (Order.source), scope (order-visibility/order-scope), historial con actor,
                          OrderListProjection paginada; payments: estado financiero canónico
                          (getOrderPaymentStatus / order-financial-status), payment-totals, snapshot,
                          PaymentMethodConfig + PaymentMethodLocation + payment-method-availability;
                          money: readProductionMoney, buildPaymentSnapshotFor, convert-to-base,
                          round-currency, format-money; pos: venta rápida completa (register-pos-sale con
                          multi-pago transaccional), shift/turno, catálogo, esperas; orders:
                          register-order-payment (cobro de pedido existente, con lock + idempotencia +
                          snapshot) y POST /api/admin/orders/[id]/payment; auth: canCollectPayment,
                          canViewOrders, canUsePOS, canViewOrderFinancials, resolveAdminLanding
Qué se reutiliza:         TODO lo anterior. El POS compone: consume la proyección de Orders, el estado
                          financiero de Payments, las monedas y snapshots de Money, el patrón
                          transaccional multi-Payment de la venta rápida y la ruta de cobro existente
Qué es realmente nuevo:   1) PosOperationalOrdersProjection (+ su summary server-side, scope por local y
                          orden por pickupTime); 2) canDeliverOrder (puerta nominal, cashier puede
                          entregar y no puede preparar/cancelar/cerrar); 3) la superficie: banda de KPI,
                          panel operacional reutilizable y modo «pedido existente» inmutable en POS;
                          4) la evolución de register-order-payment a checkout completo (varios medios,
                          liquidación exacta, atómica e idempotente); 5) el puente Orders → POS
                          (?orderId=) y el cambio de landing del cashier
```

Lo que **no** se crea: ni un módulo nuevo, ni una ruta financiera paralela, ni un carrito para el pedido
existente, ni un estado nuevo, ni una migración.

## SPEC / REFERENCE / DESIGN FREEZE

- **SPEC aprobada**: [`../design/screens/pos-quick-sale.md`](../design/screens/pos-quick-sale.md). El brief
  del owner **es** la decisión de abrir la Fase 2 que la spec dejó declarada fuera de alcance
  («cobrar un pedido del menú se resolverá en la siguiente fase desde Órdenes → Pedido → Cobrar en POS; su
  cobertura E2E queda como `A-67`»). La spec se **actualiza** en el mismo PR con la banda de KPI, el panel
  operacional, el modo pedido existente y el contrato de viewport ampliado: es la traducción del pedido del
  owner, no una reinterpretación.
- **`reference.html`**: `pos-quick-sale-reference.html` sigue siendo la referencia de **venta rápida** y no
  se toca. El brief §5/§21/§60 especifica la banda y el panel en prosa (nombre + contador, chips compactos,
  sin cards grandes, sin overflow): esa prosa es el contrato de composición de lo nuevo.
- **Design Freeze**: queda congelado lo que la spec ya congelaba —la venta rápida, su scroll único y su
  contrato de viewport— y **no se reinterpreta**. La banda de KPI es **aditiva** al encabezado y no puede
  empujar `Cobrar C$…` fuera del primer viewport ni crear scroll de página.
- **Viewport Contract** (superficie operativa): `1366×768`, `1280×720`, `768×1024`, `375×812`. Barra
  operativa y KPIs visibles/accesibles; Quick Sale usable; panel operacional usable; pedido existente
  usable; CTA cobrar y entregar usables; controles ≥ 44 px; cero overflow horizontal; cero scroll de página
  inesperado en escritorio; sin `<dialog>` superpuestos interceptando punteros (deuda `A-92`).
- **Cierre**: comparación implementación real vs esta spec + el brief, con capturas en los cuatro viewports
  y la reejecución del E2E del POS.

## EVIDENCIA

- `src/modules/auth/domain/admin-landing.ts:33` — el `cashier` aterriza en `/admin/orders` (comentario y
  tabla incluidos): su workspace principal no es el POS.
- `src/app/(admin)/admin/pos/quick-sale/pos-payment.tsx:35` y `pos-payment-rows.tsx:32` —
  `PAYMENT_METHOD_CHOICES = POS_PAYMENT_METHODS.map(...)`: los medios visibles salen de la constante
  `pos-sale.ts:31` (`["cash","card","transfer","other"]`), no de `PaymentMethodConfig`.
- `src/app/(admin)/admin/pos/quick-sale/pos-payment.tsx:236` — `payment.method === "transfer"` decide la
  referencia: la UI decide con el enum histórico en vez de `requiresReference`.
- `src/app/api/admin/orders/[id]/payment/payment-composition.ts:34-56` — `paymentSchema` acepta **un**
  `method` + `amount` + `currency`: no existe el checkout completo.
- `src/modules/orders/domain/order-workflows.ts:17` — `ready_for_pickup: ["picked_up"]` existe en el
  dominio; no hay puerta nominal de entrega en `admin-permissions.ts` (la única transición que toca el
  `cashier` es `canCollectPayment`).
- `src/app/(admin)/admin/orders/[id]/_components/order-detail-actions.tsx` — el detalle administrativo no
  ofrece ningún camino hacia el POS.
- `ops/audit-backlog.md` — `A-67` (reportado) y `A-85` (marcado `cerrado` con la divergencia de UI viva).

## CAUSA RAÍZ

El read model de Orders se diseñó para la pregunta **administrativa** («¿qué pedidos quiero buscar y
auditar?») y el POS se diseñó para la pregunta de **venta** («¿qué le vendo a este cliente?»). Nadie construyó
el read model de la tercera pregunta —«¿qué necesita hacer el cajero **ahora** en este local?»— ni la
superficie que la contesta, así que:

1. los KPI operacionales no tienen productor server-side y nadie los puede calcular sin reconstruir el
   listado admin en React (prohibido por el brief §10);
2. el cobro de un pedido existente quedó con el shape mínimo que necesitaba la factura (un `Payment`), no el
   que necesita el mostrador (la liquidación del saldo);
3. los permisos quedaron en la granularidad de «operar pedidos» en bloque, así que autorizar la entrega al
   cajero habría implicado autorizarlo a preparar, cancelar y cerrar;
4. la UI del POS quedó anclada a una constante del dominio que el backend ya había dejado de usar como
   verdad, y el cierre de `A-85` se declaró sobre el backend sin revalidar el cliente.

## INVARIANTE

1. **`Σ monto aplicado == outstandingAmount`** al completar un checkout del POS. Ni menos (no hay abono
   comercial) ni más (no hay sobrecobro).
2. **`paid` ⇔ `outstandingAmount == 0 && unresolvedAmount == 0`** (precedencia de `D-020`/`D-021`, ya
   implementada): el POS **consume** `getOrderPaymentStatus` y nunca recalcula.
3. **Un pedido nunca queda cobrado dos veces**: la clave de idempotencia y el lock del pedido lo garantizan
   en la base, no en React.
4. **`ready_for_pickup` no implica `paid`, y `paid` no implica `picked_up`**: son tres ejes independientes
   (producción, financiero, entrega) y ninguna transición mueve las otras dos.
5. **El hecho histórico no se reinterpreta**: un monto no demostrable sigue siendo `unresolvedAmount`; nunca
   se convierte con la tasa vigente.
6. **El alcance por sucursal se aplica en el servidor**: ninguna lectura operacional devuelve un pedido
   fuera del alcance de la sesión.
7. **El cobro partido es atómico**: o entran todos los `Payment` o no entra ninguno.

## BOUNDED CONTEXT

Dos módulos dueños y ninguno se convierte en el otro:

- **`orders`** — dueño del **lifecycle**, el **scheduling**, el **source** y el **scope**; aporta la
  proyección operacional nueva (`PosOperationalOrdersProjection`) y la transición de entrega. Sigue siendo
  el dueño del cobro de un pedido existente (`register-order-payment`).
- **`payments`** — dueño del **estado financiero canónico**, el saldo, el snapshot y el **catálogo de
  medios**. El POS lo consume.
- **`money`** — dueño de monedas, tasas y conversión. El POS lo consume.
- **`pos`** — dueño de la **experiencia operacional** del cajero: compone, no posee.

Señal de alcance grande: el cambio toca dos módulos (`orders`, `pos`) más `auth` (una puerta nominal) y
`payments` (sólo lectura). Se declara acá porque es exactamente el punto donde el brief prohíbe que POS
absorba a los otros.

---

## SCOPE IN

- **`orders`** — `PosOperationalOrdersProjection` (read model mínimo, scope por local, orden por
  `pickupTime`) y su `summary` calculado **en el servidor**; la ruta que lo publica; la transición de
  entrega reutilizando `update-order-status`.
- **`payments`** — sin cambios de reglas: se consume `getOrderPaymentStatus` y
  `payment-method-availability`; se reutiliza el catálogo para la lectura del POS.
- **`auth`** — `canDeliverOrder` (puerta nominal nueva) y `resolveAdminLanding` (cashier → POS).
- **`pos`** — banda de KPI operacional en el encabezado; panel operacional único y reutilizable con cuatro
  modos (`process` · `ready` · `pending-payment` · `scheduled`); modo «pedido existente» inmutable; checkout
  completo con medios configurados, `paymentMethodId`, `requiresReference` y monedas de `money`.
- **`orders/features/register-order-payment`** — **ADAPT** del cobro de un pedido existente al checkout
  completo (varios medios, liquidación exacta, todo dentro de la misma transacción y con la misma clave de
  idempotencia).
- **`app/api/admin/orders/[id]/payment`** — el schema acepta la lista de medios; sigue siendo **la única**
  ruta de cobro de un pedido existente.
- **Orders UI** — `Cobrar en POS` en el detalle administrativo → `/admin/pos?orderId=<id>`.
- Documentación autoritativa del cierre.

## SCOPE OUT

- **Cash ownership / mover `Shift` a un módulo `cash`**: es el orden **7**, no se abre.
- **`A-76`** (void no mira el turno ni la factura), **rediseño de refund/void**, **cierres**, **reforma de
  Invoice**, **mesas**, **table service**, **reservas**, **inventario**, **delivery**, **ownership de
  promotions**, **rediseño general de Orders**, **rediseño general de Kitchen**, **Dashboard/Resumen**.
- **Un segundo catálogo de medios**, **una segunda ruta financiera**, **un carrito para el pedido
  existente**, **un estado nuevo** (`delivered_to_customer`, `pos_completed`, `handed_out` y equivalentes
  están prohibidos).
- **Migraciones**: ninguna por defecto.
- **Kitchen**: no se le agrega cobrar, entregar ni cerrar.

## DEPENDENCIAS

Órdenes **3b / 4 / 5 / 5b** cerradas y desplegadas (el estado financiero canónico y el read model
administrativo existen). Ninguna decisión del owner pendiente: el brief decide. Sin credenciales nuevas.

## ARCHIVOS PROBABLES

| Archivo | Quién más lo consume |
|---|---|
| `src/modules/orders/features/pos-operational-orders/**` *(nuevo)* | la ruta nueva del POS |
| `src/app/api/admin/pos/operational-orders/route.ts` *(nuevo)* | el cliente del POS |
| `src/modules/auth/domain/admin-permissions.ts` | `register-order-payment`, `update-order-status`, tests de permisos |
| `src/modules/auth/domain/admin-landing.ts` | `/admin` (redirect), `admin-shell.tsx`, login, `admin-ui-contract.test.ts` |
| `src/modules/orders/features/register-order-payment/register-order-payment.ts` | `payment-composition.ts`, su test y su `*.postgres.test.ts` |
| `src/app/api/admin/orders/[id]/payment/payment-composition.ts` | el detalle de Orders (a futuro) |
| `src/app/(admin)/admin/pos/**` | nada externo: es la superficie |
| `src/app/(admin)/admin/orders/[id]/_components/order-detail-actions.tsx` | el detalle administrativo |
| `ops/design/screens/pos-quick-sale.md` | ley visual de la pantalla |

## TEST ROJO

Antes de implementar, y **por la razón correcta** (no por un import roto):

1. `admin-landing.test.ts` — `resolveAdminLanding(cashier)` debe ser `/admin/pos`; hoy devuelve
   `/admin/orders`.
2. `admin-permissions.test.ts` — `canDeliverOrder`: `cashier` **true**; y `cashier` sigue **false** en
   `canManageOrderOperations` / `canOperateKitchen`.
3. `pos-operational-orders.test.ts` *(nuevo)* — los cuatro KPI del `summary`, la superposición (un pedido
   cuenta en varios), el orden por `pickupTime` (no por `createdAt`) y el scope por local.
4. `register-order-payment.test.ts` — un checkout de dos medios que suma exactamente el saldo registra dos
   `Payment`; **underpayment** y **overpayment** se rechazan; `partial`/`unresolved` bloquean el cobro
   normal.
5. `payment-method-availability` / UI del POS — un medio apagado, fuera del local o de otra moneda se
   rechaza; `requiresReference` gobierna la referencia.
6. `update-order-status` / entrega — `ready_for_pickup → picked_up` con `canDeliverOrder`; `cashier` no
   puede `preparing` ni `cancelled` ni `closed`.

## ESTRATEGIA

Componer, en este orden: **(a)** el read model operacional server-side (con su `summary`) y su ruta;
**(b)** la puerta `canDeliverOrder` y el landing; **(c)** la superficie (banda + panel + modo pedido
existente) sobre capacidades ya existentes; **(d)** el checkout completo en el caso de uso de cobro
existente, con liquidación exacta; **(e)** la verdad configurada de los medios en la UI, apagando la
constante como fuente de las opciones. La transacción del cobro partido **reutiliza** el patrón de la venta
rápida (`lockOrder` → leer saldo → validar → construir snapshots → resolver/lock turno → N `Payment` →
`COMMIT`), sin abrir un segundo runner si se puede componer el existente.

## DDD

- **`domain`** (puro, sin I/O): la proyección operacional y su `summary` (`orders/domain`), la puerta
  `canDeliverOrder` (`auth/domain`), la aritmética de liquidación exacta (`payments/domain` o
  `orders/domain`, reutilizando `roundCurrency`).
- **`features`**: el caso de uso que lee la proyección (`orders/features/pos-operational-orders`) y la
  adaptación de `register-order-payment`.
- **`ports`/`adapters`**: la lectura de pedidos del local con su saldo (Prisma, sin Prisma en el route).
- **`route`**: la ruta nueva del POS (≤ 50 líneas, zod, permisos, adaptador, caso de uso) y el schema
  ampliado de la ruta de cobro existente.
- **`app/(admin)`**: la superficie. Sin reglas de negocio en React.

## TRANSACCIÓN

El **límite atómico** del cobro es la transacción PostgreSQL que ya existe (`runInOrderPaymentTransaction`):
`lockOrder` → leer el saldo canónico dentro del lock → validar que `Σ aplicado == outstandingAmount` →
construir **todos** los snapshots → resolver y `lockShift` → insertar **N** `Payment` → `COMMIT`. Si
cualquiera falla, `ROLLBACK` completo: **cero** `Payment` parciales por fallo técnico intermedio.

## CONCURRENCIA

Dos requests simultáneos cobrando el mismo saldo deben cobrarlo **una sola vez**. La protección es el
`lockOrder` (lock de la fila del pedido, `SELECT ... FOR UPDATE`) que ya usa el cobro, combinado con la
lectura del saldo **dentro** del lock: leer-y-después-escribir fuera del lock no protege y queda prohibido.
Se prueba contra **PostgreSQL real** con dos transacciones concurrentes.

## IDEMPOTENCIA

Una llamada de checkout lleva **una** clave de idempotencia que representa **toda** la liquidación (no una
por fila). El mecanismo es el canónico de `Payment` (índice único parcial sobre `idempotencyKey`, chequeo
**después** del lock y red de seguridad `P2002` con un reintento), ya implementado y probado: se reutiliza.
Dos requests con la misma clave producen **un solo** hecho financiero.

## AUTORIZACIÓN

| Capacidad | owner | manager | cashier | kitchen |
|---|---|---|---|---|
| `canUsePOS` (mostrador) | ✓ | ✓ | ✓ | ✗ |
| `canCollectPayment` (cobrar deuda) | ✓ | ✓ | ✓ | ✗ |
| `canViewOrderFinancials` (ver saldo) | ✓ | ✓ | ✓ | ✗ |
| `canViewOrders` (localizar/revisar) | ✓ | ✓ | ✓ | ✗ |
| **`canDeliverOrder` (nuevo)** | ✓ | ✓ | ✓ | ✗ |
| `canManageOrderOperations` (gruesa) | ✓ | ✓ | **✗** | ✓ |
| `canOperateKitchen` (preparar) | ✓ | ✓ | **✗** | ✓ |

`canDeliverOrder` autoriza **únicamente** `ready_for_pickup → picked_up` sobre un pedido **del alcance** del
local. Pruebas negativas obligatorias: `cashier` no puede `preparing`, `cancelled` ni `closed`; `kitchen` no
puede cobrar ni entregar. El alcance por sucursal se aplica en el servidor con la capacidad canónica de
visibilidad de Orders.

## MIGRACIÓN

`N/A — sin cambios de esquema.` La auditoría confirma que existen `Order.source`, `Order.pickupScheduled`,
`Order.pickupTime`, `Order.currencyCode`, `PaymentMethodConfig`, `PaymentMethodLocation`,
`Payment.paymentMethodId`/`methodKind`/`entityId`/`idempotencyKey` y el índice único parcial de la clave.
Si apareciera una necesidad real de schema, se activa Stop Condition **antes** de crearla.

## OBSERVABILIDAD

- `OrderStatusHistory` registra la entrega con su **actor real** (`changedByUserId`), reutilizando la
  transición existente.
- El log de acciones sensibles del POS cubre el cobro (se reutiliza el de la venta rápida y el de la ruta de
  cobro).
- El `Payment` conserva su snapshot completo (monto, moneda, moneda base, tasa, equivalente, medio y
  entidad), que es lo que permite reconstruir el hecho.
- Ninguna lectura operacional escribe: los KPI no dejan rastro y no lo necesitan.

---

## TESTS UNITARIOS

KPI `En proceso` / `Listos` / `Por cobrar` / `Programados` correctos; superposición (un pedido cuenta en
varios); programados ordenados por `pickupTime`; scope por sucursal; `resolveAdminLanding(cashier)`;
`canDeliverOrder` (positivo y negativos); pedido existente inmutable (no se recrea); pedido `paid` no se
vuelve a cobrar; `cancelled` no se cobra; `partial`/`review` fuera del flujo normal; `unresolvedAmount`
bloquea el cobro normal; medios configurados (activo apagado, fuera del local, moneda no soportada,
`requiresReference`, `paymentMethodId` inexistente, `kind` manipulado); checkout (un medio, dos medios,
underpayment, overpayment partido, mismo método en dos filas, multimoneda).

## TESTS DE INTEGRACIÓN

Contra **PostgreSQL real** (`*.postgres.test.ts`): **atomicidad** (Payment 1 entraría, Payment 2 falla →
**0** `Payment` nuevos); **concurrencia** (dos requests cobrando el mismo saldo → se cobra una sola vez, sin
sobrecobro); **idempotencia** (dos requests con la misma clave → un solo hecho); **turno** (el `Payment` no
queda sin turno ni asociado al turno incorrecto cuando la caja cambia o se cierra alrededor del cobro).

## E2E

`tests/e2e/admin-pos-operational.spec.ts` (nuevo) con los cuatro recorridos del brief: **A** venta rápida
completa hasta `picked_up`; **B** pedido de menú → POS → cobrar → entregar; **C** programado (timezone del
negocio, orden por `pickupTime`, superposición); **D** cobro partido. Más el **negativo** de overpayment
partido. Y la **regresión** de los specs existentes del POS.

## MUTATION CHECK

Reintroducir, observar rojo y restaurar: quitar el lock; quitar la idempotencia; permitir overpayment;
ignorar el scope; ignorar `PaymentMethodConfig.isActive`; ignorar la disponibilidad por local; ignorar
`requiresReference`; insertar uno de varios `Payment` fuera de la transacción; permitir `cashier →
cancelled`; permitir `cashier → preparing`. Se reporta cuáles tests se pusieron rojos. Ninguna mutación se
commitea.

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts
npm run test:postgres
npm run build && npm run build:webpack
BASE_URL=http://127.0.0.1:3210 npm run test:e2e:prod:full
npm run visual-check   # si existe el gate; si no, la medición de los 4 viewports del Viewport Contract
```

## CRITERIOS DE ACEPTACIÓN

Los 45 criterios del brief §72, cada uno con evidencia verificable. En particular: POS es el landing del
cashier; Quick Sale sin regresión; los cuatro KPI vienen del dueño correcto y del servidor; scope por local
en el servidor; programados por `pickupTime`; un pedido cuenta en varios KPI; pedido existente abrible e
inmutable; Orders abre el mismo modo; no hay segunda `Order`, ni segunda ruta financiera, ni segundo
catálogo de medios; `PaymentMethodConfig`/`PaymentMethodLocation`/`requiresReference`/`money` gobiernan el
POS; caja abierta obligatoria; cobro partido exacto, atómico e idempotente; overpayment y underpayment
rechazados; `financialState` viene de Payments; `unresolved` no se convierte; `partial`/`review` fuera del
flujo normal; `ready+pending → Cobrar`, `ready+paid → Entregar`, `preparing+paid → esperar`;
`cobrar ≠ entregar`; `cashier` puede `picked_up` y no puede preparar/cancelar/cerrar; Kitchen no recibe
dinero; PostgreSQL real prueba rollback/concurrencia/idempotencia; mutaciones rojas; los cuatro E2E; los
cuatro viewports sin overflow; `A-67` cerrado; `A-85` verificado/corregido; overpayment partido
registrado/cerrado; docs consistentes; roadmap con **7 como única NEXT**.

## REGRESIÓN

Cada test nuevo falla si se reintroduce su bug (ver *Mutation Check*). Además, la suite completa del POS
(`admin-pos.spec.ts`, `admin-pos-ticket.spec.ts`, `admin-pos-idempotency.spec.ts`) y los unitarios de
`pos-sale`, `commit-sale`, `payment-snapshot-for`, `payment-method-availability` deben seguir verdes sin
cambiar expectativas: si alguna cambia, se demuestra que el contrato cambió a propósito.

## ROLLBACK

Revert del commit en `main` y nuevo `deployService`. **La base no se toca**: sin migraciones, la app
anterior ignora lo nuevo. No hay `down-migrations`.

## DOCUMENTACIÓN

En el cierre: `ops/roadmap/PRODUCT-UX-ROADMAP.md` (orden 6 cerrado), `ops/roadmap/EXECUTION-MAP.md`,
`ops/roadmap/NEXT.md` (7 = NEXT), `ops/CURRENT.md`, `ops/product/CAPABILITY-REUSE-MAP.md`,
`ops/product/MODULE-OWNERSHIP.md`, `ops/design/screens/pos-quick-sale.md`, `ops/audit-backlog.md`.

## MEMORY

Candidata: «un read model administrativo y un read model operacional son dos preguntas distintas; el
segundo exige que el **servidor** produzca el resumen y no que React agregue la página visible». Entra sólo
si el cierre demuestra que es reutilizable.

## DEFINITION OF DONE

La lista de [`AGENTS.md`](../../AGENTS.md) § *Definition of Done*, más el flujo completo de
[`delivery-e2e`](../../.agents/skills/delivery-e2e/SKILL.md) hasta la QA de producción. Excepciones
documentadas en el commit y en el PR.
