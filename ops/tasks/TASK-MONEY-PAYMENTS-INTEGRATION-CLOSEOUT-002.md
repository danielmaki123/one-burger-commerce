# TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002 — cierre de aceptación de Money / Payments

> **Estado**: autorizada por el owner y **en ejecución**. No es una feature: es el **cierre de aceptación**
> de [`TASK-MONEY-PAYMENTS-RUNTIME-001`](TASK-MONEY-PAYMENTS-RUNTIME-001.md), cuyos criterios **3, 9 y 12**
> no se cumplen en el runtime auditado. Órdenes **4 y 5** del
> [roadmap maestro](../roadmap/PRODUCT-UX-ROADMAP.md), segunda pasada.
>
> **Base `main`**: `5ea1b3887edd5aadeffb7892219d1406853c82aa` (`5ea1b38`, PR #98) · **Delivery Mode**:
> **`high-risk-e2e`** (dinero + auth + esquema: PR → CI verde → squash merge → deploy → QA de producción).
>
> **Qué NO se toca**: Pedidos runtime 5b · el **move completo** de Caja al módulo `cash` (orden 7) · la
> reforma completa de Configuración (orden 8) · la reforma fiscal de Invoice (`A-34`) · Cierres/Facturas
> (orden 9) · Promotions · Resumen. **No se abre Pedidos runtime.**

## Los hallazgos, reproducidos

Registrados en [`../audit-backlog.md`](../audit-backlog.md) como `A-81`…`A-90`, cada uno con
`archivo:línea` y **después** de reproducirlo. Resumen por severidad:

| ID | Qué falta | Sev. |
|---|---|---|
| `A-81` | El POS productivo crea `Payment` sin snapshot (`commit-sale.ts:221`) | **P1** |
| `A-82` | La devolución productiva crea `Refund` sin snapshot (`request-refund.ts:165-184`) | P2 |
| `A-83` | Cinco consumidores leen `BusinessSettings.currencyCode`/`usdExchangeRate` | **P1** |
| `A-84` | Personalización sigue editando la autoridad monetaria vieja | **P1** |
| `A-85` | POS con medios fijos y selector base + `USD` (`pos-sale.ts:17`, `pos-payment.tsx:165-180`) | **P1** |
| `A-86` | `PaymentMethodLocation` se lee pero no se puede editar | P2 |
| `A-87` | Guardar solo el locale falla con `409` (`finance-currencies-view.tsx:440`) | P2 |
| `A-88` | Caja: `NIO`/`USD` + `usdEnabled` como estructura de runtime | P2 |
| `A-89` | `Order` no congela la moneda en la que están sus montos | **P1** |
| `A-90` | `Shift` congela una tasa escalar y no base + tasas genéricas | P2 |

## Estado objetivo (obligatorio)

1. **`money` es la única autoridad vigente** de catálogo de monedas, moneda base, locale monetario, tasas,
   historial, conversión, redondeo y formato.
2. **`payments` es la autoridad** de `Payment`, `Refund` financiero, snapshot, saldo, `pending/partial/paid`,
   idempotencia, void y catálogo de medios.
3. **`banks` sigue siendo el único catálogo de entidades** de cobro.
4. POS, Orders, Cash, Invoice, Dashboard y React **consumen** esas autoridades; no recalculan ni mantienen
   una segunda configuración.

## DECISIONES derivadas de esta TASK (van también a `DECISIONS.md`)

- **`D-022` — Un cambio de moneda base no redenomina una deuda existente.** La base es la unidad en la que
  el sistema **expresa y compara** la plata de acá en adelante y con la que **congela** los hechos nuevos;
  no convierte retroactivamente lo ya registrado. Un `Order` legacy cuya moneda no se pueda demostrar
  **permanece legacy/`unresolved`**: no se le inventa una moneda con la configuración actual.
- **`D-023` — La moneda base no se cambia con obligaciones vivas.** Se rechaza el cambio con un `Shift`
  abierto o con pedidos `pending`/`partial` cuyo saldo quedaría expresado en la base vieja. El cambio es
  una operación de **período cerrado**.
- **`D-024` — El snapshot es obligatorio en toda escritura productiva.** Un `createPayment` o
  `createRefund` productivo que termine con `baseCurrencyCode`/`exchangeRate`/`baseAmount` en `null` es
  **fallo**, no un caso degradado. El POS y la devolución pasan a la construcción canónica.

## REUSE AUDIT (gate previo, ley 2)

| Necesidad | Qué se reutiliza | Dónde |
|---|---|---|
| Leer la configuración monetaria vigente | `getMoneySettings` (ya existe) | `src/modules/money/features/get-money-settings/` |
| Construir el snapshot de un cobro | `buildPaymentSnapshot` (ya existe) | `src/modules/payments/domain/payment-snapshot.ts` |
| Convertir a base | `convertToBaseCurrency` / `convertAmountToBase` | `src/modules/money/domain/convert-to-base-currency.ts` |
| Estado financiero del pedido | `getOrderPaymentStatus` | `src/modules/payments/features/get-order-payment-status/` |
| Catálogo de entidades | `banks` (sin cambios) | `src/modules/banks/` |
| Disponibilidad por local | `PaymentMethodLocation` (ya modelada) | `prisma/schema.prisma:572` |
| Formato de la plata | `formatMoney` detrás de `formatCurrency` | `src/modules/money/domain/format-money.ts` |

**Lo que NO se crea**: un segundo catálogo de entidades, una segunda conversión, un segundo formateador,
un segundo árbol de configuración monetaria, ni columnas `eurRate`/`mxnRate`.

## Plan por pasos (TDD: rojo real antes de cada corrección material)

1. **Ownership**: `git mv` del puerto y los adaptadores de `Payment`/`Refund` a `payments` con re-export
   desde la ruta vieja (sin reescribir comportamiento probado).
2. **Snapshot del POS** (`A-81`): `commitSale` construye el snapshot con el contexto de `money`; el
   retry usa el `baseAmount` **persistido**, prohibido re-convertir con la tasa vigente.
3. **Snapshot de la devolución** (`A-82`).
4. **Un solo lector de `money` en producción** (`A-83`): POS, cobro, Refund, Cash, Invoice y Dashboard.
5. **Personalización deja de editar** moneda/símbolo/tasa (`A-84`).
6. **Medios del POS desde el catálogo persistido** + **disponibilidad por local** (`A-85`, `A-86`).
7. **Locale sin fingir cambio de base** (`A-87`).
8. **`Order.currencyCode`** + guardas del cambio de base (`A-89`, `D-022`, `D-023`).
9. **Caja consume `money`** y la config de monedas contables por local se vuelve genérica (`A-88`), con el
   cierre congelando base + tasas (`A-90`).
10. **Invoice formatea por la moneda congelada** y su estado financiero consume `payments`.

## Mutaciones que la suite debe matar (obligatorio)

Quitar el snapshot del POS · quitar el snapshot del Refund · volver a `BusinessSettings.usdExchangeRate` ·
aceptar un medio apagado o no permitido en el local · confiar en el `entityId` que manda React · convertir
un retry con la tasa vigente · permitir el cambio de base con un `Shift` abierto o con deuda pendiente.

## Pruebas obligatorias

- **Rojo real** antes de cada corrección material.
- **PostgreSQL real** para snapshots, migraciones, cambio de moneda base, idempotencia y concurrencia.
- Un caso con una moneda que **no** sea `NIO` ni `USD` (`EUR`/`MXN` como **fixture**): si ese caso necesita
  un `if EUR`, la arquitectura está mal.
- **Upgrade test** desde el esquema de producción anterior.
- **E2E local** de Finanzas + POS configurado + cobro + estado financiero, y **visual-check** contra
  `finance-reference.html`.
- Antes del merge: `security:secrets`, `lint`, `typecheck`, unit, contracts, PostgreSQL,
  `build`/`build:webpack`, E2E y **review adversarial**.

## Evidencia de producción: qué se puede y qué no se puede afirmar

**No** se afirma que una escritura peligrosa se probó en producción: los snapshots y las guardas se prueban
contra **PostgreSQL real** y en **E2E local**. En producción se verifican health, readiness, smokes y la
**lectura** autenticada de lo desplegado.

## Acceptance criteria

- [ ] Ninguna escritura productiva de `Payment`/`Refund` deja el snapshot en `null`.
- [ ] El retry del POS usa el `baseAmount` persistido.
- [ ] Un solo camino de lectura de la configuración monetaria en producción.
- [ ] Personalización no edita moneda, símbolo, locale financiero ni tasa.
- [ ] El POS ofrece los medios configurados, con su disponibilidad por local, y no acepta un medio apagado.
- [ ] El modal de formato guarda solo el locale.
- [ ] `Order.currencyCode` se escribe en todo alta nueva; el legacy no se rellena.
- [ ] El cambio de moneda base se rechaza con turno abierto o deuda pendiente.
- [ ] Caja cuenta monedas configurables (no `usdEnabled`), y un cierre nuevo se explica con N monedas.
- [ ] La impresión factura por la moneda congelada del documento.
- [ ] Las siete mutaciones exigidas ponen la suite en rojo.
- [ ] `A-81`…`A-90` cerrados con test, o degradados con el motivo escrito.
