# CAPABILITY-REUSE-MAP — quién es dueño de cada capacidad y qué se reutiliza

> **Qué es**: el registro de **capacidad → dueño canónico → implementación canónica → consumidores**, con la
> clasificación de cada pieza (`REUSE` · `MOVE` · `CONSOLIDATE` · `NEW` · `FROZEN`) y la **prohibición de
> duplicación** que le corresponde. **No decide orden**: el orden lo manda
> [`../roadmap/PRODUCT-UX-ROADMAP.md`](../roadmap/PRODUCT-UX-ROADMAP.md) (§2) y lo secuencia
> [`../roadmap/NEXT.md`](../roadmap/NEXT.md).
>
> **Para qué sirve**: que un agente nuevo no vuelva a decidir *dónde vive cada cosa*. Antes de crear un
> módulo, un cálculo o una pantalla, se busca acá. Es la aplicación operativa de la ley **Reuse First**
> ([`AGENTS.md`](../../AGENTS.md) § *Leyes del repo*, ley 1): el enunciado vive ahí y acá no se repite.
>
> **Cómo se lee**: `dato` vs `regla` están separados a propósito — un **dato** se guarda una vez y se lee; una
> **regla** se escribe una vez y se consume. Si una capacidad dice `CONSOLIDATE`, hay una segunda
> implementación viva que hay que llevar al dueño **en la TASK que la toque**, no de paso.
>
> **Qué posee cada módulo** (hoy y en el objetivo, con el grafo de consumo) está en
> [`MODULE-OWNERSHIP.md`](MODULE-OWNERSHIP.md).

**Snapshot**: verificado contra `main` = `461cc49` (2026-09-30). **Toda evidencia de este archivo es un
snapshot y debe revalidarse al iniciar la TASK que la use**: el código manda.

---

## 1. Dinero y pagos (órdenes 4 y 5 — cerrados)

| Capacidad | Dueño canónico | Implementación canónica | Consumidores | Clasificación | Prohibido duplicar |
|---|---|---|---|---|---|
| Catálogo de monedas | `money` | `domain/currency-catalog.ts` · `Currency` | POS, Finanzas, Caja, Factura | `REUSE` | Cualquier lista de monedas escrita en un componente o en otro módulo |
| Moneda base | `money` | `BusinessCurrencySettings` (fila única) + `features/change-base-currency` | todos | `REUSE` | Leer `BusinessSettings.currencyCode` como autoridad |
| Locale monetario | `money` | `features/update-money-locale` | superficies que formatean | `REUSE` | Escribirlo por otro camino (antes se fingía un cambio de base) |
| Tasas + historial | `money` | `ExchangeRate` + `features/register-exchange-rate` | POS, cobro, Caja, Finanzas | `REUSE` | `if currency === "USD"`, columnas `eurRate`, o un escalar nuevo |
| Conversión a base | `money` | `domain/convert-to-base-currency.ts` | cobro, POS, devolución, arqueo, dashboard | `REUSE` | `monto * tasa` escrito en una superficie |
| Redondeo | `money` | `domain/round-currency.ts` | todos | `REUSE` | `toFixed(2)`, `Math.round` suelto |
| Formato de la plata | `money` | `domain/format-money.ts` detrás de `shared/lib/format-currency.ts` | público y panel | `REUSE` | Un formateador propio por pantalla |
| **Lectura única en producción** | `money` | `adapters/production-money-context.ts` (`readProductionMoney`) | POS, cobro, devolución, Caja, Factura, Dashboard, alta pública | `REUSE` | Que un consumidor arme su propio contexto leyendo la configuración |
| Snapshot del cobro | `payments` | `domain/payment-snapshot.ts` (`buildPaymentSnapshotFor`) | POS, cobro de pedido, devolución | `REUSE` | Escribir un `Payment`/`Refund` sin pasar por el constructor |
| Estado financiero del pedido | `payments` | `domain/order-financial-status.ts` + `features/get-order-payment-status` | Factura, Dashboard, POS, cobro, **Pedidos (listado y detalle)** | `REUSE` | Contar filas o sumar montos crudos para decidir «pagado» |
| Saldo y no-demostrable | `payments` | misma proyección (`outstandingAmount`, `unresolvedAmount`) | Factura, Pedidos | `REUSE` | Convertir un cobro legacy con la tasa vigente |
| Catálogo de medios de pago | `payments` | `PaymentMethodConfig` + `domain/payment-method-availability.ts` | POS, Finanzas | `REUSE` | `POS_PAYMENT_METHODS` como fuente de verdad del medio |
| Disponibilidad por local | `payments` | `PaymentMethodLocation` + `isPaymentMethodAvailableAt` | POS, Finanzas | `REUSE` | Un segundo mapa de «dónde se ofrece» |
| Entidades de cobro | **`banks`** | `Bank` (con `entityType`) | Finanzas, POS, Caja | `REUSE` | Un catálogo paralelo de entidades |
| Idempotencia del cobro | `payments` | `Payment.idempotencyKey` (índice único parcial) | POS, cobro | `REUSE` | Deduplicar en memoria o con una clave inventada por el servidor |
| Anulación de un cobro | `payments` | `voidPayment` (`A-59`) | Caja, conciliación | `REUSE` | Borrar o editar la fila del cobro |
| Obligaciones vivas (guarda del cambio de base) | `money` (puerto) + `payments` (regla de estados) | `ports/money-obligation-guard.ts` + `domain/order-financial-obligations.ts` | Finanzas | `REUSE` | Que `money` importe `Order`/`Shift`, o duplicar «qué es un pedido terminado» |

