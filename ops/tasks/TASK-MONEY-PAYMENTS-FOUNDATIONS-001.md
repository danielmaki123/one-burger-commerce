# TASK-MONEY-PAYMENTS-FOUNDATIONS-001 — Money / Payments ownership + Design Freeze de Finanzas

> **Estado**: brief de la TASK, **ejecutada en `docs-only`**. Cierra en **PR → CI verde (los cuatro checks:
> `verify`, `contracts`, `migrations`, `container`) → squash merge a `main` → STOP**, y **sin deploy**: no toca
> runtime, Prisma, migraciones, APIs ni navegación. Los hallazgos quedan registrados en
> [`../audit-backlog.md`](../audit-backlog.md) (`A-68`…`A-80`) y **no se corrigen acá**.
>
> **Base `main`**: `91048085da03c368d9dd77b12c608fdbedceeb9d` (`9104808`, 2026-09-28) · **Rama**:
> `docs/money-payments-foundations` · **Delivery Mode**: **`docs-only`** (PR → CI verde → squash merge →
> `main` limpio → **STOP**).
>
> **Qué entrega**: la **auditoría real** de Money y Payments contra el código, las **matrices** de
> clasificación y de ownership, la **SPEC congelada** de Finanzas
> ([`../design/screens/finance.md`](../design/screens/finance.md)) con su referencia versionada
> ([`../design/screens/finance-reference.html`](../design/screens/finance-reference.html)), los **contratos**
> que el runtime va a implementar (estado financiero canónico, snapshot de `Payment`, idempotencia,
> boundaries), la **estrategia legacy sin backfill**, las **migraciones enumeradas y no creadas** y **una
> única próxima TASK**.
>
> **Qué NO entrega**: ni una línea de runtime. Nada de lo auditado acá se corrige en esta TASK: los hallazgos
> **se registran** ([`../audit-backlog.md`](../audit-backlog.md), `A-68`…`A-80`) y los implementa la TASK
> siguiente.
>
> **Hallazgos de auditoría que acá se cierran documentalmente**: `A-68` (dinero, P1) · `A-69` (dinero, P2) ·
> `A-71` (idempotencia, P2) — los tres **reproducidos con evidencia**, no dados por ciertos por el pedido.

---

## Verificación de las premisas del pedido (re-auditoría contra código real)

El pedido del owner trae datos que **no se toman como fuente de verdad**. Verificado uno por uno:

