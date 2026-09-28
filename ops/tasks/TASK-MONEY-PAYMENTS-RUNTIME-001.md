# TASK-MONEY-PAYMENTS-RUNTIME-001 — Money / Payments runtime

> **Estado**: brief de la TASK, **cerrada y desplegada**. Órdenes **4 y 5** del
> [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md) en **una sola TASK**, como decidió
> [`NEXT.md`](../roadmap/NEXT.md). **Mergeada** en `main` (PRs
> [#85](https://github.com/danielmaki123/one-burger-commerce/pull/85),
> [#87](https://github.com/danielmaki123/one-burger-commerce/pull/87) y
> [#89](https://github.com/danielmaki123/one-burger-commerce/pull/89) y
> [#91](https://github.com/danielmaki123/one-burger-commerce/pull/91)) con los **cuatro checks del CI en
> verde**, y **desplegada por el owner** el 2026-09-28 (`build-20260928-200305`).
>
> **Base `main`**: `8f535d587c36bf6d63a3411e38b467dc093ff558` (`8f535d5`, 2026-09-28) · **Rama**:
> `feature/money-payments-runtime` (mergeada y borrada) · **Delivery Mode**: **`high-risk-e2e`** (dinero +
> auth + esquema: PR → CI verde → squash merge → deploy → QA de producción).
>
> **Preflight verificado** (no se toma el pedido como fuente de verdad):
> `git status --porcelain` **sin archivos rastreados modificados** (sólo residuos locales sin trackear, que
> **no** se commitean); `git rev-parse HEAD` == `git rev-parse origin/main` == `8f535d5…`;
> suite base **497 archivos / 3592 tests en verde**; 52 migraciones aplicables, la última
> `20260928120000_add_order_source`.
>
> **Qué NO se toca** (§ *SCOPE OUT*): Pedidos runtime 5b · Cash ownership (orden 7) · la reforma completa de
> Configuración (orden 8) fuera de lo necesario para la pantalla de Finanzas · la reforma fiscal de Invoice
> (`A-34`) · Cierres/Facturas (orden 9) · Promotions · Resumen.

---

## Estado de la entrega (2026-09-29)

| Paso del flujo (`delivery-e2e` §1) | Estado |
|---|---|
| Auditoría real, reuse audit, ownership, SPEC/reference congelados | **Hecho** (fundaciones, `docs-only`, `8f535d5`) |
| Implementación con TDD, rojo observado, mutación y PostgreSQL real | **Hecho** |
| PR + CI verde (los cuatro checks) | **Hecho**: PR #85 — `verify`, `contracts`, `migrations`, `container` |
| Merge `--squash` a `main` | **Hecho**: `2cbda9b` |
| **Auditoría independiente** (implementación vs SPEC/reference) | **Hecho** (PR #87, `5082ea5`): encontró **un crash**, **un desborde** y una **desviación material** de composición, y los corrigió. Ver § *Visual QA de Finanzas* |
| **Deploy** | **Hecho por el owner** el 2026-09-28: `build-20260928-200305`, con las tres superficies en `ok` |
| Health / readiness / smokes | **Hecho**: `/api/health` `build-20260928-200305`, `/api/readiness` `ready`, smokes **menú 7/7** y **hosts 6/6** |
| QA **autenticada** de `/admin/finance` en producción | **Hecha** (`tests/e2e/admin-finance.spec.ts`, **6/6** con sesión real sobre `admin.oneburgernic.com`): los cuatro viewports del contrato sin scroll horizontal, las tres vistas y que `mixed` no se ofrece como tipo (`D-017`). *Monedas y tasas* —donde la QA local había encontrado el crash— se dibuja con los datos reales (`USD` a `36.7`) |
| `CURRENT.md` / `NEXT.md` / backlog | **Hecho** |

**Lo que el CI encontró y el local no**: el chequeo de idempotencia del cobro corría **antes** del lock, así
que dos requests **simultáneos** con la misma clave lo pasaban los dos y el segundo chocaba con el índice
único. Se corrigió moviendo el chequeo **después** del lock y agregando la recuperación del `P2002` **fuera**
de la transacción (`25P02`), con el procedimiento que fija `money-change` § CONCURRENCIA. Evidencia en el job
`migrations` del PR y reproducido en local contra una base **limpia**.

### Visual QA de Finanzas (navegador real, PR #87)

La comparación de la implementación contra la SPEC y contra `finance-reference.html` **no la reemplaza el
merge**, y encontró tres cosas que ningún test veía:

1. **La vista de Monedas y tasas se caía** con `config.settings.activeRates.find is not a function`:
   `activeRates` es el **mapa** `moneda → tasa` de la conversión (`{ USD: 36.5 }`) y el cliente lo trataba
   como una lista. Con una tasa registrada —es decir, siempre— la pestaña moría; sólo la primera instalación,
   con el mapa vacío, lo tapaba. La ruta se probaba con la configuración **mockeada** y el tipo del cliente
   era una afirmación, no un contrato.
2. **Scroll horizontal a 375 px**: medido, `scrollWidth` 380 contra `clientWidth` 375. Los tres rótulos con su
   contador no entraban en una fila.
3. **Desviación material de composición**: la referencia congela **tablas con columnas**
   (`medio · tipo · entidad · monedas · estado · acciones`), el **KPI de cabecera**, el **buscador**, la
   columna **«utilizada por N medios de pago»** y el **interruptor de estado**; la implementación tenía filas
   en tarjetas, sin columnas ni buscador.

Los tres se corrigieron en PR #87 (`5082ea5`), con `AdminTable` registrado en
`src/shared/ui/registry.json` y `tests/e2e/admin-finance.spec.ts` (**6/6**) cubriendo los cuatro viewports del
contrato, la conmutación de las tres vistas y que **`mixed` no se ofrece** como tipo (`D-017`).

**Desviación declarada que queda**: el `···` abre el modal de edición existente en lugar de un menú
desplegable —la referencia no congela el menú y un desplegable nuevo exigiría registrarlo y diseñarlo—.

---

## Corrección al pedido del owner (una sola, y es de ruta)

El pedido dice «implementar `/admin/settings/finance`». **La ruta aprobada es `/admin/finance`** y no hay
contradicción que resolver con el owner:

| Fuente | Ruta que declara |
|---|---|
| [`../design/screens/finance.md`](../design/screens/finance.md) § *Ruta* (**SPEC congelada**, 2026-09-28) | `/admin/finance`, **sin subrutas** |
| [`finance-reference.html`](../design/screens/finance-reference.html) (**referencia aprobada**, 2026-09-27) | una sola superficie de Finanzas |
| [`../roadmap/NEXT.md`](../roadmap/NEXT.md) | «sus tres vistas» de Finanzas |
| [`../CURRENT.md`](../CURRENT.md) §5 | «la pantalla de Finanzas según su SPEC congelada» |

Además, `finance.md` § *Qué se elimina* dice que **la edición de la moneda y del tipo de cambio sale de
`/admin/settings`**: colgar Finanzas **dentro** de `/admin/settings` contradiría la spec congelada. La
referencia del owner en el pedido es informal; la ruta es la de la SPEC aprobada y **no** se reinterpreta
(ley 5, *Reference Fidelity*). Se implementa en **`/admin/finance`** y se reporta la diferencia.

---

## PROBLEMA

La regla financiera **no tiene dueño**. Hoy el POS convierte y el cobro de un pedido existente **no**
(`A-68`, P1); la misma regla monetaria está escrita **cinco veces** (`A-69`); un cobro parcial **no es
idempotente** porque el payload ni siquiera tiene clave (`A-71`); el hecho histórico **no congela la tasa**
que lo produjo (`A-72`); y **no existe el estado financiero del pedido**, así que cada consumidor decide
«pagado» con lo que tiene a mano —`payments.length > 0` en la factura, la suma cruda en el POS—. La
auditoría completa, con `archivo:línea`, está en
[`TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md`](TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md); esta TASK la
**implementa**.

---

## REUSE AUDIT (gate obligatorio)

```md
Objetivo:  que una regla financiera tenga UN dueño (money / payments / banks) y que las superficies la
           consuman; que el cobro congele la tasa; que exista el estado financiero canónico y que la
           factura exija `paid` estricto.

Capacidad existente:
  - `shared/lib/money-conversion.ts` (`convertToBusinessCurrency`): la aritmética única de conversión.
  - `shared/lib/order-totals.ts` (`roundCurrency`): el redondeo dominante (109 usos).
  - `shared/lib/format-currency.ts` + `useCurrencyFormat()`: el formateador único.
  - `shared/lib/shift-sheet-format.ts`: la forma ya centralizada del formato multi-moneda.
  - `orders/{domain,ports,adapters}`: `Payment`/`Refund`, sus repositorios (puerto + Prisma + memoria),
    `payment-void` (5 invariantes con tests de PostgreSQL), `payment-change`, `payment-reconciliation`.
  - `orders/features/{register-order-payment,void-payment,refund}/**`: casos de uso completos.
  - `pos/domain/pos-sale.ts` + `pos/features/register-pos-sale/commit-sale.ts`: la venta atómica con
    idempotencia por `Order.idempotencyKey`.
  - `banks/**` completo (modelo, casos de uso, ruta, UI) con `LocationBank`.
  - `auth/domain/admin-permissions.ts`: las puertas existentes (`canUsePOS`, `canVoidPayment`, `canRefund`,
    `canApproveRefund`, `canManageCashConfig`, …).
  - `infrastructure`: `runIn*Transaction` ×4 + `lockOrderRow`/`lockShiftRow` probados contra PostgreSQL.
  - `AdminAuditLog` (módulo `audit`) y `AdminPageHeader`/secciones de `/admin/cash/config` como patrón de
    pantalla de Configuration.

Qué se reutiliza (no se reconstruye):
  `convertToBusinessCurrency` (pasa a `money` **sin cambiar la aritmética**) · `roundCurrency` ·
  `formatCurrency`/`useCurrencyFormat` (se les agrega el **código** de moneda) · `shift-sheet-format` como
  forma destino de las 7 copias · el catálogo `banks` **tal como está** (se le agrega el tipo de entidad) ·
  `void` y `refund` **completos** (se mueven, no se rehacen) · los 4 runners + los 2 locks · `Payment.tip`,
  `reference`, `changeAmount`, `shiftId` y el soft delete (`voidedAt`/`voidedByUserId`/`voidReason`) ·
  `Invoice` con su snapshot completo · todo el panel de Caja.

Realmente nuevo (y nada más que esto):
  1. módulo `money` (catálogo de monedas, moneda base, FX con historial, conversión, redondeo, formato);
  2. módulo `payments` (el cobro, su saldo, su void, su devolución y su idempotencia, como dueño);
  3. catálogo de **medios de pago** con tipo canónico y monedas admitidas;
  4. **estado financiero canónico** (`pending`/`partial`/`paid` + `paidAmount`/`outstandingAmount`/
     `unresolvedAmount`);
  5. **snapshot monetario** obligatorio del cobro nuevo y de la devolución;
  6. **tipo de entidad de cobro** sobre `Bank`;
  7. la superficie **`/admin/finance`** con sus tres vistas.
```

---

## SPEC / REFERENCE / DESIGN FREEZE

- **SPEC aprobada**: [`../design/screens/finance.md`](../design/screens/finance.md).
- **`reference.html`**: **Sí** — [`../design/screens/finance-reference.html`](../design/screens/finance-reference.html)
  (byte a byte la referencia aprobada por el owner el 2026-09-27, SHA-256 `3964f097…68e09`, 33.528 bytes).
- **Design Freeze**: las tres vistas y sus tabs, las columnas de cada tabla, las dos tarjetas de resumen de
  *Monedas y tasas*, la línea de auditoría de tasa, los seis modales (`methodModal`, `currencyModal`,
  `rateModal`, `baseModal`, `localeModal`, `entityModal`) con sus campos, los toasts y el **copy** citado en
  la spec. Una desviación **material** modifica primero la spec y la decide el owner.
- **Viewport Contract**: `1366×768`, `1280×720`, `768×1024`, `375×812`; el scroll vive en el panel, la
  página no scrollea y a 375 px no hay scroll horizontal.
- **Cierre**: la implementación se compara contra la SPEC **y** contra `finance-reference.html` antes de
  cerrar; el merge no es la comparación.

---

## INVARIANTE (lo que tiene que seguir siendo verdad)

1. `roundCurrency(Σ equivalente-base de los cobros no anulados) ≤ Order.total` — **hoy falso** (`A-68`).
2. El mismo request de cobro, repetido (incluso **simultáneo**), produce **un solo** `Payment` — **hoy falso**
   (`A-71`).
3. `paidAmount` se expresa **en una sola moneda** (la base) y nunca es la suma de montos de monedas distintas
   — **hoy falso** (`pos-payment.tsx:104-107`).
4. Un cobro nuevo se explica para siempre sin la configuración de hoy: monto, moneda, moneda base, tipo de
   cambio y equivalente base quedan escritos **obligatoriamente**; sin los cinco el cobro **no se firma**
   (`D-020`) — **hoy falso**.
5. `paid` ⇔ `outstandingAmount == 0` **y** `unresolvedAmount == 0`; un pedido con plata no demostrable
   **nunca** está `paid` (`D-020`/`D-021`) — **hoy no existe**.
6. `Invoice` **no define «pagado»**: exige `paid` estricto y **ningún rol** autoriza una excepción
   (`D-021`) — **hoy falso** (`hasPayments`).
7. Un cobro anulado no cuenta en el arqueo, en el saldo ni en la conciliación — **hoy verdadero** (`A-59`),
   se conserva.
8. Un turno cerrado no recibe cobros nuevos — **hoy verdadero** (`A-47`), se conserva.
9. No se devuelve más de lo cobrado y **nadie aprueba su propia devolución**, también **bajo concurrencia**
   (`A-73`) — **hoy verdadero sólo como `if` sin lock**.
10. Caja no recalcula ninguna regla monetaria: la pide (`A-69`) — **hoy falso** en cinco copias.
11. El hecho histórico no se reinterpreta con la configuración actual (`D-018`, `D-020`) — **hoy falso**.
12. Un equivalente no demostrable se **declara** (`unresolvedAmount`), no se inventa con la tasa vigente
    — **hoy falso**.
13. `mixed` no es un medio elegible: se **deriva** de más de un `Payment` (`D-017`).
14. Una moneda o un medio **no se borra**: se apaga (`isActive`).

---

## BOUNDED CONTEXT

Dos módulos **nuevos** (`money`, `payments`) más adaptaciones en tres existentes (`banks`, `orders`,
`pos`) y una superficie. Es **señal de alcance grande** y es deliberado: `payments` no puede cerrar `A-68`
sin la tasa que sólo `money` define, y `money` no tiene hecho histórico que congelar sin `payments`
([`TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md`](TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md) § *BOUNDED CONTEXT*).

- **`money`** (nuevo): catálogo de monedas, moneda base, locale, FX con historial, conversión, redondeo y
  formato.
- **`payments`** (nuevo): `Payment`, `Refund`, estado financiero canónico, void, idempotencia, snapshots y
  el catálogo de medios de pago.
- **`banks`** (existe): se **amplía** con el tipo de entidad. **No** se crea un catálogo paralelo.
- **`orders`** (existe): **pierde** el dinero del cobro y **consume** el estado financiero.
- **`pos`** (existe): **pierde** la aritmética monetaria; queda como superficie que captura el cobro.
- **`invoices`** (existe): **consume** el estado financiero (`paid` estricto).
- **`cash` / `cash-config`** (existen): **consumen**; el módulo `cash` es el orden 7 y **no** entra.

---

## SCOPE IN

| Área | Qué cambia |
|---|---|
| `prisma/schema.prisma` + 9 migraciones | Las nueve migraciones aditivas de § *MIGRACIÓN* |
| `src/modules/money/**` (nuevo) | Dominio (catálogo, base, tasas con vigencia, conversión, redondeo, formato), puertos, adaptadores Prisma + memoria, casos de uso de administración |
| `src/modules/payments/**` (nuevo) | `Payment`/`Refund` (tipos, puertos, adaptadores), snapshot obligatorio, estado financiero canónico, idempotencia, void, devoluciones, catálogo de medios de pago |
| `src/modules/orders/**` | Deja de ser dueño del dinero: consume `payments`; el detalle y el listado leen el estado financiero |
| `src/modules/pos/**` | La venta escribe el snapshot y consume `money`; el «Cobrado» del POS sale de la proyección |
| `src/modules/invoices/**` | `canEmitInvoiceFor` pasa a exigir `paid` estricto |
| `src/modules/banks/**` | Tipo de entidad de cobro |
| `src/modules/auth/domain/admin-permissions.ts` | Puertas nominales de Finanzas/Payments |
| `src/app/api/admin/finance/**` + `src/app/(admin)/admin/finance/**` | La superficie y sus APIs |
| `src/app/api/admin/orders/[id]/payment/**`, `.../payments/**`, `.../approvals/**` | Payload con clave de idempotencia y puertas nominales |
| `tests/e2e/` | El flujo de Finanzas y el cobro repetido |

## SCOPE OUT

1. **Pedidos runtime 5b** (el recorte financiero del detalle compartido, remanente de `A-60`).
2. **Cash ownership** (orden 7): `Shift`, conteos, movimientos, cierres y terminales **no se mueven**.
3. La **reforma completa de Configuración** (orden 8): `/admin/settings` sólo **pierde** los campos de
   dinero (`currencyCode`, `currencySymbol`, `locale`, `usdExchangeRate`); su diseño no se toca.
4. La **reforma fiscal** de `Invoice` (`A-34`): RUC del negocio y numeración autorizada.
5. **Cierres / Facturas** (orden 9) · **Promotions** (10) · **Resumen**.
6. Sacar `mixed` del enum `PaymentMethodType`: **se conserva** y deja de ser **elegible** (`D-017`).
7. El **redondeo a 0/3 decimales en la columna** `Decimal(10,2)`: se declara como consecuencia, no se migra.
8. Reactivar módulos fuera del MVP.
9. `A-50` (ventas viejas con menos `Payment` que los declarados): **no se repara** — es decisión del owner.

## DEPENDENCIAS

- **Decisión del owner**: todas las decisiones de producto están congeladas en `D-016`…`D-021`. Ninguna
  queda abierta como bloqueo.
- **TASK previa**: `TASK-MONEY-PAYMENTS-FOUNDATIONS-001` (cerrada, mergeada, sin deploy).
- **Credencial**: ninguna. **Migración**: las nueve de § *MIGRACIÓN*.
- **Base local**: PostgreSQL 17 en `127.0.0.1:5432` (contenedor `one-burger-commerce-postgres-1`) para
  `npm run test:postgres`.

## ARCHIVOS PROBABLES Y RADIO DE IMPACTO

Los de § *SCOPE IN*. **Consumidores a revisar en la review adversarial**: las ~50 superficies que importan
`formatCurrency`, las 7 copias del formato multi-moneda, los 5 traductores de `missing-rate`, el
`dashboard` (resta `Refund.amount` crudo, `A-74`), el CSV de conciliación, el ticket de cliente, la factura
impresa y los 7 `*.postgres.test.ts` existentes.

---

## MIGRACIÓN (nueve migraciones, aditivas, sin BOM, sin backfill de hechos)

Orden: 1→3 son la base de `money`; 4→5 cierran `A-68`/`A-71`; 6→7 son la configuración; 8→9 la simetría.

| # | Migración | Contenido | Aditiva / nullable |
|---|---|---|---|
| 1 | `add_currency_catalog` | `Currency` (`code` único, `name`, `symbol`, `decimals`, `isKnown`, `isActive`, `sortOrder`) + **semilla** con las monedas que el negocio **ya usa** | `isActive true`, `sortOrder 0` |
| 2 | `add_business_currency_settings` | `BusinessCurrencySettings` (fila única: `baseCurrencyCode`, `locale`) — **copia de configuración**, no reinterpretación de hechos | — |
| 3 | `add_exchange_rate_history` | `ExchangeRate` (`from`, `to`, `rate`, `effectiveFrom`, `effectiveTo?`, `createdByUserId?`, `@@unique([from,to,effectiveFrom])`) + semilla de la `usdExchangeRate` vigente **si existe**, con `effectiveFrom = now()` declarado | `effectiveTo?` |
| 4 | `add_payment_snapshot` | `Payment.exchangeRate decimal?`, `baseAmount decimal?`, `baseCurrencyCode text?`, `paymentMethodId text?`, `methodKind` (enum) nullable, `entityId text?` | nullable en la columna, **obligatorias al escribir** |
| 5 | `add_payment_idempotency_key` | `Payment.idempotencyKey text?` + **índice único parcial** (`WHERE "idempotencyKey" IS NOT NULL`) | `null` en los existentes |
| 6 | `add_payment_method_catalog` | `PaymentMethodConfig` (`name`, `kind` canónico, `entityId?`→`Bank`, `currencyCodes`, `requiresReference`, `isActive`, `sortOrder`) + `PaymentMethodLocation` (patrón `LocationBank`) + **semilla** con los medios que ya se usan | `isActive true` |
| 7 | `add_bank_entity_type` | `Bank.entityType` enum `bank`\|`acquirer`\|`digital_provider`\|`other`, **default `other`** | default en la columna |
| 8 | `add_refund_idempotency_key` | `Refund.idempotencyKey text?` + índice único parcial | `null` |
| 9 | `add_refund_shift_snapshot` | `Refund.exchangeRate decimal?`, `Refund.baseAmount decimal?`, `Refund.baseCurrencyCode text?` y `Shift.exchangeRate decimal?` (la tasa que produjo el cierre) | nullable, **sin backfill** |

**Ruta de upgrade**: una base **con datos** pasa de `8f535d5` al estado nuevo corriendo las nueve
migraciones en orden; **ninguna rellena un hecho**. La **semilla** de 1, 2, 3 y 6 es **configuración**
(qué monedas conoce el sistema, cuál es la base y con qué medios cobra), no historia: lo dice
[`TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md`](TASK-MONEY-PAYMENTS-FOUNDATIONS-001.md) § *Legacy* («es una
migración de datos de configuración, no una reinterpretación de hechos»).

**Compatibilidad**: el código anterior sigue corriendo contra el esquema nuevo (todo nullable o con
default). **Sin `NOT NULL`**: la obligatoriedad del snapshot es regla de **dominio y transacción**.

**Rollback operativo**: no hay down-migrations; fix-forward + backup. Estas nueve son **aditivas puras**
(ninguna borra ni reescribe datos existentes), así que un release que falle se revierte revirtiendo el
commit en `main` y volviendo a desplegar: la base puede quedarse como está.

---

## TRANSACCIÓN

| Operación | Límite atómico | Estado |
|---|---|---|
| Cobrar (venta POS) | `runInSaleTransaction`: turno + alta + N cobros **con su snapshot** | existe; se le agrega el snapshot |
| Cobrar (pedido existente) | `runInOrderPaymentTransaction`: `lockOrder` → saldo leído del **total bloqueado** → creación con clave | existe; se le agrega clave y tope correcto |
| Anular cobro | `runInVoidPaymentTransaction`: lectura + guardas + `UPDATE … WHERE voidedAt IS NULL` | existe |
| **Pedir devolución** | **`runInRefundTransaction` (nuevo)**: `lockPayment` → cupo → creación de `Refund` con su snapshot | **no existe** (`A-73`) |
| Resolver devolución | **en transacción con `lockPayment`** + `UPDATE … WHERE status='pending'` | **no existe** como transacción |
| Registrar tasa / cambiar moneda base | una escritura **+ su asiento de `AdminAuditLog` en la misma transacción** | **hay que crearlo** (`A-80`) |
| Cerrar turno | `runInShiftTransaction` | existe |

**Fuera de la transacción, a propósito**: notificación, impresión, Telegram y cualquier red (van después
del commit por outbox). El asiento de auditoría de la tasa y del cambio de moneda base va **dentro**.

## CONCURRENCIA

- **Cobrar**: `lockOrderRow` → `lockShiftRow`, y el tope se compara contra el **total leído dentro del
  lock** (cierra `A-75`: hoy el que devuelve el lock se descarta).
- **Anular**: `UPDATE … WHERE voidedAt IS NULL` (ya resuelto).
- **Pedir/resolver devolución**: `lockPaymentRow` (**nuevo**) antes de leer el cupo.
- **Registrar tasa / cambiar moneda base**: unique por `(from, to, effectiveFrom)`; el cambio de base cierra
  el período anterior en la misma transacción.
- **`P2002`**: se recupera **fuera** de la transacción (`25P02` aborta), como en `TASK-AUD-004`.
- **Aislamiento**: se mantiene `READ COMMITTED`, porque **toda** invariante se apoya en lock explícito o en
  `UPDATE` condicional.

## IDEMPOTENCIA

- **Cobrar un pedido existente**: `Payment.idempotencyKey` + índice único parcial; la clave la manda el
  **cliente**; el segundo intento (incluso simultáneo) devuelve el **mismo** cobro. Cierra `A-71`.
- **Venta del POS**: `Order.idempotencyKey` (ya existe) **y** la clave del cobro.
- **Pedir devolución**: `Refund.idempotencyKey` + índice único parcial.
- **Resolver devolución / anular / cerrar turno**: transición condicional (ya resuelto).

## AUTORIZACIÓN

Puertas **propias** en `auth/domain/admin-permissions.ts`, aplicadas **en el servidor**:

| Puerta | Roles | Protege |
|---|---|---|
| `canManageFinanceConfig` | owner | Monedas, tasas, moneda base, medios de pago y entidades de cobro |
| `canViewOrderFinancials` | owner · manager · cashier | `status`, `paidAmount`, `outstandingAmount`, `unresolvedAmount` |
| `canCollectPayment` | owner · manager · cashier | Registrar un cobro sobre un pedido existente |
| `canRequestRefund` | owner · manager | Pedir una devolución (`canRefund` queda como alias de compatibilidad) |
| `canApproveRefund` | owner | Firmar (ya existe) |

**Reglas duras**: `kitchen` no entra a ninguna puerta de dinero; el `cashier` cobra y cierra, **no**
configura finanzas, **no** pide ni aprueba devoluciones y **no** anula; **nadie aprueba su propia
devolución, ni el owner**. Cada puerta lleva su **prueba negativa** (401 sin sesión · 403 sin permiso).

## OBSERVABILIDAD

- **Tasa y moneda base**: asiento en `AdminAuditLog` **dentro** de la transacción (qué cambió, de qué a qué,
  quién) — cierra `A-80`.
- **Cobro / void / refund**: el rastro durable es la propia fila (`voidedAt`/`voidedByUserId`/`voidReason`,
  `Refund.status`/`requestedByUserId`/`approvedByUserId`/`approvedAt`); el asiento de `refund` se agrega en
  su transacción.
- **Reconstrucción**: un cobro nuevo se explica **sin** la configuración actual (snapshot); uno legacy sin
  snapshot se declara `unresolvedAmount` — el sistema dice «no se sabe», no inventa una equivalencia.

---

## TEST ROJO (el que se escribe **primero**, con su archivo y su porqué)

| # | Archivo | Aserción que falla primero | Por qué el rojo es por la razón correcta |
|---|---|---|---|
| 1 | `src/modules/payments/features/get-order-payment-status/get-order-payment-status.test.ts` | Pedido `C$365` con un cobro de `US$10` a tasa 36.5 ⇒ `status: "paid"`, `outstandingAmount: 0` | El módulo no existe; el test se escribe **con** la interfaz acordada |
| 2 | ídem | `C$100` sobre `C$365` ⇒ `partial`, `outstandingAmount 265`, **una sola moneda** en `paidAmount` | ídem |
| 3 | ídem | Cobro legacy con `baseAmount` nulo y **sin** dato persistido que demuestre equivalencia ⇒ `status ≠ paid`, `unresolvedAmount > 0`, **no** se usa la tasa vigente | Hoy la lectura lo convertiría con la tasa de hoy (`D-020`) |
| 4 | ídem | Cobro legacy cuyo equivalente **sí** está en un `Shift` cerrado ⇒ se resuelve con **ese** dato | `D-020` |
| 5 | `src/modules/payments/features/register-order-payment/register-order-payment.postgres.test.ts` | Dos POST **simultáneos** con la **misma** `idempotencyKey` ⇒ **una** fila `Payment` | Hoy dos filas (`A-71`) |
| 6 | ídem | `US$10` a tasa 36.5 sobre `C$365` **no** deja cobrar otros `C$355` | Hoy sí (`A-68`) |
| 7 | `src/modules/payments/features/refund/request-refund/request-refund.postgres.test.ts` | Dos requests simultáneos del mismo cupo ⇒ la suma **nunca** supera el cupo | Hoy no hay lock ni transacción (`A-73`) |
| 8 | `src/modules/invoices/features/emit-invoice/emit-invoice.test.ts` | Un cobro **parcial** (`C$100` sobre `C$365`) **no** factura | Hoy factura (`hasPayments`) |
| 9 | ídem | Tampoco factura **aunque emita el owner** (`pending`/`partial`) | `D-021`: no hay excepción por autorización |
| 10 | ídem | Un pedido con cobro legacy **no demostrable** **no** factura | `D-020`/`D-021` |
| 11 | `src/modules/money/domain/convert-to-base-currency.test.ts` | `shift-refund` resta el equivalente (`US$20` a 36.5 ⇒ `C$730`), no `US$20` | Hoy la regla propia existe al lado (`A-69a`) |
| 12 | `src/modules/money/domain/currency-catalog.test.ts` | Una moneda **personalizada** (código interno) es válida y el formato usa **sus** decimales | Hoy el contrato es «ISO de 3 letras» y 2 decimales fijos |

---

## MUTATION CHECK (se reintroduce y **no** se commitea)

| Mutación | Test que tiene que fallar |
|---|---|
| Volver a la suma **cruda** en el saldo | El del saldo multi-moneda |
| Quitar el `idempotencyKey` del `createPayment` | El de PostgreSQL de doble request |
| Quitar el `lockPayment` del cupo | El de concurrencia de devoluciones |
| **Convertir el legacy con la tasa vigente** en la proyección | El de `unresolvedAmount` (`D-020`) |
| Aflojar la puerta de la factura a `hasPayments` | El negativo de `emit-invoice` con cobro parcial (`D-021`) |
| Volver a comparar el tope contra el `total` leído fuera del lock | El de concurrencia del tope (`A-75`) |

---

## VALIDACIÓN

```bash
npm run security:secrets && npm run lint && npm run typecheck && npm run test && npm run test:contracts && npm run build
npm run build:webpack        # obligatorio: se toca src/app/(admin)/admin/finance/page.tsx
npm run test:postgres        # con PostgreSQL 17 local arriba
BASE_URL=... npm run test:e2e:prod:full   # flujos + Finanzas
```

---

## CRITERIOS DE ACEPTACIÓN

1. `money` y `payments` existen con las cuatro capas y **una sola** conversión y **un solo** redondeo en
   todo el repositorio (`grep` de aritmética duplicada = 0).
2. `A-68`, `A-69`, `A-71`, `A-72` **cerrados con test**; `A-73`, `A-74`, `A-75`, `A-79`, `A-80` cerrados o
   re-apuntados con motivo escrito.
3. Un cobro nuevo **no se firma** sin monto, moneda, moneda base, tipo de cambio y equivalente base.
4. Un cobro legacy sin snapshot queda `unresolvedAmount > 0` y **no** produce `paid` ni factura.
5. `paid` ⇔ `outstandingAmount == 0 && unresolvedAmount == 0`, con precedencia exacta.
6. `emit-invoice` exige `paid` estricto, con prueba negativa por rol.
7. Los tres tests de PostgreSQL de § *TEST ROJO* (5, 6, 7) corren en `npm run test:postgres` y en el job
   `migrations` del CI.
8. `/admin/finance` implementa las tres vistas, los seis modales y el copy congelado; `mixed` **no** se
   ofrece como medio.
9. Los literales `"NIO"`/`"USD"`/`"C$"`/`"es-NI"` **no** son estructura del código en los sitios que la
   auditoría marcó.
10. Las nueve migraciones son aditivas, sin BOM, sin backfill, y `migrate diff --exit-code` queda en verde
    sobre base limpia.
11. Ningún techo de deuda sube (`design-tokens.allow.json`, contratos de arquitectura, `tdd-contract`).
12. `/admin/settings` deja de editar los campos de dinero; el resto de Personalización no cambia.
13. `npm run security:secrets && lint && typecheck && test && test:contracts && build` y `build:webpack` en
    verde; los cuatro checks del CI en verde.
14. QA de producción: health, readiness, los dos smokes y `/admin/finance` con sesión en los cuatro
    viewports.

## REGRESIÓN

Cada invariante de § *INVARIANTE* tiene su test y su mutación (§ *MUTATION CHECK*): reintroducir el defecto
tiene que poner el test en rojo.

## ROLLBACK

App: revertir el commit en `main` y volver a desplegar. Base: **fix-forward** apoyado en el backup; las
nueve migraciones son aditivas puras, así que la app anterior las ignora.

## DOCUMENTACIÓN

`ops/CURRENT.md`, `ops/audit-backlog.md` (`A-68`…`A-80`), `ops/roadmap/NEXT.md` (`ACTIVE`/`NEXT`),
`ops/product/MODULE_ARCHITECTURE.md` (clasificación de los módulos nuevos), `START-HERE.md`.
`MEMORY.md` sólo si la lección es reutilizable.

## MEMORY

Candidata (se decide al cerrar): **«un hecho financiero sin la tasa que lo produjo no se puede explicar
después: la configuración tiene un dueño y el hecho la congela — y lo que no se puede demostrar se declara,
no se inventa con la tasa de hoy»**.

## DEFINITION OF DONE

- [ ] Tests verdes (unitarios + contratos + PostgreSQL + E2E) con el **rojo observado**.
- [ ] `security:secrets`, `lint`, `typecheck`, `test`, `test:contracts`, `build` y `build:webpack` verdes.
- [ ] Verificación en navegador real en los cuatro viewports, con captura.
- [ ] Ningún techo de deuda subió; `CURRENT.md`, `START-HERE.md` y el backlog actualizados.
- [ ] Commit + push, PR abierto, CI verde (los cuatro checks).
- [ ] Deploy, health/readiness, los dos smokes y QA de producción.
