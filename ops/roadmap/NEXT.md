# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** `Pedidos runtime` (orden **5b**) quedó **cerrada** el 2026-10-01: `/admin/orders` es el **read
model administrativo canónico** —listado paginado con los KPI del filtro completo, detalle con el historial
real con actor—, la puerta `canViewOrders` dejó a **cocina afuera** (403 y `/admin/kitchen`) y al **cajero
adentro**, el recorte financiero se aplica **en el servidor** y el aterrizaje por rol es **uno solo**
(`resolveAdminLanding`). Cerró `A-09`, `A-10`, `A-60`, `A-61`, `A-62`, `A-63`, el remanente de `A-64`, `A-66`
y la autorización mínima de `A-70`; el detalle y la evidencia viven en [`../CURRENT.md`](../CURRENT.md).
**Una sola TASK activa por vez**: la próxima no se abre sin **autorización explícita del owner**.

## NEXT

**`Pedido existente → Cobrar en POS`** (orden **6** del roadmap maestro): Órdenes **localiza** el pedido y el
POS lo **cobra**, componiendo el backend que ya existe (`POST /api/admin/orders/[id]/payment`) y cerrando
`A-67`. **No se abre por iniciativa propia**: necesita su brief y su aprobación.

## LATER

Los órdenes **6 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: «Pedido existente →
Cobrar en POS», Cash ownership, Configuración separada, Cierres / Facturas, Promotions ownership,
consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de
Catálogo y —al final— `Resumen`.