| Premisa del pedido | Veredicto | Evidencia |
|---|---|---|
| «La referencia la aprobó el owner el **2026-09-27**» | **CONFIRMADO** | La referencia de Pedidos/Cocina se versionó en `76c4ba0` (2026-09-27, PR #76) con la aprobación del owner de ese día; la de Finanzas es la misma tanda. `CURRENT.md` § *Última actualización* registra el 2026-09-27 como la fecha de aprobación de las referencias de ese tramo |
| «Versionala previsiblemente en `ops/design/screens/finance-reference.html`» | **CONFIRMADO**, con hash | Copiada byte a byte: SHA-256 `3964f097841281a8a54c34fd3f8a1fcf38616defd840f92d9ff6fbb7aee68e09`, 33.528 bytes, idéntica al adjunto |
| «`money` será dueño de catálogo de monedas, moneda base, FX, conversión e historial de tasas» | **Nada de eso existe hoy** | No hay **ningún** modelo de moneda ni de tasa en los 47 modelos de `prisma/schema.prisma`; `usdExchangeRate` es un `Float?` en `BusinessSettings` (`prisma/schema.prisma:833`) y `grep` de `rateHistory`/`exchangeRateHistory` en `src/` → **0 coincidencias** |
| «No asumir que solo existen NIO/USD» | **El código sí lo asume, en cinco lugares** | `money-conversion.ts:13` (`SUPPORTED_FOREIGN_CURRENCY = "USD"`), `cash-config-defaults.ts:16,30`, `cash-count-config.ts:34`, `shift-cash.ts:118`, `cash-config-client.tsx:26,85` + la UI de cobro (`pos-payment.tsx:169`) |
| «`mixed` no debe ser un medio real» | **Ya es la regla del POS, pero sigue en el enum** | `POS_PAYMENT_METHODS` **no** incluye `mixed` (`pos-sale.ts:17`) y el comentario de `:14-15` lo declara derivado; el enum `PaymentMethodType` **sí** lo tiene (`prisma/schema.prisma:433-439`) |
| «Auditar si `canEmitInvoiceFor()` usa `hasPayments` en vez de saldo liquidado» | **CONFIRMADO**: usa `hasPayments` | `emit-invoice.ts:161-164` pasa `hasPayments: (await deps.countPayments(orderId)) > 0`; `production-invoice.ts:29` cuenta filas. Un pedido con **un cobro parcial** factura |
| «Reproducir `A-68`» | **REPRODUCIDO**, con número | § *Reproducción de hallazgos* |
| «Reproducir `A-69`» | **REPRODUCIDO** en sus tres partes | § *Reproducción de hallazgos* |
| «Reproducir `A-71`» | **REPRODUCIDO**, request-level | § *Reproducción de hallazgos* |
| «Auditar `Bank`, `LocationBank`, adquirentes y su relación con medios de pago» | **Hecho**: el catálogo existe y **no** se relaciona con `Payment` | § *Boundary Payments ↔ entidades de cobro* |
| «Payments debe ser dueño de `pending`/`partial`/`paid`, `paidAmount`, `outstandingAmount`» | **Ninguno existe hoy** | `grep` de `partial\|paidAmount\|outstandingAmount\|paymentStatus` en `src/**` → **0 coincidencias de producción** (sólo texto en tests); no hay proyección ni caso de uso |
| «No tocar runtime, Prisma, migraciones, APIs ni navegación» | **Respetado** | El diff de esta TASK son documentos, una spec y un HTML de referencia |

**Corrección al pedido**: el pedido afirma que la referencia se aprobó el 2026-09-27 y el repo lo confirma. No
hay contradicción que corregir. Lo que **sí** corrige esta auditoría es el **alcance**: el pedido supone que
hay que «reutilizar lo que ya existe y evitar una segunda lógica financiera», y la auditoría muestra que
**la segunda lógica ya existe**, cinco veces, y que tres de esas copias están en el camino del arqueo.

---

## PROBLEMA

Hoy **la regla financiera no tiene un solo dueño**. El dinero se cobra, se convierte, se suma y se formatea
desde **cuatro módulos** (`pos`, `orders`, `invoices`, `cash-config`) y desde **React**, con cinco
consecuencias medidas:

1. **El POS convierte y el cobro de un pedido existente no** (`A-68`, P1): dos caminos que escriben en la
   misma tabla comparan contra el total del pedido con reglas distintas, y uno de los dos **cobra de más**.
2. **La misma regla monetaria está escrita cinco veces** (`A-69`): la conversión canónica existe
   (`money-conversion.ts`) y tres consumidores del arqueo la ignoran con su propia aritmética, su propio
   literal `"USD"`, su propio redondeo y su propio tipo de error.
3. **Un cobro parcial no es idempotente** (`A-71`): el reintento de la misma request registra la misma plata
   dos veces mientras la suma no alcance el total.
4. **El hecho histórico no congela la tasa** (ley 7, [`AGENTS.md`](../../AGENTS.md) § *Leyes del repo*): el
   monto convertido se congela, **la tasa que lo produjo no**, así que el mismo cobro se explica distinto
   según cuándo se lea.
5. **No existe el estado financiero del pedido**: no hay `pending`/`partial`/`paid` en ninguna capa, así que
   cada consumidor decide «pagado» con lo que tiene a mano —`payments.length > 0` en la factura y en el
   detalle, la suma cruda en el POS, la suma cruda en el cobro de un pedido existente—.

Y **no existe la configuración** que el owner aprobó: moneda base, monedas aceptadas, catálogo de monedas,
tasa y su historial, medios de pago y entidades de cobro **no tienen dónde vivir**. Lo único que existe es un
`currencyCode` de texto libre (`/^[A-Z]{3}$/`), un `currencySymbol` y un `usdExchangeRate` en la fila única de
`BusinessSettings`.

**Causa raíz**: el negocio arrancó con **una** moneda y **dos** medios, y esas dos decisiones se escribieron
como **estructura del código** (enum, constante, literal) en vez de como **configuración**. Cuando el
producto necesitó una segunda moneda, se agregó un campo `usdExchangeRate` **al lado** del código que ya
asumía NIO, sin mover la autoridad. Y como el `Payment` se creó **antes** de que existiera una autoridad
monetaria, guarda el monto que le dieron **en la moneda que le dijeron**, sin la tasa: **no hay de dónde
convertirlo después**. Eso no se arregla con un `if` en el consumidor: se arregla **dándole un dueño a la
regla y haciendo que el hecho lo congele**.

---

## REUSE AUDIT

**Objetivo**: que una regla financiera tenga **un solo dueño** (`money` para moneda/FX/conversión,
`payments` para el cobro y el saldo, `banks` para las entidades, `cash` para la caja) y que las superficies
**consuman** esa autoridad en vez de recalcularla.

**Capacidad existente** (verificada, con su dueño de hoy):

| Capacidad | Dónde vive | Dueño hoy |
|---|---|---|
| Aritmética de conversión a moneda del negocio | `src/shared/lib/money-conversion.ts:21-44` | `shared/lib` (compartida a propósito) |
| Traducción del fallo de conversión a error del POS | `pos/domain/payment-conversion.ts:21-51` | `pos` |
| Traducción del fallo a error del turno | **cinco copias** (`shift-cash.ts:160,256,320`; `shift-payment-mix.ts:56`; `close-shift.ts:318`) | `orders` |
| Conversión propia de devoluciones, con `"USD"` propio | `orders/domain/shift-refund.ts:31-56` | `orders` |
| Redondeo de dinero | `shared/lib/order-totals.ts:10-12` (`roundCurrency`) + `toFixed(2)` en `shift-refund.ts:24,54` | `shared/lib` + `orders` |
| Formato de dinero (`símbolo + locale`) | `shared/lib/format-currency.ts:39-46` + `useCurrencyFormat()` (`business-settings.tsx:50`) | `shared/lib` |
| Formato «otra moneda con su código» | **7 copias** (`shift-sheet-format.ts:50`, `customer-ticket.ts:71`, `reconciliation-panel.tsx:100`, `history/[id]/page.tsx:167`, `cash-partial-reading-modal.tsx:267`, `cash-close-modal.tsx:399`, `cash-open-section.tsx:147`) | sin dueño |
| Configuración de moneda (código, símbolo, locale, tasa USD) | `BusinessSettings` (`prisma/schema.prisma:829-833`) + `/admin/settings` | `business-settings` |
| Qué monedas cuenta una sucursal | `cash-config` (`cash-count-config.ts:25-44`, `cash-config-defaults.ts:16,30`) | `cash-config` |
| Denominaciones por moneda | `cash-config-defaults.ts:24-27` + `CashDenomination` (`prisma/schema.prisma:269-283`) | `cash-config` |
| Esperado del arqueo por moneda | `orders/domain/shift-cash.ts:189-231` + `Shift.expectedByCurrency` (`:950`) | `orders` |
| `Payment` y su repositorio (puerto + Prisma + memoria) | `orders/domain/order.types.ts`, `orders/ports/payment-repository.ts`, `orders/adapters/prisma-payment-repository.ts` | `orders` |
| Cobro desde el POS (alta + cobros, atómico, idempotente por pedido) | `pos/features/register-pos-sale/**` + `production-pos-sale.ts:74-131` | `pos` |
| Cobro de un pedido existente (atómico, sin idempotencia) | `orders/features/register-order-payment/**` | `orders` |
| Anulación de un cobro (`void`) | `orders/features/void-payment/**` + `orders/domain/payment-void.ts` | `orders` |
| Devolución: pedir y resolver | `orders/features/refund/**` + `orders/domain/shift-refund.ts` | `orders` |
| Conciliación de cobros | `orders/domain/payment-reconciliation.ts` + `shared/lib/payment-reconciliation-csv.ts` | `orders` |
| Caja: turno, apertura/cierre, conteos, movimientos, arqueo, terminales | `orders/domain/shift-*.ts`, `orders/features/shift/**`, `pos/domain/shift-close-policy.ts`, `pos/features/close-pos-shift/**` | repartido `orders` + `pos` |
| Entidades de cobro (bancos) y su asignación por sucursal | `banks/**` + `Bank`/`LocationBank` (`prisma/schema.prisma:1075,1096`) + `GET\|PUT /api/admin/cash/banks` + `cash-banks-section.tsx` | `banks` |
| Factura como documento con snapshot | `invoices/**` + `Invoice` (`prisma/schema.prisma:1265`) | `invoices` |
| Puertas de autorización de dinero | `auth/domain/admin-permissions.ts` (`canUsePOS`, `canManageCash`, `canRefund`, `canApproveRefund`, `canVoidPayment`, `canManageCashConfig`, `canPrintCashDocuments`, `canDiscountPosSale`) | `auth` |

**Qué se reutiliza** (no se reconstruye nunca):

1. **`convertToBusinessCurrency`** (`money-conversion.ts:21-44`) como **el único algoritmo de conversión**.
   Los cinco traductores de error pasan a **un** traductor con parámetros.
2. **`roundCurrency`** (`order-totals.ts:10-12`) como **el único redondeo de dinero**. `toFixed(2)` sale del
   camino del dinero.
3. **`formatCurrency`** y **`useCurrencyFormat()`** como **el único formateador**, extendidos con el
   **código** de la moneda (`CurrencyFormat` gana el campo que hoy no tiene) para que las 7 copias de
   «otra moneda con su código» colapsen en una.
4. **El catálogo `banks` completo** —modelo, casos de uso, validación de código duplicado, ruta y UI—: se le
   agrega el **tipo de entidad**; **no** se crea un segundo catálogo financiero.
5. **Los cuatro `runIn*Transaction`** y las dos primitivas de lock (`lockOrderRow`, `lockShiftRow`): son
   correctos y ya están probados contra PostgreSQL real. Se **consolidan** en un runner parametrizado.
6. **`void`** con sus cinco invariantes y sus tests de PostgreSQL (`void-payment.postgres.test.ts`): se
   **mueve**, no se rehace.
7. **`request-refund` / `review-refund`** y sus invariantes (no devolver más que el cupo, nadie aprueba la
   propia, no aprobar sobre un cobro anulado, la rechazada libera): se mueven y se les agrega el **límite
   atómico** que hoy no tienen.
8. **`Payment.shiftId`**, **`Payment.reference`**, **`Payment.changeAmount`** y el soft delete
   (`voidedAt`/`voidedByUserId`/`voidReason`): se conservan tal como están.
9. **Caja entera** (`Shift`, conteos, movimientos, cierre, terminales, `expectedByCurrency`): **no se mueve a
   Payments**. Payments aporta hechos de cobro; Caja los consume.
10. **`canEmitInvoiceFor`** como puerta de la factura: se **adapta** para consumir el estado financiero
    canónico en vez de `hasPayments`.

**Realmente nuevo** (y nada más que esto):

| # | Pieza nueva | Por qué no es una copia |
|---|---|---|
| 1 | **Catálogo de monedas** (`code`, `name`, `symbol`, `decimals`, `isActive`, personalizada) | No existe ningún modelo de moneda: hay un `currencyCode` de texto libre |
| 2 | **Tasa por par con vigencia e historial** | No existe: hay un `Float?` sola y sin fecha |
| 3 | **Snapshot de la tasa en el hecho** (`Payment` y `Shift`) | No existe: por eso el pasado no se puede explicar |
| 4 | **Catálogo de medios de pago** con **tipo canónico** y monedas admitidas | No existe: `PaymentMethodType` es un enum de código |
| 5 | **Estado financiero canónico** del pedido (`pending`/`partial`/`paid` + `paidAmount` + `outstandingAmount`) | No existe en ninguna capa |
| 6 | **Idempotencia durable del cobro** (`Payment.idempotencyKey` + índice único) | No existe: el pedido la tiene, el cobro no |
| 7 | **Tipo de entidad de cobro** sobre `Bank` | No existe: `Bank` no declara qué clase de entidad es |
| 8 | **Ruta, navegación y vistas de Finanzas** | No existe la superficie |

**Lo que esta TASK NO decide y por eso no se implementa**: que `mixed` desaparezca del enum, qué migración
exacta agrega cada tabla, y cómo se tratan los hechos históricos (§ *Legacy*). Lo decide la TASK de runtime
con estos contratos delante.

---

## Auditoría real — Money

### Lo que existe hoy

| Capacidad | Archivo | Dueño |
|---|---|---|
| Moneda base (código ISO de 3 letras) | `prisma/schema.prisma:829`, validación `business-settings.types.ts:52` (`/^[A-Z]{3}$/`) | `business-settings` |
| Símbolo | `prisma/schema.prisma:830` | `business-settings` |
| Locale de formato | `prisma/schema.prisma:831`, schema `business-settings.schema.ts:208-212` | `business-settings` — **sin input en el admin**: sólo se escribe por API |
| Tasa USD (escalar único) | `prisma/schema.prisma:833`, default `null` | `business-settings` |
| Conversión | `shared/lib/money-conversion.ts:21-44` | `shared/lib` |
| Error del POS | `pos/domain/payment-conversion.ts:21-51` | `pos` |
| Error del turno | `orders/domain/shift-cash.ts:160,256,320`; `shift-payment-mix.ts:56`; `close-shift.ts:318` | `orders`, **cinco copias** |
| Conversión de devoluciones (propia) | `orders/domain/shift-refund.ts:31-56` | `orders` |
| Formato | `shared/lib/format-currency.ts:39-46` | `shared/lib` |
| Formato de otra moneda | 7 copias (§ *REUSE AUDIT*) | sin dueño |
| Denominaciones | `cash-config-defaults.ts:24-27` + `CashDenomination` | `cash-config` |
| Moneda contable por sucursal | `cash-count-config.ts:25-44` + `LocationCashConfig.usdEnabled` (`prisma/schema.prisma:245-256`) | `cash-config` |

### Hardcodes, clasificados

**Defectos de configuración legítimos** (única fuente permitida): `business-settings-defaults.ts:70-72`
(`"NIO"`, `"C$"`, `"es-NI"`) y `cash-config-defaults.ts:24-27` (denominaciones), más los `DEFAULT` de las
migraciones `20260910120000` y `20260922154442`.

**Leyes de dominio hardcodeadas** (lo que hay que sacar):

| Literal | Archivo:línea | Qué asume |
|---|---|---|
| `SUPPORTED_FOREIGN_CURRENCY = "USD"` | `shared/lib/money-conversion.ts:13` | Que la única moneda extranjera es el dólar |
| `BASE_CASH_CURRENCY = "NIO"` | `cash-config/domain/cash-config-defaults.ts:16` | Que la moneda del negocio es NIO **y** que se cuenta siempre, sin leer `BusinessSettings` |
| `KNOWN_CASH_CURRENCIES = ["NIO","USD"]` | `cash-config-defaults.ts:30` | Lista cerrada de monedas contables |
| `"USD"` | `cash-config/domain/cash-count-config.ts:34` | Que la única moneda opcional es el dólar |
| `"USD"` | `orders/domain/shift-cash.ts:118` | Segunda fuente de la misma lista |
| `"USD"` | `orders/domain/shift-refund.ts:44` | Tercera fuente, con conversión propia |
| `BASE_CURRENCY = "NIO"` + `"USD"` | `app/(admin)/admin/cash/config/cash-config-client.tsx:26,85` | Cuarta fuente, **en la UI** |
| `{ value: "USD", label: "USD" }` | `pos/quick-sale/pos-payment.tsx:169` y `pos/pos-payment-rows.tsx:147` | El medio de cobro ofrece dólares fijos |
| `(payment.currency ?? "NIO")` | `orders/features/refund/request-refund/request-refund.ts:128` | Que el `null` es NIO, cuando es «la moneda del negocio» |
| `(payment.currency ?? "NIO")` | `orders/features/update-order-status/update-order-status.ts:81` | Idem, segunda copia |
| `"es-NI"` × 3 | `app/(admin)/admin/_components/admin-overview-formatters.ts:1,6,10` | Locale fijo en el panel, ignorando `settings.locale` |
| `POS_QUICK_CASH_AMOUNTS = [200,500,1000]` | `pos/pos-quick-cash.tsx:13` | Billetes de Nicaragua como constante del mostrador (**decisión del owner 2026-09-19, no es un descuido**) |

`36.5` / `36.35` **no** aparecen en `src/**` de producción: son fixtures de test. El contrato
`anti-hardcode-contract.test.ts:41-61` persigue `currencySymbol` (`"C$"`) pero **no** `"NIO"`, `"USD"` ni
`"es-NI"`.

### Redondeo: dos algoritmos en el mismo número

`roundCurrency` (`order-totals.ts:10-12`) es el dominante (109 usos). `shift-refund.ts:24,54` usa
`Number(x.toFixed(2))`. Verificado en Node, **divergen**:

```text
-0.125  →  roundCurrency -0.12   toFixed(2) -0.13
 2.675  →  roundCurrency  2.68   toFixed(2)  2.67
 1.005  →  roundCurrency  1.01   toFixed(2)  1.00
```

`refundsTotalInBusinessCurrency` (con `toFixed`) alimenta `expectedAmount` en `close-shift.ts:499-501`, que
se redondea con `roundCurrency`: **los dos algoritmos conviven en el mismo número del arqueo**.

### Lo que NO existe

1. Catálogo de monedas (0 modelos de los 47 de `prisma/schema.prisma`).
2. Decimales por moneda: `format-currency.ts:26-27` fija 2 para todas; `Payment.amount` es `Decimal(10,2)`.
3. Historial de tasas (0 coincidencias de `rateHistory`/`exchangeRateHistory`).
4. Monedas personalizadas y alta de moneda desde el admin.
5. Aceptación multi-moneda configurable: el único interruptor es `LocationCashConfig.usdEnabled` (un booleano
   **de USD**, por sucursal) y, en el POS, `usdExchangeRate !== null`.
6. Tasa distinta de USD: `ConversionFailure` sólo conoce `"USD"` (`money-conversion.ts:13,34`).
7. **Congelado de la tasa en el hecho**: `usdExchangeRate` aparece **una sola vez** en `prisma/schema.prisma`
   (`:833`), en `BusinessSettings`.
8. Un `Intl.NumberFormat` con `style: "currency"`: `grep` → 0 coincidencias.
9. Un único traductor de `ConversionFailure` (hoy 5 copias con 4 redacciones distintas y 4 mensajes de campo
   idénticos repetidos).
10. Contrato anti-hardcode ampliado a `"NIO"`/`"USD"`/`"es-NI"`.

---

## Auditoría real — Payments

### Modelo persistido

`Payment` (`prisma/schema.prisma:856-894`, migración base `20260914130000`): `id`, `orderId`, `method`
(`PaymentMethodType`), `amount Decimal(10,2)`, `currency String?` (`null` = moneda del negocio), `tip
Decimal(10,2) @default(0)`, `changeAmount Decimal(10,2) @default(0)`, `reference String?`, `shiftId String?`,
`createdAt`, `voidedAt`, `voidedByUserId String?` (**no** es FK), `voidReason`. Relaciones `order`
(Cascade), `shift` (SetNull), `refunds`. Índices `[orderId]`, `[shiftId]`, `[createdAt]`. **Ningún `@@unique`**
más allá de la PK.

`Refund` (`:1208-1241`): `paymentId`, `orderId`, `shiftId?`, `kind`, `method`, `amount`, `currency`
(**NOT NULL**), `reason` (obligatorio), `status @default(pending)`, `requestedByUserId?`,
`approvedByUserId?`, `approvedAt?`, `createdAt`. Índices `[paymentId]`, `[orderId]`, `[shiftId,status]`,
`[status,createdAt]`. **Sin unique.**

**Campos que NO existen** (verificado campo por campo y en todas las migraciones): `exchangeRate`,
`baseAmount`, `baseCurrency`, `paymentMethodId` (no hay catálogo de medios), **`idempotencyKey`**,
`updatedAt`, `locationId`, `refundedAmount` (se deriva), `status`. En `Refund` faltan además `exchangeRate`,
`baseAmount` y `idempotencyKey`. **No existe ningún enum ni tabla de estado financiero del pedido.**

### Ciclo de vida, límite atómico e idempotencia

| Operación | Archivo | Puerta | Límite atómico | Idempotencia |
|---|---|---|---|---|
| Venta POS (alta + cobros) | `pos/features/register-pos-sale/**` | `canUsePOS` + `requirePosLocation` | `runInSaleTransaction` (`production-pos-sale.ts:74-131`) | **SÍ**: `Order.idempotencyKey @unique` + `reused` (`commit-sale.ts:103-105`) + reintento P2002 |
| **Cobrar pedido existente** | `orders/features/register-order-payment/**` | `canUsePOS` + `requirePosLocation` | `runInOrderPaymentTransaction` (`payment-composition.ts:123-136`), `lockOrder` → `lockShift` | **NO** → `A-71` |
| Anular cobro (void) | `orders/features/void-payment/**` | `canVoidPayment` (owner) en la ruta **y** en el caso de uso | `runInVoidPaymentTransaction` | **SÍ** por construcción: `WHERE voidedAt IS NULL` |
| Pedir devolución | `orders/features/refund/request-refund/**` | `canRefund` | **NINGUNO**: sin `$transaction`, adaptadores raíz (`refund-request-composition.ts:34-36`) | **NO** |
| Resolver devolución | `orders/features/refund/review-refund/**` | `canApproveRefund` (owner) | **NINGUNO** | **SÍ**: `WHERE status='pending'` |
| Cancelar pedido → devolución pendiente | `orders/features/update-order-status/update-order-status.ts:63-92` | según la ruta de estado | ninguno en el flujo de devolución | **NO** |
| Cierre de turno | `orders/features/shift/close-shift.ts` | `canManageCash` | `runInShiftTransaction` + `lockShift` | **SÍ**: el segundo cierre devuelve `null` |
| Checkout público | `orders/features/create-order/**` | pública | — | **SÍ** (`Order.idempotencyKey`) — **no crea `Payment`** |
| Seed | `prisma/seed.ts` | — | — | **no** crea `Payment` ni `Refund` |

### Estado financiero: no existe en ninguna capa

`grep` de `partial|paidAmount|outstandingAmount|paymentStatus|isPaid|paidInFull|financialState` en `src/**`
→ **0 coincidencias de producción** (sólo aserciones negativas en tests de Cocina: `kitchen-order-projection`
**debe** no tenerlos). Hay **tres saldos ad-hoc** y ninguno es el estado financiero:

| Sitio | Expresión |
|---|---|
| `register-order-payment.ts:125,127,133` | `alreadyPaid = summary.totalAmount` y `alreadyPaid + amount > order.total` |
| `update-order-status.ts:71` | `pending = payment.amount - refunded` |
| `request-refund.ts:85` | `remaining = payment.amount - alreadyRefunded` |

En React hay **una** suma de dinero multi-moneda: `pos-payment.tsx:104-107` (§ *A-69*).

### Invariantes de void/refund que YA están resueltas (y se conservan)

| Invariante | Dónde | Test que la fija |
|---|---|---|
| Void no es refund: la fila no se borra ni se edita | `payment-void.ts:1-13` | `void-payment.postgres.test.ts:106-146` |
| Sólo el dueño anula | `void-payment.ts:68` | `void-payment.test.ts:177` |
| Motivo obligatorio (3..200, texto libre) | `payment-void.ts:17-46` | `void-payment.test.ts:194` |
| No se anula con devolución **viva**; la rechazada sí libera | `void-payment.ts:100-110` | `void-payment.test.ts:237-252` |
| Dos anulaciones simultáneas: una sola firma | `WHERE voidedAt:null` | `void-payment.postgres.test.ts:170-205` |
| Un cobro anulado sale del arqueo, del saldo y de la conciliación | `prisma-payment-repository.ts:51` (`NOT_VOIDED`) | `void-payment.postgres.test.ts:106-168` |
| No se pide devolución de un cobro anulado | `request-refund.ts:73-77` | `request-refund.test.ts` |
| No se aprueba la devolución de un cobro anulado | `review-refund.ts:73-80` | `review-refund.test.ts` |
| No se devuelve más que el cupo | `request-refund.ts:79-94` | `request-refund.test.ts:226` |
| Nadie aprueba su propia devolución (nace `pending`) | `request-refund.ts:114-134` | `request-refund.test.ts` |
| Sólo devoluciones **aprobadas** y **en efectivo** restan del cajón | `shift-refund.ts:19-20` | `shift-refund.test.ts:39-60` |
| Actor + motivo auditados | `void-payment.ts:129-140` | `void-payment.postgres.test.ts:143` |

**Lo que void NO hace** (verificado, sin test): no mira el estado del turno (§ `A-76`), no mira la factura
emitida (§ `A-76`), no exige alcance por sucursal y no toma lock (se apoya en el `UPDATE` condicional).

### Concurrencia y locks

| Operación | Locks, en orden |
|---|---|
| Venta POS | `lockShift` → INSERT `Order` → INSERT `Payment`×N |
| Cobrar pedido existente | `lockOrder` → `lockShift` |
| Cierre de turno | `lockShift` → lee cobros, devoluciones y movimientos |
| Void / request refund / review refund | **ninguno** |

`FOR UPDATE` real en `prisma-order-repository.ts:206-215` y `prisma-shift-repository.ts:25-34`. **No hay
inversión de locks observable**: el único camino de dos locks es `Order → Shift` y ninguna operación toma
`Order` después de `Shift` sobre una fila compartida. `isolationLevel` **no se usa en ningún lado** (0
coincidencias): todo corre en `READ COMMITTED`.

### Tests de PostgreSQL existentes (12, y lo que NO cubren)

Existen `void-payment.postgres.test.ts`, `register-order-payment.postgres.test.ts`,
`register-pos-sale.postgres.test.ts`, `close-shift.postgres.test.ts`,
`shift-unattributed-payment.postgres.test.ts` e `emit-invoice.postgres.test.ts`. **No existe ningún
`*.postgres.test.ts` de devoluciones**: la atomicidad de `requestRefund`/`reviewRefund` **no está probada**
contra la base. Tampoco hay caso de moneda ni de idempotencia en el cobro de un pedido existente.

### Datos muertos detectados

- **`Payment.tip` es siempre 0 en producción**: ningún `createPayment` de producción lo pasa
  (`commit-sale.ts:219-233`, `register-order-payment.ts:162-172`) y `commit-sale.ts:189` fuerza
  `tipOptIn: false`. `getPaymentSummary.totalTip` y las ramas de propina de `shift-payment-mix.ts:85-91` sólo
  se ejercitan desde tests. La propina real vive en `Order.tipAmount` (§ `A-77`).
- `Payment.reference` se escribe y se lee **una sola vez** (CSV de conciliación).
- `voidedByUserId` es `String` sin FK.

---

## Reproducción de hallazgos (`A-68`, `A-69`, `A-71`)

### `A-68` — REPRODUCIDO

**`getPaymentSummary` tiene un único call site de producción**: `register-order-payment.ts:124`. Ahí **sí** se
compara contra `Order.total` (`:127`, `:133`) y **sí** pueden convivir monedas distintas (`Payment.currency`
es texto libre validado sólo por longitud, `payment-composition.ts:38`). La suma es **cruda**:
`_sum: { amount: true }` sobre `{orderId, voidedAt:null}` (`prisma-payment-repository.ts:165-173`) y
`reduce((sum, p) => sum + p.amount, 0)` en memoria (`in-memory-payment-repository.ts:142-144`). Ninguno
convierte, y `Payment` **no tiene** `baseAmount`/`exchangeRate` para convertir después.

`register-order-payment.ts:57-58` declara `businessCurrencyCode` y `usdExchangeRate` **y nunca los usa**.

**Ejemplo numérico** (pedido `total = 365.00 NIO`, `usdExchangeRate = 36.5`):

```text
POST /api/admin/orders/{id}/payment  {"method":"cash","amount":10,"currency":"USD"}
  :124 summary.totalAmount = 10      (crudo)
  :127 10 >= 365                      → falso
  :133 roundCurrency(10+10)=20 > 365  → falso
  → 201 y escribe Payment(amount=10.00, currency='USD')
  Realidad: 10 USD × 36.5 = C$365.00 → el pedido YA estaba cubierto.

POST /api/admin/orders/{id}/payment  {"method":"cash","amount":355,"currency":"NIO"}
  :124 alreadyPaid = 10              (crudo)
  :133 roundCurrency(10+355)=365 > 365 → falso
  → 201
Cobrado: US$10 + C$355 = C$730 equivalentes sobre un pedido de C$365 → SOBRE-COBRO de C$355.
```

**Variante cross-path, misma causa**: la venta del POS con `{currency:"USD", amount:10}` sobre un pedido de
365 **pasa** la comparación (convierte en memoria, `pos-sale.ts:61-73`) pero **persiste `amount: 10` crudo**
(`commit-sale.ts:221-231`), así que después el cobro del pedido existente ve «10 pagados» y deja cargar los
otros C$355. **Las dos puntas escriben crudo; la conversión sólo existe en memoria.** La solución es una
autoridad única Money/Payments, **no** copiar la lógica del POS al cobro.

### `A-69` — REPRODUCIDO en sus tres partes

- **(a)** `shift-refund.ts:41-50`: hardcodea `currency === "USD"` (`:44`), cierra con `.toFixed(2)` (`:54`) y
  lanza `Error` **genérico** (`:49`) donde el resto del módulo lanza `ShiftError`
  (`shift-payment-mix.ts:57`). La aritmética canónica existe y **no se usa**.
- **(b)** `request-refund.ts:128` y `update-order-status.ts:81` hardcodean `"NIO"` como moneda implícita de un
  `Payment.currency = null`, cuando el resto del repo resuelve el `null` con la moneda configurada
  (`shift-payment-mix.ts:51`, `payment-reconciliation.ts:48`, `close-shift.ts:453`, `pos-sale.ts:94`). Causa
  estructural: **ninguna de las dos composiciones carga `businessCurrencyCode`**
  (`refund-request-composition.ts:34-36` y `order-status-composition.ts:55-56` no importan
  `loadBusinessSettings`).
- **(c)** `pos-payment.tsx:104-107` suma `Number(payment.amount)` de **todas** las filas ignorando
  `payment.currency`, y `:246-253` lo formatea con la moneda del negocio. Con `10 USD + 355 NIO` a tasa 36.5
  muestra «Cobrado C$365.00» cuando el valor real es C$720.

**Duplicaciones adicionales medidas**: el mensaje de `missing-rate` tiene **4 redacciones distintas** y **4
mensajes de campo idénticos** repetidos; el de moneda no soportada tiene **3 redacciones** («no se cobra en»,
«no se cuenta en», «este local no cuenta en»); el formato «otra moneda con su código» está escrito **7
veces**; y la igualdad de moneda con `toUpperCase()` está reimplementada en **≥20 lugares**.

### `A-71` — REPRODUCIDO (request-level)

`Payment` **no tiene `idempotencyKey`** (no está en el modelo ni en ninguna migración aditiva ni en ningún
índice), y el payload del POST tampoco lo acepta (`payment-composition.ts:33-42` = `{method, amount, currency,
reference, terminalId}`). El contraste es exacto: `sale-payload.ts:75` **sí** tiene
`idempotencyKey: z.string().trim().min(1).max(80)` y `Order.idempotencyKey` es `@unique`.

```text
POST /api/admin/orders/{id}/payment  {"method":"cash","amount":100,"currency":"NIO"}   (total = 365)
1.º → 201, crea Payment(100)
2.º (mismo cuerpo) → 100 >= 365 falso; 100+100=200 > 365 falso → 201, crea OTRO Payment(100)
Resultado: C$200 cobrados por un request repetido. El hueco es exactamente el cobro PARCIAL.
```

La solución runtime es **idempotencia durable con garantía de base de datos** (clave + índice único +
recuperación del conflicto **fuera** de la transacción, por `25P02`: `money-change` § CONCURRENCIA), **no** un
bloqueo de UI. El test que la fija corre contra **PostgreSQL real**.

---

## Auditoría — Cash, Invoices y entidades de cobro (boundaries)

### Cash — qué NO se mueve

**Cash deja de ser el dueño de nada financiero que no sea caja.** Sigue siendo dueño de: `Shift`, la caja
física, apertura y cierre, conteos (`ShiftCashCount`), movimientos (`CashMovement`), arqueo, diferencias
(`Shift.differenceAmount`), terminales (`PosTerminal`) y **los snapshots de cierre** (`Shift.expectedAmount`,
`expectedByCurrency`, `cashSalesAmount`, `cashMovementsAmount`, `refundsAmount`, `paymentMix`,
`ShiftBankClose`). Evidencia: `orders/domain/shift-*.ts`, `orders/features/shift/**`,
`pos/domain/shift-close-policy.ts`, `pos/features/close-pos-shift/**`, `cash-config/**`.

Lo que **sí** le corresponde a Payments y hoy vive en `orders` porque `orders` es el módulo sobrecargado:
`Payment`, su saldo, su void y su devolución como hecho financiero. **`Shift` no se mueve a Payments.**

**Cómo consume Cash los hechos de cobro** (esto se conserva): `listPaymentsByShift` +
`listUnattributedPaymentsInRange` (`close-shift.ts:361-362`), `summarizeShiftPayments`
(`shift-payment-mix.ts`), `refundsTotalInCurrency` (`shift-refund.ts`), `refundRepository` y
`cashMovementRepository`. Con **una sola corrección de boundary**: esas lecturas pasan a pedir el **total en
moneda base** a `payments`/`money` en vez de convertir por su cuenta.

**Lo que Cash consume y NO debe recalcular**: la conversión de un cobro extranjero
(`shift-cash.ts:160,256,320` y `shift-payment-mix.ts:56` la reimplementan), el redondeo de las devoluciones
(`shift-refund.ts:24,54`) y la igualdad de moneda (`toUpperCase()` en ≥20 lugares).

### Invoices — el contrato futuro

`emit-invoice.ts:161-164` decide con `canEmitInvoiceFor({ status, hasPayments: countPayments(...) > 0 })`, y
`production-invoice.ts:29` cuenta filas. **`Invoice` no define por sí misma qué significa «pagado»**: hereda
la definición de un conteo. Consecuencia reproducida: un pedido de `total = 365` con **un solo cobro de 100**
**factura** (y la factura congela `total: 365`).

**Contrato objetivo**: `Invoices consume Payments`. La puerta pasa a ser el **estado financiero canónico**
(`paid`), no `hasPayments`. `Invoice` **mantiene** su snapshot completo (`currencyCode`, `subtotal`,
`discount`, `packagingAmount`, `deliveryFeeAmount`, `tipAmount`, `total`, datos del negocio, del cliente y de
la sucursal), y **no** se rehace. La reforma fiscal queda **fuera** (`A-34`, decisión del owner).

### Entidades de cobro — se reutiliza `banks`

**Lo que existe** (`prisma/schema.prisma:1075-1110`): `Bank` (`name @unique`, `code @unique?`, `isActive`,
`sortOrder`) y `LocationBank` (`locationId`, `bankId`, `isActive`, `sortOrder`,
`@@unique([locationId, bankId])`). Casos de uso `get-bank-catalog` / `save-bank-catalog` con validación de
código duplicado (`bank-catalog.ts`), ruta `GET|PUT /api/admin/cash/banks` con `requireBankCatalogScope`, y UI
`cash-banks-section.tsx` dentro de `/admin/cash/config`. `replaceCatalog` **no borra**: apaga (`isActive:
false`) para no perder la historia.

**Lo que NO existe**: que `Bank` declare **qué clase de entidad es** (banco / adquirente / proveedor digital /
otro); ningún vínculo entre `Bank` y un medio de pago (porque el catálogo de medios no existe); y `PosTerminal`
**es una tabla propia a propósito** (`prisma/schema.prisma:896-902`: una estación puede tener dos posnets y un
banco puede estar en dos estaciones — son dos dimensiones).

**Decisión de esta TASK**: **no se crea un catálogo bancario paralelo**. Se **amplía `Bank`** con un
**tipo de entidad** (`bank` / `acquirer` / `digital_provider` / `other`, configurables en las tres primeras y
`other` como escape) y se lo relaciona con el catálogo de medios de pago cuando ese catálogo exista. La
relación con el arqueo (`ShiftBankClose.bankId`, `@@unique([shiftId, bankId, currency])`) **no cambia**.
`LocationBank` **se mantiene** como la asignación entidad↔sucursal y es el patrón que el medio↔local reusa.

---

## Matriz `REUSE / MOVE / ADAPT / CONSOLIDATE / NEW / MISSING / OUT`

| Pieza | Clase | Destino / motivo |
|---|---|---|
| `shared/lib/money-conversion.ts` (`convertToBusinessCurrency`) | **REUSE** | Único algoritmo de conversión; pasa a `money`, sin cambiar la aritmética |
| `SUPPORTED_FOREIGN_CURRENCY` | **MOVE** | De constante de algoritmo a **dato de configuración** (`money`) |
| `shared/lib/order-totals.ts` (`roundCurrency`) | **MOVE** | Único redondeo de dinero; va a `money` y `order-totals` lo importa |
| `shared/lib/format-currency.ts` (`formatCurrency`) | **ADAPT** | Gana el **código** de la moneda en `CurrencyFormat` (hoy sólo `symbol`+`locale`) |
| `shared/lib/business-settings.tsx` (`useCurrencyFormat`) | **REUSE** | Única traducción config→formato en el cliente |
| `shared/lib/shift-sheet-format.ts` (`sheetCurrencyFormat`, `formatSheetAmount`) | **REUSE** | Es la forma ya centralizada; absorbe las otras 6 copias |
| 7 copias del formato «otra moneda con su código» | **CONSOLIDATE** | Una sola función en `money` |
| `pos/domain/payment-conversion.ts` | **MOVE** | Error del POS sobre la aritmética de `money`; el mensaje sale de un único origen |
| 5 traductores de `missing-rate`/`unsupported-currency` (`shift-cash.ts:160,256,320`, `shift-payment-mix.ts:56`, `close-shift.ts:318`) | **CONSOLIDATE** | Un traductor parametrizado por superficie |
| `orders/domain/shift-refund.ts:31-56` | **CONSOLIDATE** | Deja de tener conversión propia, `"USD"` propio y `toFixed`; usa `money` |
| `Number(x.toFixed(2))` (`shift-refund.ts:24,54`) | **CONSOLIDATE** | Sobre `roundCurrency` |
| Igualdad de moneda con `toUpperCase()` (≥20 lugares) | **CONSOLIDATE** | Un predicado único en `money` |
| `business-settings-defaults.ts:70-75` | **REUSE** | Única fuente legítima de los literales por defecto (NIO, C$, es-NI) |
| `business-settings.schema.ts:184-212` | **ADAPT** | Valida forma; pasa a validar **existencia** contra el catálogo |
| `BusinessSettings.currencyCode/currencySymbol/locale/usdExchangeRate` (columnas) | **ADAPT** | Se conservan como **compatibilidad**; la autoridad pasa a `money` (§ *Estado financiero* y § *Legacy*) |
| `cash-config-defaults.ts:16,30` (`BASE_CASH_CURRENCY`, `KNOWN_CASH_CURRENCIES`) | **CONSOLIDATE** | Salen: la moneda del negocio y las contables se leen del catálogo |
| `cash-config/domain/cash-count-config.ts:25-44` | **ADAPT** | El modelo «qué monedas cuenta la sucursal» sirve; la lista cerrada no |
| `cash-config-defaults.ts:24-27` + `CashDenomination` | **REUSE** | Denominaciones por moneda: correcto, con `isActive` sin borrado |
| `cash-config.schema.ts:20-25` | **ADAPT** | Valida 3 letras; pasa a validar contra el catálogo |
| `app/(admin)/admin/cash/config/cash-config-client.tsx:26,85` | **ADAPT** | Deja de tener `BASE_CURRENCY`/`"USD"` fijos |
| `pos-payment.tsx:169`, `pos-payment-rows.tsx:147` (`{value:"USD"}`) | **ADAPT** | Las monedas del cobro salen de la configuración |
| `app/(admin)/admin/cash/cash-close-modal.tsx:140-157` | **MOVE** | La conversión de la diferencia corre hoy en el navegador; el servidor ya la calcula |
| `cash-close-modal.tsx:390-411` (`formatByList`, `signedCurrency`) | **MOVE** | Helpers de dinero viviendo en un modal |
| `admin-overview-formatters.ts:1,6,10` (`"es-NI"` × 3) | **CONSOLIDATE** | Sobre `settings.locale` |
| `pos/pos-quick-cash.tsx:13` (`POS_QUICK_CASH_AMOUNTS`) | **ADAPT** | Decisión del owner: no se configura; pero hoy está atado a NIO |
| Modelo `Payment` | **ADAPT** | Gana `exchangeRate`/`baseAmount`/`baseCurrency` e `idempotencyKey` (aditivo, nullable) |
| Modelo `Refund` | **ADAPT** | Ya congela `currency`; gana tasa/base e idempotencia |
| `PaymentMethodType`, `RefundKind`, `RefundStatus` | **REUSE** | Enums correctos; se mueven con el modelo |
| `PaymentMethod` (`Order.paymentMethod`) | **OUT** | Es la declaración del cliente en Pedidos, no un hecho de cobro |
| `PaymentRepository` (puerto) + adaptador Prisma + in-memory | **MOVE** | Contrato completo y correcto; pasa a `payments` |
| `PaymentSummary` | **ADAPT** | `totalAmount` crudo pasa a **total en moneda base** (o por moneda) |
| `getPaymentSummary` | **ADAPT** | Cierra `A-68` |
| `registerOrderPayment` + composición + ruta | **ADAPT** | Cierra `A-68` y `A-71`; pasa a `payments` |
| `recordSalePayments` (`commit-sale.ts:202-236`) | **ADAPT** | Sigue escribiendo el monto **recibido**, pero **con** la tasa del momento |
| `paymentsTotalInBusinessCurrency` / `recordedPaymentsTotalInBusinessCurrency` | **MOVE** | Es la regla monetaria canónica y hoy vive en `pos` |
| `orders/domain/payment-change.ts` | **REUSE** | Regla de vuelto correcta y con una sola fuente |
| `orders/domain/payment-reconciliation.ts` | **MOVE** | Dominio correcto (por moneda, sin efectivo) pero es de Caja |
| `orders/domain/shift-payment-mix.ts` | **MOVE** | Desglose correcto y con conversión; es de Caja |
| `payments` (módulo: `Payment`, saldo, estado, idempotencia, snapshots) | **NEW** | Módulo objetivo §4.1; hoy repartido en `orders`+`pos` |
| `money` (módulo: catálogo, moneda base, FX, conversión, historial) | **NEW** | Módulo objetivo §4.1; hoy repartido en `shared/lib`+`business-settings`+`pos`+`cash-config` |
| `cash` (módulo) | **NEW** (orden 7) | **no** en esta TASK ni en la próxima: Cash ownership es el orden 7 |
| Catálogo de monedas (tabla) | **NEW** | No existe ningún modelo de moneda |
| Tasa por par con vigencia e historial (tabla) | **NEW** | No existe: un `Float?` sin fecha |
| Snapshot de tasa en `Payment`/`Shift` | **NEW** | No existe: por eso el pasado no se explica |
| Catálogo de medios de pago (tabla) con tipo canónico y monedas | **NEW** | No existe: `PaymentMethodType` es un enum |
| Tipo de entidad en `Bank` | **ADAPT** | Amplía el catálogo existente; **no** crea uno paralelo |
| `pending`/`partial`/`paid` + `paidAmount` + `outstandingAmount` | **NEW** (proyección) | No existe en ninguna capa |
| Idempotencia del cobro (`idempotencyKey` + índice único) | **NEW** | El pedido la tiene; el cobro no (`A-71`) |
| Ruta `/admin/finance` + navegación + tres vistas | **NEW** | No existe la superficie (§ SPEC) |
| `runInOrderPaymentTransaction`, `runInVoidPaymentTransaction`, `runInSaleTransaction`, `runInShiftTransaction` | **CONSOLIDATE** | Cuatro runners casi idénticos (mismo `timeout:15s`/`maxWait:10s`) |
| `lockOrderRow` / `lockShiftRow` | **REUSE** | Primitivas correctas, compartidas por los cuatro caminos |
| `voidPayment` + `payment-void` + ruta `/api/admin/payments/[id]/void` | **MOVE** | Invariantes completas y probadas contra PostgreSQL |
| `requestRefund` / `reviewRefund` / `RefundRepository` (puerto + adaptadores) | **MOVE** | Correctos en regla; les falta el límite atómico (§ `A-73`) |
| Devolución pendiente al cancelar (`update-order-status.ts:63-92`) | **ADAPT** | `"NIO"` hardcodeado y sin transacción |
| `canEmitInvoiceFor` / `countPayments` | **ADAPT** | Pasa a consumir el estado financiero canónico |
| `Invoice` (snapshot completo) | **REUSE** | No se rehace |
| `Shift` y todo el arqueo/conteo/cierre/terminal | **REUSE** | **No se mueve a Payments** |
| `Bank` / `LocationBank` / `get-bank-catalog` / `save-bank-catalog` / ruta y UI | **REUSE** | Se amplía el tipo, no se reconstruye |
| `PosTerminal` | **REUSE** | Es una dimensión propia a propósito |
| `Payment.tip` + `getPaymentSummary.totalTip` + ramas de propina del mix | **OUT** | Nunca se escribe ≠ 0 en producción (§ `A-77`) |
| `dashboard` restando `Refund.amount` crudo | **ADAPT** | Ignora `refund.currency` (§ `A-74`) |
| Proyección de Cocina | **OUT** | Excluye dinero y estado financiero a propósito |
| Delivery zones y reservas (formato con `"$"`, `"es-NI"` fijo) | **OUT** | Fuera del MVP |
| CSV de conciliación | **OUT del subsistema Money** | Formatea con lo que recibe; no convierte ni suma |

---

## Matriz de ownership definitiva

| Agregado / capacidad | Dueño **hoy** | Dueño **objetivo** | Puerta objetivo |
|---|---|---|---|
| `Payment` (el cobro) | `orders` | **`payments`** | `canCollectPayment` (cobrar) |
| Estado financiero del pedido (`pending`/`partial`/`paid`, `paidAmount`, `outstandingAmount`) | no existe | **`payments`** | `canViewOrderFinancials` |
| Void de un cobro | `orders` | **`payments`** | `canVoidPayment` (owner, ya existe) |
| `Refund` (hecho financiero) | `orders` | **`payments`** | `canRequestRefund` (pedir) · `canApproveRefund` (firmar, owner) |
| Flujo de aprobación de devolución | `orders` + `auth` | **`payments`** (el hecho) compuesto con **`auth`** (la firma) y **`audit`** | las dos anteriores |
| Idempotencia del cobro | no existe | **`payments`** | la del cobro |
| Snapshot monetario de `Payment`/`Refund` | no existe | **`payments`** (lo congela) · **`money`** (define qué se congela) | — |
| Catálogo de monedas · moneda base · monedas aceptadas | `business-settings` (parcial) | **`money`** | `canManageFinanceConfig` |
| FX: tasa, vigencia e historial | `business-settings` (un escalar) | **`money`** | `canManageFinanceConfig` |
| Conversión y redondeo | `shared/lib` + 5 copias | **`money`** | — (regla pura) |
| Formato monetario y locale | `shared/lib` + 7 copias | **`money`** (la regla) · `shared/lib` (el render) | — |
| Catálogo de medios de pago y su tipo canónico | no existe (enum) | **`payments`** | `canManageFinanceConfig` |
| Entidades de cobro (`Bank`, `LocationBank`) y su tipo | `banks` | **`banks`** (se amplía) | `canManageFinanceConfig` |
| Asignación entidad↔sucursal | `banks` + `locations` | **`banks`** (el vínculo) · `locations` (la sucursal) | `canManageFinanceConfig` |
| `Shift`, caja física, apertura/cierre, conteos, movimientos, arqueo, diferencias, terminales, snapshots de cierre | `orders` + `pos` | **`cash`** (orden 7 del roadmap; **no** en la próxima TASK) | `canUsePOS` (operar) · `canManageCash` (administrar) |
| Reglas del arqueo (monedas, denominaciones, terminales) | `cash-config` | **`cash-config`** (consume `money` para las monedas) | `canManageCashConfig` |
| `Invoice` (documento y snapshot) | `invoices` | **`invoices`** — **consume** el estado financiero de `payments` | `canUsePOS` (emitir) · owner (anular) |
| `Order`, items y ciclo de vida | `orders` | **`orders`** — **consume** el estado financiero, **no lo posee** | `canViewOrders` |
| Proyección de Cocina | `orders` (proyección) | **`orders`** (proyección, sin dinero) | `canOperateKitchen` |
| Read models de Pedidos | `orders` | **`orders`** (no son dominio) | `canViewOrders` · `canViewOrderFinancials` |
| `BusinessSettings` (marca, contacto, horarios, propina) | `business-settings` | **`business-settings`** — **pierde** las columnas de dinero cuando `money` exista | `canManageBusinessSettings` (marca) · `canManageFinanceConfig` (dinero) |
| Definición de «pagado» | repartida (factura por conteo, POS por suma cruda, detalle por `length > 0`) | **`payments`**, un solo caso de uso | el de la proyección |

**Regla de cruce** (sin cambios): cuando una superficie necesita datos de otro módulo, **consume** sus casos
de uso; **no** reimplementa su regla. `Orders` **no vuelve a ser dueño** de `Payment`, y `Invoices` **no**
define «pagado».

---

## Modelo conceptual de moneda, tasa e historial

```text
Currency                     (catálogo: lo que el sistema CONOCE)
  code            text, único, normalizado a mayúsculas  ← puede ser un código interno (moneda personalizada)
  name            text
  symbol          text
  decimals        int   (0..4)     → reemplaza el "2 decimales fijos" de format-currency
  isKnown         bool             → true = del catálogo conocido (conveniencia), false = personalizada
  isActive        bool             (baja lógica: nunca se borra, los hechos viejos la siguen nombrando)
  sortOrder       int

BusinessCurrencySettings     (una sola fila: la autoridad ACTUAL)
  baseCurrencyCode    text  → FK lógica a Currency
  locale              text
  → Cuál es la moneda base NO es una columna editable de Currency: es esta fila.

ExchangeRate                 (historial: cada tasa es un HECHO con fecha)
  id                text
  fromCurrencyCode  text   → habitualmente la moneda extranjera
  toCurrencyCode    text   → la moneda base VIGENTE al momento del registro
  rate              decimal (precisión explícita, no Float)
  effectiveFrom     timestamp
  effectiveTo       timestamp?  (null = vigente)
  createdByUserId   text?
  createdAt         timestamp
  @@unique([fromCurrencyCode, toCurrencyCode, effectiveFrom])
  → Registrar una tasa NUEVA cierra la anterior (effectiveTo) y agrega una fila. NO actualiza in place.
```

**Reglas conceptuales que el runtime debe respetar**:

1. **Una moneda no se borra**: se apaga (`isActive`). Un `Payment` de 2026 sigue nombrando una moneda que
   puede estar inactiva hoy.
2. **La moneda base es una operación, no un campo**: cambiarla abre un nuevo período; **no** reescribe ningún
   hecho. El historial de tasas guarda contra qué moneda base se registró cada tasa
   (`toCurrencyCode`) — **por eso** un cambio de base no reinterpreta el pasado.
3. **`decimals` es del catálogo**, no del formateador: formatear con 2 decimales una moneda de 0 es un bug de
   presentación, y guardar `Decimal(10,2)` una moneda de 3 decimales es un bug de dinero.
4. **La tasa es un hecho con fecha**, no un valor mutable: sin fecha no se puede explicar el pasado.
5. **El `null` de `Payment.currency` significa «la moneda del negocio»**, y esa resolución la hace `money`,
   **no** cada consumidor con `?? "NIO"`.
6. **El catálogo conocido es conveniencia**: una moneda personalizada con código interno es válida, y por eso
   el contrato no puede ser «ISO de 3 letras».

---

## Modelo conceptual del snapshot de `Payment`

Un `Payment` **nuevo** debe poder responder **para siempre** (ley 7) sin consultar la configuración de hoy:

| Pregunta | Campo objetivo | Existe hoy |
|---|---|---|
| ¿Cuánto se recibió? | `amount` | **SÍ** |
| ¿En qué moneda entró? | `currency` (nunca `null` en un cobro nuevo) | **PARCIAL**: `String?` |
| ¿Cuál era la moneda base? | `baseCurrencyCode` | **NO** |
| ¿Qué tasa se aplicó? | `exchangeRate` (decimal, no `Float`) | **NO** |
| ¿Cuánto equivale en moneda base? | `baseAmount` | **NO** |
| ¿Con qué medio se pagó? | `paymentMethodId` (catálogo) **+** `methodKind` (el tipo canónico del momento) | **NO**: sólo el enum `method` |
| ¿Cuál era el tipo semántico? | `methodKind` (`cash`/`card`/`bank_transfer`/`wallet`/`other`) | **NO** |
| ¿Contra qué entidad/proveedor? | `entityId` (nullable: efectivo no tiene entidad) | **NO** |
| ¿Con qué referencia externa? | `reference` | **SÍ** |
| ¿En qué turno entró? | `shiftId` | **SÍ** |
| ¿Cuándo? | `createdAt` | **SÍ** |
| ¿Se anuló o se devolvió? | `voidedAt`/`voidedByUserId`/`voidReason` + `Refund` | **SÍ** |
| ¿Cuánto vale un reintento de la misma request? | `idempotencyKey` (único por cobro) | **NO** |

**Congelar los dos campos del medio** (`paymentMethodId` **y** `methodKind`) es deliberado: el medio
comercial se configura y puede cambiar de nombre, de monedas o de tipo; el **hecho** tiene que seguir
explicando con qué semántica contable entró esa plata. Es el mismo criterio por el que `Invoice` congela el
nombre del negocio y el `Shift` congela su `expectedByCurrency`.

**Snapshots que también hay que cerrar** (mismo problema, fuera de `Payment`): `Shift` congela sus montos
pero **no** la tasa que los produjo; `Refund` congela `currency` y **no** la tasa; el reintento idempotente
del POS re-suma los `Payment` guardados con la **tasa vigente** (`pos-sale.ts:84-102` ←
`register-pos-sale.ts:173`), no con la del cobro.

---

## Contrato de estado financiero canónico

**Un caso de uso, un dueño, una moneda.**

```text
OrderPaymentStatus                        (proyección de payments, NO un campo de Order)
  orderId            text
  status             "pending" | "partial" | "paid"
  paidAmount         decimal     ← suma de los cobros NO anulados, convertidos a moneda base
  outstandingAmount  decimal     ← max(0, orderTotal − paidAmount)
  baseCurrencyCode   text        ← la moneda en la que están expresados los dos montos
  paymentCount       int         ← cobros activos (el detalle que necesitan los consumidores)
  hasMixedMethods    bool        ← DERIVADO: >1 medio distinto. `mixed` NO es un medio real
```

**Reglas del contrato**:

1. **`status` se deriva del saldo, no del conteo**: `paid` ⇔ `outstandingAmount == 0`;
   `partial` ⇔ `0 < paidAmount < orderTotal`; `pending` ⇔ `paidAmount == 0`. **Prohibido** derivarlo de
   `payments.length > 0`.
2. **`paidAmount` se calcula en moneda base**, convirtiendo cada cobro con **su** tasa snapshot (o la
   vigente si el cobro es legacy sin tasa — § *Legacy*). **Prohibido** sumar montos de monedas distintas.
3. **La proyección es de `payments`**, no de `orders` ni de `invoices`: `orders` la **consume** y **no** la
   recalcula.
4. **Un cobro anulado no cuenta** (invariante ya resuelta, `A-59`): `voidedAt IS NULL` en la base.
5. **Una devolución aprobada no cambia `paidAmount`**: el cobro existió. La devolución es un hecho propio
   (`Refund`) y se informa aparte. Lo que cambia «pagado» es la **anulación**, no la devolución.
6. **Los consumidores**:
   - **`orders`** (listado y detalle): muestra `status` y saldo; **no** lo calcula. El detalle deja de mostrar
     «Cobrado en el mostrador» con `payments.length > 0` (`orders/[id]/page.tsx:345`).
   - **`invoices`**: `canEmitInvoiceFor` **deja de usar `hasPayments`** y pasa a exigir el **estado
     liquidado**. Qué estado exacto (¿`paid` estricto, o `partial` con autorización?) lo decide el owner en la
     TASK de runtime: esta fundación deja el **cambio** como dependencia declarada, **no** adelanta la reforma
     fiscal.
   - **React**: **prohibido** calcular `pending`/`partial`/`paid`. Hoy hay un caso (`pos-payment.tsx:104-107`)
     que suma crudo y **desaparece** consumiendo la proyección.
   - **Cocina**: sigue **sin** dinero: la proyección de cocina **no** gana estos campos (los tests negativos
     de `list-kitchen-orders.test.ts:39-40` se conservan).

---

## Contrato de idempotencia y concurrencia para cobros

**Límite atómico** (una operación lógica de dinero = una transacción, `money-change` § TRANSACCIÓN):

| Operación | Transacción | Locks, en orden | Idempotencia objetivo |
|---|---|---|---|
| Cobrar (venta POS) | `runInSaleTransaction` | `Shift` → INSERT `Order` → `Payment`×N | `Order.idempotencyKey` @unique (**ya existe**) |
| Cobrar (pedido existente) | `runInOrderPaymentTransaction` | **`Order` → `Shift`** | **`Payment.idempotencyKey` @unique** (nuevo) |
| Anular cobro | `runInVoidPaymentTransaction` | ninguno (UPDATE condicional) | **ya resuelto**: `WHERE voidedAt IS NULL` |
| Pedir devolución | **hay que crearla** | `Payment` (FOR UPDATE) | **clave de idempotencia en `Refund`** (nuevo) |
| Resolver devolución | **hay que crearla** | `Payment` (FOR UPDATE) | **ya resuelto**: `WHERE status='pending'` |
| Cerrar turno | `runInShiftTransaction` | `Shift` | **ya resuelto**: el segundo cierre no firma |

**Reglas**:

1. **La idempotencia la garantiza la BASE, no la UI**: `idempotencyKey` + **índice único**. Un bloqueo de
   botón no es idempotencia.
2. **El alcance de la clave es el cobro, no el pedido**: dos cobros parciales **legítimos** deben poder
   coexistir (dos claves distintas), y el **mismo** request repetido debe producir **uno solo**.
3. **La clave la genera el cliente** (la pantalla) y viaja en el body; el servidor **no** la inventa.
4. **`P2002` no se recupera adentro de la transacción** (`25P02` aborta): se devuelve el conflicto, se
   **rehace la transacción** y en el intento nuevo la lectura encuentra la fila existente
   (`money-change` § CONCURRENCIA, `TASK-AUD-004`).
5. **Serialización del saldo**: dos cobros simultáneos del mismo pedido se serializan con
   `lockOrderRow` (`SELECT … FOR UPDATE`) **y** el tope se compara contra el total **leído dentro del lock**
   (hoy se compara contra el `total` leído **fuera** y el que devuelve el lock se descarta:
   `register-order-payment.ts:87` vs `:116`).
6. **Orden de locks único**: `Order` → `Shift`. Prohibido tomar `Order` con `Shift` ya tomado.
7. **Aislamiento**: `READ COMMITTED` (el default del repo, que hoy no declara `isolationLevel` en ningún
   lado) es suficiente **si** toda invariante se apoya en lock explícito o en un `UPDATE` condicional; la
   verificación va contra **PostgreSQL real** (`*.postgres.test.ts`), nunca contra un doble en memoria.

**El test rojo del runtime** (cobro de un pedido existente con cobro **parcial** repetido): el segundo POST
con la misma clave devuelve el **mismo** `Payment` y la suma no cambia. Hoy: crea un segundo `Payment`
(`A-71`).

---

## Boundary `Payments` ↔ `Cash`

```text
PAYMENTS (dueño)                         CASH (dueño)
─────────────────────────────            ─────────────────────────────
Payment (el cobro)                       Shift (turno, apertura, cierre)
Estado financiero del pedido             Caja física: conteos (ShiftCashCount)
Void de un cobro                         Movimientos (CashMovement)
Refund (hecho financiero)                Arqueo: esperado, contado, diferencia
Idempotencia del cobro                   Terminales (PosTerminal)
Snapshots monetarios del cobro           Snapshots de cierre (expectedByCurrency,
                                         cashSalesAmount, refundsAmount, paymentMix,
                                         ShiftBankClose)
─────────────────────────────            ─────────────────────────────
         └──► Cash CONSUME hechos de cobro ◄──┘
```

**Reglas del boundary**:

1. **`Shift` no se mueve a Payments** y Payments **no** escribe en `Shift` (salvo la atribución
   `Payment.shiftId`, que ya existe y es correcta).
2. **Cash no convierte ni suma monedas**: pide el total (o el desglose) a `money`/`payments`. Hoy lo
   reimplementa en `shift-cash.ts:160,256,320`, `shift-payment-mix.ts:56` y `shift-refund.ts:31-56`.
3. **Un cobro anulado no entra al arqueo** (ya resuelto, `A-59`): la lectura de Cash ya no lo devuelve.
4. **Un turno cerrado no recibe cobros nuevos** (ya resuelto, `A-47`): el lock del turno lo garantiza en los
   dos caminos de cobro.
5. **Un cierre no se recalcula**: sus snapshots son del momento; la tasa que los produjo **se agrega al
   snapshot** (hoy no está, § *Modelo conceptual*).
6. **El arqueo ciego es regla de servidor** (`A-45`, ya resuelto): sigue siéndolo; esta TASK no lo toca.

---

## Boundary `Payments` ↔ `Invoices`

| | |
|---|---|
| **Hoy** | `emit-invoice.ts:161-164` decide con `hasPayments` = `countPayments(...) > 0`; `production-invoice.ts:29` cuenta filas. Un pedido de C$365 con un cobro de C$100 **factura** |
| **Objetivo** | `Invoices consume Payments`: la puerta es el **estado financiero canónico**, y `Invoice` **no** define «pagado» |
| **Lo que no cambia** | El snapshot completo de `Invoice` (`currencyCode`, montos, datos del negocio, del cliente y de la sucursal), su correlativo con concurrencia real (`TASK-AUD-006`), su anulación con motivo de lista cerrada y su `orderId @unique` |
| **Dependencia declarada** | El cambio de la puerta es **runtime de Payments** (la TASK siguiente), **no** de esta fundación. La **reforma fiscal** (`A-34`: RUC del negocio, numeración autorizada) es **decisión del owner** y **no** se adelanta |
| **Riesgo de la transición** | Facturar un pedido con saldo pendiente es una decisión de producto, no técnica: **Stop Condition** si el owner no la define antes del runtime (§ *Stop Conditions*) |

---

## Estrategia legacy, sin backfill inventado

**Principio**: el pasado no se reconstruye (`AGENTS.md` ley 7). Un dato legacy se **declara**, no se inventa.

| Dato legacy | Situación hoy | Trato objetivo |
|---|---|---|
| `Payment.currency IS NULL` | Cobros anteriores a `TASK-303b` | **Sigue significando «la moneda del negocio»**, y esa resolución la hace `money`. **No** se escribe la moneda hacia atrás con un `UPDATE` |
| `Payment` sin `exchangeRate`/`baseAmount`/`baseCurrency` | Todos los cobros existentes | Las columnas nacen **nullable** y **no se rellenan**. Un consumidor que necesita el equivalente usa la **tasa vigente** y **lo declara** («tasa vigente, no la del cobro»), porque la del cobro **no existe** |
| `Payment.baseAmount` nulo | ídem | `paidAmount` de la proyección se calcula **siempre** por conversión en lectura para los legacy; **nunca** se persiste un valor inventado |
| `Shift` sin la tasa de su cierre | Todos los cierres existentes | Igual: se declara. Los cierres firmados **no se re-firman** |
| `Refund` sin tasa | Todas las devoluciones | Igual |
| `Bank.code` nulo | Bancos cargados sin código | **Sigue siendo válido** (`bank-catalog.ts:56`): la entidad no necesita código |
| Tipo de entidad de un `Bank` existente | No existe | **`other`** por defecto (explícito), **no** una inferencia por nombre («BAC» **no** implica `acquirer`) |
| `Payment.method = 'mixed'` | Puede existir en la base | **Se conserva y se muestra tal cual era**: no se reescribe el pasado. `mixed` deja de ser **elegible** hacia adelante |
| `BusinessSettings.currencyCode` | La autoridad actual | Se conserva como **compatibilidad** hasta que `money` tenga el catálogo; la migración **copia** el valor a la fila de moneda base (es una **migración de datos de configuración**, no una reinterpretación de hechos) |
| Duplicados legacy (`A-50`: ventas con menos `Payment` que los declarados) | `A-50` sigue abierto | **No se reparan**. Un conteo de solo lectura es decisión del owner. Esta TASK **no** los toca |

**Prohibiciones explícitas**: backfill de montos, de tasas o de monedas; `UPDATE` masivo sobre `Payment`/
`Refund`/`Shift`; inferir el tipo de una entidad por su nombre; «arreglar» un cierre firmado; recalcular un
cierre histórico con la tasa de hoy.

---

## Migraciones runtime necesarias (enumeradas, **NO creadas**)

Todas **aditivas primero** y **sin BOM** ([`database-migration`](../../.agents/skills/database-migration/SKILL.md)).
Ninguna se crea en esta TASK.

| # | Migración | Aditiva | Nullable / default | Nota |
|---|---|---|---|---|
| 1 | `add_currency_catalog` — tabla `Currency` (`code` único, `name`, `symbol`, `decimals`, `isKnown`, `isActive`, `sortOrder`) | Sí | `isActive true`, `sortOrder 0` | **Semilla** con las monedas que el negocio ya usa (NIO desde `BusinessSettings`, USD desde `usdExchangeRate`), no con un catálogo mundial inventado |
| 2 | `add_business_currency_settings` — fila de moneda base + locale | Sí | — | Copia `BusinessSettings.currencyCode`/`locale`; **no** borra las columnas viejas en esta migración |
| 3 | `add_exchange_rate_history` — tabla `ExchangeRate` (`from`/`to`, `rate`, `effectiveFrom`, `effectiveTo?`, `createdByUserId?`, `@@unique([from,to,effectiveFrom])`) | Sí | `effectiveTo?` | **Semilla**: la `usdExchangeRate` vigente **si existe**, con `effectiveFrom = now()` **declarado** (no una fecha histórica inventada) |
| 4 | `add_payment_snapshot` — `Payment.exchangeRate decimal?`, `Payment.baseAmount decimal?`, `Payment.baseCurrencyCode text?` | Sí | **nullable, sin backfill** | Los cobros existentes quedan con `null` = «no declarado» |
| 5 | `add_payment_idempotency_key` — `Payment.idempotencyKey text?` + **índice único parcial** (`WHERE "idempotencyKey" IS NOT NULL`) | Sí | `null` para los existentes | Índice **parcial**: el `NULL` no colisiona, y la unicidad la garantiza PostgreSQL |
| 6 | `add_payment_method_catalog` — tabla `PaymentMethodConfig` (`name`, `kind` canónico, `entityId?` → `Bank`, `currencyCodes`, `requiresReference`, `isActive`, `scope` local) | Sí | `isActive true` | **Semilla** con los medios que el negocio ya usa (Efectivo, Tarjeta, Transferencia), **sin** inventar entidades |
| 7 | `add_bank_entity_type` — `Bank.entityType` (enum `bank`\|`acquirer`\|`digital_provider`\|`other`) | Sí | **`other`** por defecto, con default en la columna | Los bancos existentes quedan en `other` **explícito**: no se infiere |
| 8 | `add_refund_idempotency_key` — `Refund.idempotencyKey text?` + índice único parcial | Sí | `null` | Cierra el hueco de reintento de `request-refund` |
| 9 | `add_refund_snapshot` — `Refund.exchangeRate decimal?`, `Refund.baseAmount decimal?` | Sí | nullable, sin backfill | Por simetría con `Payment` |
| 10 | `add_shift_exchange_rate_snapshot` — `Shift` congela la tasa usada por el cierre | Sí | nullable, sin backfill | Cierra «la tasa que produjo el snapshot no está» |
| 11 | `relax_currency_code_check` (si el runtime decide aceptar códigos internos >3 letras para monedas personalizadas) | Sí | — | **Decisión de runtime**: hoy el patrón `/^[A-Z]{3}$/` está en el dominio, no en la base |

**Orden y seguridad**: 1→2→3 son la base de `money`; 4→5 cierran `A-68`/`A-71`; 6→7 son la configuración de
medios/entidades; 8→9→10 son simetría y snapshot. **Ninguna es destructiva** y ninguna exige ventana de
mantenimiento. El **backfill no existe** por decisión explícita (§ *Legacy*).

---

## Archivos/módulos actuales que el runtime deberá mover o reutilizar

**A `money`** (nuevo módulo): `shared/lib/money-conversion.ts` · `shared/lib/format-currency.ts` ·
`shared/lib/order-totals.ts` (`roundCurrency`) · `shared/lib/shift-sheet-format.ts` ·
`shared/lib/customer-ticket.ts` (parte del formato) · `pos/domain/payment-conversion.ts` · las 5 copias del
traductor de error · `orders/domain/shift-refund.ts` (parte de conversión) ·
`business-settings/{domain/business-settings-defaults.ts, domain/business-settings.schema.ts}` (columnas de
dinero) · `cash-config/domain/{cash-config-defaults.ts, cash-count-config.ts, cash-config.schema.ts}` (las
monedas).

**A `payments`** (nuevo módulo): `orders/domain/order.types.ts` (tipos de `Payment`/`Refund`) ·
`orders/ports/{payment-repository.ts, refund-repository.ts}` ·
`orders/adapters/{prisma-payment-repository.ts, in-memory-payment-repository.ts, prisma-refund-repository.ts,
in-memory-refund-repository.ts}` · `orders/domain/{payment-change.ts, payment-void.ts, payment-reconciliation.ts}`
· `orders/features/{register-order-payment/**, void-payment/**, refund/**}` ·
`app/api/admin/orders/[id]/payment/**` · `app/api/admin/payments/[id]/void/**` ·
`app/api/admin/approvals/**` · y `pos/domain/pos-sale.ts` (`paymentsTotalInBusinessCurrency`) +
`pos/features/register-pos-sale/commit-sale.ts` (la escritura de los cobros).

**A `cash`** (orden 7, **no** en la próxima TASK): `orders/domain/shift-*.ts` ·
`orders/features/shift/**` · `pos/domain/shift-close-policy.ts` · `pos/features/close-pos-shift/**`.

**Se reutiliza sin mover**: `banks/**` (se amplía), `invoices/**` (se adapta la puerta),
`auth/domain/admin-permissions.ts` (se agregan puertas), `lockOrderRow`/`lockShiftRow`,
`orders/domain/order-workflows.ts`, `orders/features/get-order/**`, todo el panel de Caja.

## Archivos que están **prohibidos duplicar**

| Prohibido | Por qué |
|---|---|
| Un segundo algoritmo de conversión | Ya existe **uno** (`money-conversion.ts`) y hoy hay **dos** implementaciones (la canónica y la de `shift-refund.ts`) |
| Un segundo redondeo de dinero | `roundCurrency` es el único; `toFixed(2)` en el camino de dinero es deuda |
| Un segundo catálogo bancario / de entidades de cobro | `banks` ya es dueño; se amplía con su tipo |
| Un segundo catálogo de medios de pago | Sólo puede existir el de `payments`; el enum `PaymentMethodType` **no** se convierte en una segunda lista |
| Una segunda definición de «pagado» | Sólo la proyección de `payments`; la factura y el detalle **consumen** |
| Un segundo módulo de arqueo / caja | `cash` (orden 7) es el destino; `pos` no gana un segundo cálculo de esperado |
| Una segunda tabla de tasas o un `Json` de tasas | El historial es una tabla con fecha; `Shift.expectedByCurrency` **no** se convierte en el historial de tasas |
| Un segundo `Payment`/`Refund` (tabla o tipo paralelo) | `payments` es el único dueño |
| Una segunda lista de monedas en la UI | `cash-config-client.tsx:26,85` y `pos-payment.tsx:169` son las copias que se eliminan |
| Un segundo **estado financiero** en React | Prohibido calcular `pending`/`partial`/`paid` en un componente |
| Una segunda ruta de navegación de Finanzas | La entrada es una sola, aprobada por el owner en el orden 8 del roadmap |

---

## Permisos

**Puertas que ya existen** (se conservan tal como están): `canUsePOS` (cobrar) · `canVoidPayment` (owner) ·
`canRefund` (pedir) · `canApproveRefund` (owner) · `canManageCash` · `canViewCashHistory` ·
`canManageCashConfig` (owner) · `canPrintCashDocuments` (owner) · `canDiscountPosSale` ·
`canManageBusinessSettings` (owner) · `canOperateKitchen`.

**Puertas nominales que esta TASK propone** (**no se implementan acá**):

| Puerta | Roles | Qué protege | Por qué propia |
|---|---|---|---|
| `canManageFinanceConfig` | **owner** | Monedas, tasas, medios de pago y entidades de cobro | Cambiar la moneda base, una tasa o qué medios se aceptan cambia el número que el sistema espera: es la misma razón por la que `canManageCashConfig` es del dueño y no una reutilización de `canManageBusinessSettings` |
| `canViewOrderFinancials` | owner · manager · **cashier** (el del pedido que cobra, según `D-014`) | Ver `status`, `paidAmount` y `outstandingAmount` del pedido | Es capacidad **nominal** de `D-014`; hoy **no existe** y el detalle muestra dinero con la puerta gruesa de Pedidos (`A-60`) |
| `canCollectPayment` | owner · manager · cashier | Registrar un cobro sobre un pedido existente | Hoy es `canUsePOS`. Separarla permite que un rol opere el mostrador sin cobrar deuda ajena, y es el sitio donde vive la idempotencia |
| `canRequestRefund` | owner · manager | Pedir una devolución | **Hoy es `canRefund`**: se **renombra** a la capacidad nominal; `canRefund` queda como alias de compatibilidad y **no** se duplica la regla |
| `canApproveRefund` | **owner** | Firmar una devolución | **Ya existe** y no cambia: nadie aprueba la propia |

**Reglas**: la autorización se aplica **en el servidor**, nunca sólo en la UI; `kitchen` **no** entra a
ninguna puerta de dinero; el `cashier` **no** administra configuración financiera, **no** pide ni aprueba
devoluciones y **no** anula cobros. Ninguna de estas puertas se implementa en esta TASK: quedan como contrato
para el runtime, y **cada una con su prueba negativa** (401 sin sesión · 403 sin permiso).

---

## SPEC / REFERENCE / DESIGN FREEZE

- **SPEC aprobada**: [`../design/screens/finance.md`](../design/screens/finance.md) — creada por esta TASK
  con la plantilla [`../design/screens/TEMPLATE.md`](../design/screens/TEMPLATE.md).
- **`reference.html`**: **Sí** — [`../design/screens/finance-reference.html`](../design/screens/finance-reference.html),
  copia byte a byte de `one-burger-finanzas-desktop-reference.html` (SHA-256 `3964f097…68e09`, 33.528
  bytes), **aprobada por el owner el 2026-09-27**.
- **Design Freeze**: quedan **congelados** las tres vistas y sus tabs, las columnas de cada tabla, las dos
  tarjetas de resumen de *Monedas y tasas*, la línea de auditoría de tasa, los **cinco modales** con sus
  campos, los toasts y el **copy** de la referencia. Una desviación **material** modifica **primero** la spec
  y la decide el owner; si aparece durante la implementación es **Stop Condition**.
- **No congelado**: la composición a 768 y 375 (la referencia es un mock de escritorio) — la fija la SPEC y
  se verifica en los cuatro viewports.
- **Viewport Contract** (`1366×768`, `1280×720`, `768×1024`, `375×812`): declarado en la SPEC.
- **Cierre**: la implementación real se compara contra la SPEC **y** contra `finance-reference.html` antes de
  cerrar la TASK de runtime; **el merge no es esa comparación**.

---

## EVIDENCIA

- **Referencia versionada**: `ops/design/screens/finance-reference.html` — `Get-FileHash` SHA-256
  `3964F097841281A8A54C34FD3F8A1FCF38616DEFD840F92D9FF6FBB7AEE68E09`, 33.528 bytes.
- **`A-68`**: `orders/features/register-order-payment/register-order-payment.ts:124,127,133` +
  `orders/adapters/prisma-payment-repository.ts:165-173` + `pos/domain/pos-sale.ts:50-74` +
  `pos/features/register-pos-sale/commit-sale.ts:221-231`. Ejemplo numérico en § *Reproducción*.
- **`A-69`**: `orders/domain/shift-refund.ts:41-54` · `refund/request-refund/request-refund.ts:128` ·
  `update-order-status/update-order-status.ts:81` · `app/(admin)/admin/pos/quick-sale/pos-payment.tsx:104-107`.
- **`A-71`**: `prisma/schema.prisma:856-894` (sin `idempotencyKey`) +
  `app/api/admin/orders/[id]/payment/payment-composition.ts:33-42` (sin campo en el payload) contra
  `prisma/schema.prisma:546` (`Order.idempotencyKey @unique`) y `sale-payload.ts:75`.
- **Estado financiero inexistente**: `grep` de `paidAmount|outstandingAmount|paymentStatus|partial` en
  `src/**` → sólo tests de Cocina con aserciones **negativas**
  (`list-kitchen-orders.test.ts:39-40`, `api/admin/kitchen/orders/route.test.ts:177-178`).
- **Factura por conteo**: `invoices/features/emit-invoice/emit-invoice.ts:161-164` +
  `invoices/adapters/production-invoice.ts:29` + `invoices/domain/invoice.ts:87-99`.
- **Hardcodes**: `money-conversion.ts:13` · `cash-config-defaults.ts:16,30` · `cash-count-config.ts:34` ·
  `shift-cash.ts:118` · `cash-config-client.tsx:26,85` · `pos-payment.tsx:169` ·
  `pos-payment-rows.tsx:147` · `refund/request-refund.ts:128` · `update-order-status.ts:81` ·
  `admin-overview-formatters.ts:1,6,10`.
- **Sin historial de tasa**: `grep` de `rateHistory|exchangeRateHistory|rateSnapshot` en `src/` → **0**;
  `usdExchangeRate` en `prisma/schema.prisma` → **sólo `:833`**.
- **Redondeo divergente**: `roundCurrency` (`order-totals.ts:10-12`) vs `Number(x.toFixed(2))`
  (`shift-refund.ts:24,54`), con los cuatro valores de la § *Money* verificados en Node.
- **Referencia de invariantes ya resueltas**: `void-payment.postgres.test.ts:106-205` ·
  `register-order-payment.postgres.test.ts:126-159` · `close-shift.postgres.test.ts:268-349` ·
  `shift-unattributed-payment.postgres.test.ts`.

---

## CAUSA RAÍZ

`Payment` se creó (`20260914130000_add_payment`) **antes** de que existiera una autoridad monetaria, y se le
dio el monto **en la moneda que le dijeron** sin la tasa. Cuando el negocio necesitó una segunda moneda, se
agregó `usdExchangeRate` **al lado** del código que ya asumía NIO (`20260914231219_add_usd_exchange_rate`),
sin mover la autoridad ni tocar el cobro. Resultado: la conversión existe **en memoria** en cada consumidor
(el POS y el arqueo la hacen bien, el cobro de un pedido existente no la hace) y **nunca en el hecho**, así
que el pasado no se puede explicar y cada nueva superficie vuelve a decidir lo mismo. **No es un `if`
faltante: es una autoridad faltante.**

---

## INVARIANTE

Lo que tiene que seguir siendo verdad:

1. **La suma de los cobros no anulados de un pedido, convertida a moneda base, nunca supera el total del
   pedido.** (hoy **falso**: `A-68`)
2. **El mismo request de cobro, repetido, produce un solo `Payment`.** (hoy **falso**: `A-71`)
3. **`paidAmount` se expresa siempre en una sola moneda** (la base) y **nunca** es la suma de montos de
   monedas distintas. (hoy **falso** en `pos-payment.tsx:104-107`)
4. **Un cobro nuevo puede explicarse para siempre sin la configuración de hoy**: monto, moneda, moneda base,
   tasa aplicada y equivalente quedan escritos. (hoy **falso**)
5. **Un cobro anulado no cuenta** en el arqueo, en el saldo ni en la conciliación. (hoy **verdadero**,
   `A-59`; se conserva)
6. **Un turno cerrado no recibe cobros nuevos.** (hoy **verdadero**, `A-47`; se conserva)
7. **No se devuelve más de lo cobrado**, y **nadie aprueba su propia devolución**. (hoy **verdadero** como
   `if`; pasa a ser verdadero **bajo concurrencia** con lock, `A-73`)
8. **`Invoice` no define «pagado»**: lo consume. (hoy **falso**: usa `hasPayments`)
9. **Caja no recalcula una regla monetaria**: la pide. (hoy **falso** en cinco copias)
10. **El hecho histórico no se reinterpreta con la configuración actual.** (hoy **falso**: falta la tasa en el
    hecho)

---

## BOUNDED CONTEXT

**Dos módulos objetivo en una TASK es señal de alcance grande**, y acá es deliberado: la auditoría muestra
que `money` y `payments` **no se pueden separar** —`payments` no puede cerrar `A-68` sin la tasa que sólo
`money` puede definir, y `money` no tiene hecho histórico que congelar sin `payments`—.

- **`money`** (nuevo): catálogo de monedas, moneda base, locale, FX e historial, conversión, redondeo y
  formato monetario.
- **`payments`** (nuevo): `Payment`, `Refund` (hecho financiero), estado financiero canónico, void,
  partial, cambio, idempotencia y snapshots monetarios.
- **`banks`** (existe): se **amplía** con el tipo de entidad; no se reconstruye.
- **`orders`** (existe): **pierde** el dinero y **consume** el estado financiero.
- **`pos`** (existe): **pierde** la aritmética monetaria (queda como superficie que captura el cobro).
- **`invoices`** (existe): **consume** el estado financiero.
- **`cash` / `cash-config`** (existen): **consumen**; `cash` como módulo es el **orden 7** y **no** entra en
  la próxima TASK.

---

## SCOPE IN

**Documentos** (los únicos archivos que esta TASK toca):

| Archivo | Qué cambia |
|---|---|
| `ops/tasks/TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md` | **Nuevo**: este brief, con las dos auditorías, las matrices, los contratos y la secuencia |
| `ops/design/screens/finance.md` | **Nuevo**: SPEC congelada de la superficie de Finanzas |
| `ops/design/screens/finance-reference.html` | **Nuevo**: copia byte a byte de la referencia aprobada |
| `ops/product/MODULE_ARCHITECTURE.md` | §4, §4.1, §5, §12 y §13: ownership de Money/Payments **resuelto** y deuda re-apuntada |
| `ops/roadmap/PRODUCT-UX-ROADMAP.md` | Estado de los órdenes 4 y 5: auditados con dueño definido, sin renumerar ni reordenar |
| `ops/roadmap/NEXT.md` | `ACTIVE` / `NEXT` / `LATER`: la próxima TASK, una sola |
| `ops/roadmap/DECISIONS.md` | `D-016`…`D-020`: las decisiones de producto que esta fundación congela |
| `ops/CURRENT.md` | Estado: TASK cerrada, riesgos re-apuntados, qué sigue |
| `ops/audit-backlog.md` | Hallazgos nuevos `A-72`…`A-80` y actualización de `A-68`/`A-69`/`A-70`/`A-71` |
| `ops/tasks/START-HERE.md` | La secuencia inmediata (una sola próxima TASK) |

## SCOPE OUT

**Explícitamente afuera**:

1. **Runtime**: ninguna línea de `src/**`, ninguna ruta, ninguna API, ningún caso de uso, ningún componente.
2. **Prisma y migraciones**: `prisma/schema.prisma` **no se toca**; las migraciones se **enumeran** (§ *Migraciones*)
   y **no se crean**.
3. **Navegación**: ninguna entrada en `admin-layout-helpers.ts`; la entrada `Finanzas` del orden 8 del
   roadmap **no** se adelanta.
4. **Reforma fiscal**: `A-34` (RUC del negocio, numeración autorizada) queda como está.
5. **Reactivar módulos fuera del MVP**: inventario, reservas, delivery, mesas, `coupons`, `table-ordering`.
6. **Mover `Cash` a su módulo** (orden 7) y **`Promotions`** (orden 10).
7. **`Pedidos runtime` 5b**: no se abre.
8. **Cambiar `PaymentMethodType`** (sacar `mixed`): se audita, se documenta el impacto y **no** se implementa.
9. **El rediseño de `/admin/settings`**: pierde campos cuando `money` exista; su diseño no se toca acá.
10. **El redondeo de las monedas de 0 y 3 decimales en la base** (`Decimal(10,2)`): se enumera como
    consecuencia, no se migra.

## DEPENDENCIAS

- **Ninguna TASK previa**: `TASK-ORDERS-KITCHEN-FOUNDATIONS-001` y `-RUNTIME-002` están cerradas y
  desplegadas.
- **Decisión del owner**: las tres decisiones de producto que la SPEC necesita para el runtime están
  **congeladas en `D-016`…`D-020`** de esta TASK (medios de pago con tipo canónico y `mixed` derivado;
  moneda base como operación explícita; catálogo conocido como conveniencia; entidades de cobro reutilizando
  `banks`; snapshot obligatorio). **Ninguna** queda abierta como bloqueo.
- **Credencial**: ninguna.
- **Migración**: ninguna creada (enumeradas).

## ARCHIVOS PROBABLES (del runtime)

`src/modules/money/**` (nuevo) · `src/modules/payments/**` (nuevo) ·
`src/modules/orders/{domain,ports,adapters,features}` (pierde dinero) ·
`src/modules/pos/{domain,features}` · `src/modules/banks/{domain,adapters}` (tipo de entidad) ·
`src/modules/invoices/features/emit-invoice/emit-invoice.ts` (la puerta) ·
`src/modules/auth/domain/admin-permissions.ts` (puertas nominales) ·
`src/app/api/admin/orders/[id]/payment/**` · `src/app/api/admin/payments/**` ·
`src/app/api/admin/approvals/**` · `src/app/api/admin/finance/**` (nueva) ·
`src/app/(admin)/admin/finance/**` (nueva) · `src/app/(admin)/admin/settings/settings-client.tsx` (pierde los
campos de dinero) · `prisma/schema.prisma` + migraciones nuevas.

**Consumidores del radio de impacto** (a revisar en la review adversarial del runtime): las **~50**
superficies que importan `formatCurrency`, las **7** del formato de moneda extranjera, las **5** del
traductor de error, `dashboard` (resta `Refund.amount` crudo), el CSV de conciliación, el ticket de cliente,
la factura impresa y los **12** `*.postgres.test.ts` existentes.

---

## TEST ROJO (de la TASK de runtime, no de esta)

Esta TASK no escribe tests: es la **fundación**. Los tests que el runtime **debe** escribir primero, con
nombre de archivo y aserción:

1. `src/modules/payments/features/get-order-payment-status/get-order-payment-status.test.ts` — **rojo**:
   pedido de `C$365` con un cobro de `US$10` a tasa 36.5 ⇒ `status: "paid"`, `outstandingAmount: 0`. Hoy no
   existe la función (rojo **por la razón correcta**: el módulo no existe, y el test se escribe **con** la
   interfaz acordada antes de la implementación).
2. `src/modules/payments/features/get-order-payment-status/get-order-payment-status.test.ts` — **rojo**:
   `C$100` sobre `C$365` ⇒ `status: "partial"`, `outstandingAmount: 265`, **una sola moneda** en
   `paidAmount`.
3. `src/modules/payments/features/register-order-payment/register-order-payment.postgres.test.ts` —
   **rojo (PostgreSQL real)**: dos POST **simultáneos** con la **misma** `idempotencyKey` sobre un pedido de
   `C$365` con cobro parcial ⇒ **una** fila `Payment` y una sola respuesta 201/200; el segundo devuelve el
   mismo cobro. Hoy: dos filas (`A-71`).
4. `src/modules/payments/features/register-order-payment/register-order-payment.postgres.test.ts` —
   **rojo (PostgreSQL real)**: un cobro de `US$10` a tasa 36.5 sobre un pedido de `C$365` **no** deja cobrar
   otros `C$355`. Hoy: sí (`A-68`).
5. `src/modules/payments/features/refund/request-refund/request-refund.postgres.test.ts` — **rojo
   (PostgreSQL real)**: dos requests simultáneos del mismo cupo ⇒ la suma de devoluciones **nunca** supera el
   cupo del cobro. Hoy: no está probado y no hay lock (`A-73`).
6. `src/modules/invoices/features/emit-invoice/emit-invoice.test.ts` — **rojo**: un pedido con **un cobro
   parcial** **no** factura. Hoy: factura.
7. `src/app/(admin)/admin/pos/quick-sale/pos-payment.test.tsx` — **rojo**: dos filas de cobro en monedas
   distintas muestran el «Cobrado» **convertido** a moneda base. Hoy: suma cruda (`A-69c`).
8. `src/modules/money/domain/convert-to-base-currency.test.ts` — **rojo**: `shift-refund` usa la conversión
   canónica; una devolución en USD a tasa 36.5 resta `C$730`, no `US$20`. Hoy: la regla propia existe **al
   lado** (`A-69a`).

## ESTRATEGIA

El runtime se implementa en **una sola TASK**, en este orden, porque cada paso desbloquea el siguiente y
revertir el orden obliga a rehacer:

1. **`money` primero**: catálogo, moneda base, tasa con historial, conversión/redondeo únicos y formato con
   el código de la moneda. Sin esto, `payments` no tiene con qué convertir ni con qué congelar.
2. **Snapshot de `Payment`** (columnas nullable, aditivas, sin backfill): el hecho pasa a explicarse solo.
3. **`payments`**: mover el puerto y los adaptadores, cerrar `A-68` con la conversión de `money`, y agregar
   `idempotencyKey` + índice único.
4. **Estado financiero canónico** y los consumidores: `orders` (detalle/listado) e `invoices` (la puerta).
5. **Void y refund**: mover con sus invariantes intactas y **agregar** el límite atómico que falta.
6. **Cash y POS**: consumir `money` en vez de recalcular; el arqueo deja de tener cinco traductores.
7. **Configuración**: `/admin/finance` según la SPEC, con las puertas nominales y el catálogo de medios.
8. **Verificación**: los `*.postgres.test.ts` de idempotencia y concurrencia **corren en CI** (job
   `migrations`), y la pantalla se valida en los cuatro viewports contra la referencia.

**Por qué una sola TASK y no dos**: partirla en «Money» y «Payments» deja en el medio un estado donde el
snapshot existe sin la tasa que lo llena o la tasa existe sin el hecho que la congela; y el objetivo
declarado por el owner es exactamente **una autoridad**, no dos a medio construir.

## DDD

- **`domain`** (puro, sin Next/Prisma/HTTP): catálogo de monedas y sus reglas, política de tasa y vigencia,
  conversión y redondeo, formato monetario, contrato de snapshot, proyección del estado financiero,
  invariantes de void/refund y la política de idempotencia.
- **`features`**: casos de uso con dependencias inyectadas (registrar cobro, anular, pedir/resolver
  devolución, proyectar el estado, administrar el catálogo).
- **`ports`**: `PaymentRepository`, `RefundRepository`, `CurrencyRepository`, `ExchangeRateRepository`,
  `PaymentMethodRepository`, `BankRepository` (existente).
- **`adapters`**: Prisma (incluidos los locks y las transacciones) y los dobles en memoria.
- **`route`**: handlers ≤ 50 líneas, con zod y la puerta resuelta, sin Prisma directo.
- **`shared/ui`**: la pantalla y sus piezas, sin una línea de aritmética de dinero.

## TRANSACCIÓN

| Operación | Límite atómico | Estado |
|---|---|---|
| Cobrar (venta POS) | `runInSaleTransaction`: turno + alta + N cobros | **existe** |
| Cobrar (pedido existente) | `runInOrderPaymentTransaction`: lock del pedido + saldo + creación | **existe**; se le agrega la clave de idempotencia |
| Anular cobro | `runInVoidPaymentTransaction`: lectura + guardas + marcado | **existe** |
| **Pedir devolución** | **hay que crearlo**: cupo + creación de `Refund` en una transacción con lock del cobro | **NO existe** (`A-73`) |
| Resolver devolución | **hay que crearlo**: lectura + transición condicional | **NO existe** como transacción (`A-73`) |
| Cerrar turno | `runInShiftTransaction` | **existe** |
| Cerrar cuenta / cambiar moneda base / registrar tasa | una escritura + su asiento de auditoría **en la misma transacción** | **hay que crearlo** |

**Fuera de la transacción, a propósito**: cualquier llamada externa (notificación, impresión) va **después**
del commit, por outbox. El asiento de auditoría del cobro/void puede ser **best-effort** (como hoy en void),
pero el de **cambio de moneda base y de tasa** va **dentro**, porque es lo que hace auditable una operación
que cambia el significado de la plata.

## CONCURRENCIA

- **Cobrar**: `lockOrderRow` → `lockShiftRow`, y el tope contra el **total leído dentro del lock**.
- **Anular**: `UPDATE … WHERE voidedAt IS NULL` (ya resuelto, sin lock).
- **Pedir/resolver devolución**: `lockPaymentRow` (**nuevo**) antes de leer el cupo; la transición de estado
  sigue siendo condicional.
- **Registrar tasa / cambiar moneda base**: `effectiveFrom` con **unique** por par y momento; el cambio de
  base cierra el período anterior (`effectiveTo`) en la misma transacción.
- **`P2002`**: se recupera **fuera** de la transacción (`25P02`), como en `TASK-AUD-004`.
- **`isolationLevel`**: se mantiene el default (`READ COMMITTED`) porque **toda** invariante se apoya en lock
  explícito o en `UPDATE` condicional; queda escrito para que nadie lo cambie por accidente.

## IDEMPOTENCIA

- **Cobrar un pedido existente**: `Payment.idempotencyKey` + **índice único parcial**; la clave la manda el
  cliente; el segundo intento devuelve el **mismo** cobro. Cierra `A-71`.
- **Venta del POS**: `Order.idempotencyKey` (ya existe) **y** la clave del cobro, para que el dedupe no
  dependa del alta.
- **Pedir devolución**: `Refund.idempotencyKey` + índice único parcial. Cierra el reintento de `A-73`.
- **Resolver devolución / anular / cerrar turno**: ya resueltos por transición condicional.

## AUTORIZACIÓN

Las cinco puertas nominales de § *Permisos*, con prueba negativa obligatoria (401 sin sesión · 403 sin
permiso) y **aplicadas en el servidor**. Ninguna se implementa en esta TASK. Reglas que no se negocian:
`kitchen` no maneja plata; el `cashier` cobra y cierra su turno, **no** configura finanzas, **no** devuelve y
**no** anula; **nadie aprueba su propia devolución, ni el owner**.

## MIGRACIÓN

`N/A — esta TASK no toca el esquema`. Las **diez** migraciones que el runtime necesita están **enumeradas y
no creadas** (§ *Migraciones*), todas aditivas, nullable y **sin backfill**.

## OBSERVABILIDAD

- **Auditoría de configuración financiera** (`canManageFinanceConfig`): el cambio de **moneda base** y el
  registro de una **tasa** escriben `AdminAuditLog` **dentro** de la transacción (hoy el log existe y **no**
  se escribe un asiento por tasa: `A-80`). El asiento dice qué cambió, de qué a qué y quién.
- **Auditoría de cobro/void/refund**: hoy el rastro durable es la propia fila (`voidedAt`/`voidedByUserId`/
  `voidReason`, `Refund.status`/`requestedByUserId`/`approvedByUserId`/`approvedAt`) y el `AdminAuditLog` del
  void es best-effort. Se conserva y se **agrega el asiento de refund** en su transacción.
- **Reconstrucción del pasado**: con el snapshot (§ *Modelo conceptual*) un cobro se explica **sin** la
  configuración actual.

---

## TESTS UNITARIOS (del runtime)

Dominio de `money` (conversión, redondeo, formato con decimales por moneda, vigencia de tasa, cierre de
período al cambiar la base), dominio de `payments` (estado financiero, invariantes de void/refund, política
de idempotencia) y los casos de uso con dependencias inyectadas.

## TESTS DE INTEGRACIÓN (del runtime)

**Contra PostgreSQL real** (`*.postgres.test.ts`, corren en CI en el job `migrations`): idempotencia del
cobro con dos requests simultáneos; tope del saldo con dos cobros concurrentes y monedas distintas; lock del
cupo en `request-refund`; cambio de moneda base con las tasas y los hechos intactos. **Un doble en memoria no
prueba ninguna de las cuatro** ([`money-change`](../../.agents/skills/money-change/SKILL.md) §2).

## E2E (del runtime)

`tests/e2e/` — el flujo de la pantalla de Finanzas (crear moneda, registrar tasa, cambiar moneda base,
crear medio, crear entidad) y el cobro de un pedido existente repetido. Se declaran acá; **no** se escriben
en esta TASK.

## MUTATION CHECK (del runtime)

Reintroducir la suma cruda en `getPaymentSummary` ⇒ el test del saldo multi-moneda tiene que fallar.
Quitar el `idempotencyKey` del `createPayment` ⇒ el test de PostgreSQL de doble request tiene que fallar.
Quitar el lock de `request-refund` ⇒ el test de concurrencia del cupo tiene que fallar. Ninguna mutación se
commitea.

## VALIDACIÓN (de esta TASK)

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
```

`build:webpack` **no** aplica (no se toca ninguna página). Los E2E **no** aplican (no hay runtime). Los
contratos de gobernanza y de sincronización de documentos **sí** aplican y son el gate real de esta TASK:
`governance-consolidation-contract.test.ts` (techo de `NEXT.md` ≤ 60 líneas, roadmap de 17 ítems en orden,
leyes una sola vez) y `agent-system-contract.test.ts` (`MODULE_ARCHITECTURE.md` ≤ 422 líneas, `CURRENT.md` ≤
250 líneas, clasificación `ACTIVE`/`FROZEN`/`LEGACY`/`FUTURE` presente), más `docs-sync-contract.test.ts`
(ningún documento del camino de entrada puede apuntar a un archivo que no existe).

## CRITERIOS DE ACEPTACIÓN

1. `ops/design/screens/finance-reference.html` es **byte a byte** el adjunto aprobado (SHA-256 verificado).
2. `ops/design/screens/finance.md` existe, sigue la plantilla, declara las tres vistas, los estados, los
   tres anchos, el **viewport contract** de los cuatro viewports, qué se elimina, y el **Design Freeze** con
   la referencia como contrato.
3. La SPEC marca **FALTA** todo dato que el backend no tiene, y **no** dibuja ningún campo inventado.
4. `A-68`, `A-69` y `A-71` están **reproducidos** con evidencia `archivo:línea` y ejemplo numérico.
5. `canEmitInvoiceFor` / `hasPayments` está **reproducido** y queda declarado como dependencia de runtime.
6. Las **dos matrices** existen: `REUSE/MOVE/ADAPT/CONSOLIDATE/NEW/MISSING/OUT` y la de **ownership**, sin
   contradicciones entre ellas ni con `MODULE_ARCHITECTURE.md`.
7. Los **cinco contratos** están escritos: estado financiero canónico, snapshot de `Payment`, idempotencia y
   concurrencia, boundary con Cash y boundary con Invoices. Más los modelos conceptuales de moneda/tasa e
   historial.
8. La **estrategia legacy** prohíbe explícitamente el backfill y enumera el trato de cada dato legacy.
9. Las **migraciones** están enumeradas (aditivas, nullable, sin backfill) y **no creadas**:
   `git status` no muestra ningún archivo nuevo bajo `prisma/`.
10. Los **archivos prohibidos de duplicar** están listados.
11. `MODULE_ARCHITECTURE.md` resuelve el ownership de `money` y `payments` **sin** subir su techo de líneas
    (≤ 422) y sin crear módulos en el código.
12. `NEXT.md` (≤ 60 líneas) declara **una sola** próxima TASK y `ACTIVE` sigue en **Ninguno**.
13. `CURRENT.md` (≤ 250 líneas) registra la TASK cerrada y re-apunta los riesgos, **sin** copiar un SHA de
    `main` que su propio merge invalida.
14. Los hallazgos nuevos están en `ops/audit-backlog.md` con **ID, tipo, severidad y evidencia**.
15. Los cuatro checks de CI verdes: `verify`, `contracts`, `migrations`, `container`.
16. **Ninguna** línea de `src/**` ni de `prisma/**` cambió.

## REGRESIÓN

El test que demuestra que un hallazgo **vuelve** si alguien reintroduce el defecto está enumerado en
§ *Mutation Check* y lo escribe el runtime. En esta TASK, la regresión que se fija es **documental**: la SPEC
prohíbe el campo de texto que reinterpreta el pasado y la matriz prohíbe la segunda lógica financiera.

## ROLLBACK

`docs-only`: el rollback es **revertir el commit** en `main` y volver a disparar nada (no hay deploy). Las
migraciones **no** existen, así que no hay nada que revertir en la base.

## DOCUMENTACIÓN

Todos los archivos de § *Scope IN*. `MEMORY.md` sólo si la lección es reutilizable (§ *MEMORY*).

## MEMORY

Una sola lección reutilizable, si el owner la aprueba al cerrar: **«un hecho financiero sin la tasa que lo
produjo no se puede explicar después: la configuración tiene un dueño y el hecho la congela»**. Es la
aplicación de la ley 7 al caso concreto que la rompió, y sirve para cualquier hecho futuro (promociones,
impuestos). El resto es específico de esta TASK y va al brief.

## DEFINITION OF DONE

- [x] Auditoría real de Money y de Payments, con `archivo:línea`.
- [x] `A-68`, `A-69`, `A-71` reproducidos con ejemplo; `canEmitInvoiceFor` reproducido.
- [x] Matriz de clasificación y matriz de ownership.
- [x] SPEC congelada + referencia versionada (hash verificado).
- [x] Contratos: estado financiero, snapshot, idempotencia/concurrencia, boundaries, moneda/tasa/historial.
- [x] Legacy sin backfill; migraciones enumeradas y **no** creadas.
- [x] Archivos a mover/reutilizar y prohibidos de duplicar.
- [x] Permisos nominales propuestos, no implementados.
- [x] Roadmap / `NEXT` / `CURRENT` / backlog consistentes; **una** próxima TASK.
- [x] Una sola pasada final de consistencia antes del PR.
- [ ] Validación completa verde y **PR con CI verde** → squash merge → `main` limpio → **STOP**.
- [ ] Excepciones documentadas: ninguna. Sin runtime, sin migraciones, sin deploy.