## 2. Pedidos, comandas y caja

| Capacidad | Dueño canónico | Implementación canónica | Clasificación | Prohibido duplicar |
|---|---|---|---|---|
| Totales del pedido | `shared/lib/order-totals.ts` | `calculateOrderTotal` / `calculateOrderTotals` | `REUSE` | Sumar `subtotal + packaging + tip` a mano |
| Estado del pedido | `orders` | `domain/order-workflows.ts` | `REUSE` | Una máquina de estados paralela por pantalla |
| Canal de origen (`source`) | `orders` | `Order.source` escrito por cada puerta (`D-015`) | `REUSE` | Inferirlo del medio de pago o del cliente |
| Moneda del pedido | `orders` (dato) leyendo `money` | `Order.currencyCode` (`D-022`) | `REUSE` | Reconstruir la moneda con la configuración de hoy |
| Cobro del mostrador | `pos` | `features/register-pos-sale` (decide) + `commit-sale` (escribe) | `REUSE` | Que otra superficie cree `Payment` por su cuenta |
| Cobro de un pedido existente | `orders` | `features/register-order-payment` + `POST /api/admin/orders/[id]/payment` (**lote atómico**, `payments[]`) | `REUSE` | Una segunda ruta de cobro, o cobrar en dos escrituras en vez de una transacción |
| Devolución | `orders` | `features/refund/request-refund` + `review-refund` | `REUSE` | Devolver por fuera del cupo o sin lock |
| Turno y arqueo | `orders` | `features/shift/*` + `domain/shift-cash.ts` | `MOVE` → `cash` (**orden 7**) | Recalcular el arqueo de un turno cerrado |
| Configuración de conteo | `cash-config` | `CashDenomination` + `LocationCashConfig.countedCurrencyCodes` | `REUSE` | `NIO`/`USD` como estructura, o billetes inventados |
| Configuración operativa del POS | `pos` | `domain/shift-close-policy.ts`, `cash-locations.ts` | `REUSE` | Repetir la política de cierre en la pantalla |
| Visibilidad por rol/local | `orders` | `domain/order-visibility.ts` | `REUSE` | Filtrar en React y creer que es autorización |
| Read model del listado admin | `orders` | `features/list-admin-orders/order-list-projection.ts` + `listAdminOrders` (pagina y agrega en el servidor) | `REUSE` | Traer el pedido entero para dibujar una fila, filtrar o paginar en React, o calcular los KPI sobre la página visible |
| Read model del detalle admin | `orders` | `features/get-order/order-detail-projection.ts` (+ `getOrder`) | `REUSE` | Devolver los campos financieros a un rol sin `canViewOrderFinancials` «para que React los esconda», o derivar el saldo comparando `Order.total` contra los cobros |
| Puerta de Pedidos | `auth` | `canViewOrders` (`admin-permissions`) | `REUSE` | Reutilizar `canManageOrderOperations` (mete a cocina y deja afuera al cajero) |
| Aterrizaje por rol | `auth` | `domain/admin-landing.ts` (`resolveAdminLanding`) | `REUSE` | Un `if role === …` por superficie (login, shell, home): es la decisión escrita tres veces |
| Read model operacional del POS | `orders` | `domain/pos-operational-orders.ts` + `features/list-pos-operational-orders` | `REUSE` | Clasificar los pedidos en React, contar los KPI sobre lo que se ve, o una segunda definición de «listo para entregar» |
| Medios de cobro del POS | `payments` | `features/list-available-payment-methods` (+ `domain/pos-payment-methods.ts` como vista) | `REUSE` | Un segundo catálogo de medios, o una constante de medios en el POS (`A-85`) |
| Liquidación exacta de un cobro | `payments` | `domain/order-settlement.ts` (`validateExactSettlement`) | `REUSE` | Validar el saldo en la pantalla, o permitir sobrepago/abono comercial |
| Autorización de entrega | `auth` | `canDeliverOrder` (`admin-permissions`) + `assertDeliverableByRole` | `REUSE` | Dejar que cualquier rol firme `picked_up`, o esconder el botón y creer que es autorización |

