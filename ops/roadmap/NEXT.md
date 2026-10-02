# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguna.** La orden **6** — `Pedido existente → Cobrar en POS` (`TASK-ORDER-POS-OPERATIONAL-006`,
`high-risk-e2e`)— quedó **cerrada, mergeada y desplegada** el **2026-10-02** (`build-20261002-042038` sobre
`main` = `5fda5e2`, PR #107). Entregó el **workspace operativo** del cajero en `/admin/pos`: banda de KPI
servida por el read model (`En proceso · Listos · Por cobrar · Programados`), panel operacional reutilizable,
modo **pedido existente** inmutable con cobro partido **atómico** y **exacto**, y entrega
(`ready_for_pickup → picked_up`) con la puerta nominal `canDeliverOrder`. **`/admin/orders` (Pedidos) sigue siendo la superficie administrativa**: el POS no pasa a ser dueño de Pedidos, Cocina, Dinero ni Cobros. Cerró `A-67`, corrigió la divergencia
de **`A-85`** y corrigió, al verificar, tres defectos reales del POS (cobro sin `terminalId`, refresco
automático que desarmaba el cobro en curso y el grid tapando el panel). Evidencia, mutaciones y excepciones:
[`../tasks/TASK-ORDER-POS-OPERATIONAL-006.md`](../tasks/TASK-ORDER-POS-OPERATIONAL-006.md).

**Una sola TASK activa por vez**, y ahora **no hay ninguna abierta**.

## NEXT

**`Cash ownership`** (orden **7** del roadmap maestro): Shift, apertura, movimientos, conteo, cierre, handover y
conciliación con dueño propio, más la consolidación de los cuatro runners de transacción (`A-79`).
**Necesita autorización explícita del owner**: que la próxima TASK no se abre sola es la regla, y por eso la
orden 7 **no arranca** hasta que el owner la pida. **Cerrar la orden 6 no la abre.**

## LATER

Los órdenes **7 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: Cash ownership,
Configuración separada, Cierres / Facturas, Promotions ownership, consolidación de la historia del pedido,
saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de Catálogo y —al final— `Resumen`.
