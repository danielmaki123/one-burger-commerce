# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**`Pedido existente → Cobrar en POS` — POS operativo del cajero** (orden **6** del roadmap maestro),
`TASK-ORDER-POS-OPERATIONAL-006`, `high-risk-e2e`, abierta el **2026-10-01** con autorización del owner.
`/admin/pos` pasa a ser el **workspace operativo** del cajero: banda de KPI operacionales servida por
`PosOperationalOrdersProjection` (En proceso · Listos · Por cobrar · Programados), panel operacional
reutilizable, modo **pedido existente** inmutable con cobro partido **atómico** y **exacto**, y entrega
(`ready_for_pickup → picked_up`) con la puerta nominal `canDeliverOrder`. Cierra `A-67`, revalida y corrige
la divergencia de **`A-85`** (el POS visible todavía no consumía `PaymentMethodConfig`) y registra el
hallazgo nuevo de **overpayment en cobro partido**. Brief y reuse audit:
[`../tasks/TASK-ORDER-POS-OPERATIONAL-006.md`](../tasks/TASK-ORDER-POS-OPERATIONAL-006.md).

**Una sola TASK activa por vez.** `Pedidos runtime` (orden **5b**) quedó **cerrada** el 2026-10-01: el
`OrderListProjection` administrativo, `canViewOrders`, el recorte financiero en servidor y
`resolveAdminLanding` son **entradas** de esta TASK, no trabajo pendiente.

## NEXT

**Ninguno hasta cerrar la orden 6.** La próxima es **`Cash ownership`** (orden **7**): Shift, apertura,
movimientos, conteo, cierre, handover y conciliación con dueño propio, más la consolidación de los cuatro
runners de transacción (`A-79`). Necesita **autorización explícita del owner**: que la próxima TASK no se
abre sola es la regla, y la orden 6 se cierra entera antes.

## LATER

Los órdenes **7 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: Cash ownership,
Configuración separada, Cierres / Facturas, Promotions ownership, consolidación de la historia del pedido,
saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de Catálogo y —al final— `Resumen`.