## 3. Facturas, catálogo y configuración

| Capacidad | Dueño canónico | Implementación canónica | Clasificación | Prohibido duplicar |
|---|---|---|---|---|
| Emisión de factura | `invoices` | `features/emit-invoice` (exige `paid` estricto, `D-021`) | `REUSE` | Una segunda puerta de emisión o una factura parcial |
| Numeración | `invoices` | `createNextForOrder` (asigna y crea en una operación) | `REUSE` | Leer el último número y después insertar |
| Moneda del documento | `invoices` | `Invoice.currencyCode` (congelada) | `REUSE` | Formatear con la base de hoy |
| Precios del menú | `menu` | `get-catalog` (una sola lectura pública y del POS) | `REUSE` | Resolver precios en el cliente o en el POS |
| Productos y modificadores | `menu` | `catalog` + `domain/modifier-selection.ts` | `REUSE` | Copiar la regla de modificadores en el POS |
| Promociones y cupones | `coupons` | `Coupon` + consumo de uso | `MOVE` → `promotions` (**orden 10**) | Elegibilidad o límites fuera del dueño |
| Personalización del negocio | `business-settings` | `update-business-settings` | `CONSOLIDATE` (**orden 8**) | Que edite moneda, símbolo, locale o tasa (hoy lo rechaza) |
| Configuración de Finanzas | `money` + `payments` + `banks` | `/admin/finance` + `/api/admin/finance` | `REUSE` | Una segunda pantalla de dinero |
| Locales y sucursales | `locations` | `Location` + `location-rules.ts` | `REUSE` | Datos de sucursal hardcodeados |
| Clientes | `customers` | `Customer` + auth por OTP | `REUSE` | Guardar datos fiscales fuera del cliente |
| Dashboard (`Resumen`) | `dashboard` | `get-admin-overview-performance` (**ordinal 16**) | `FROZEN` | Convertir moneda dentro del dashboard |
| Notificaciones | `notifications` | outbox + drivers (`dummy`/Telegram) | `REUSE` | Avisar desde adentro de una transacción |

## 4. Fuera del MVP (`FROZEN`)

Código presente, **no ofrecido** en UI ni en APIs públicas: `inventory`, `reservations`, `table-ordering`,
`tables` y el delivery de zonas. **No se reactivan** sin pedido explícito del owner; el saneamiento y la
clasificación son del **orden 12**.

## 5. Reglas de uso

1. **Al abrir una TASK, se consulta esta tabla primero.** Si la capacidad ya tiene dueño, se **consume**; si
   está en `MOVE` o `CONSOLIDATE`, se **lleva** al dueño en la TASK que la toque.
2. **Un dato, una escritura.** La autoridad monetaria es `money`; el estado financiero, `payments`; las
   entidades de cobro, `banks`. No hay segundas fuentes «porque era más rápido».
3. **Una regla, una implementación.** Si esta tabla dice `REUSE` y el código tiene dos, la segunda es deuda:
   se anota en [`../audit-backlog.md`](../audit-backlog.md) y se cierra donde corresponda.
4. **La configuración se edita hacia adelante y el hecho histórico la congela** (ley 7): por eso cada
   capacidad que produce un hecho dice **qué congela** (`Payment`, `Refund`, `Shift`, `Invoice`, `Order`).
5. **Este archivo no crece como un diario**: se actualiza cuando cambia un dueño o una implementación
   canónica, con el commit de esa TASK.
