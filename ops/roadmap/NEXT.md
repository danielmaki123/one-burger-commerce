# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** `TASK-MONEY-PAYMENTS-FOUNDATIONS-001` (fundaciones de Money / Payments) **cerró entera**:
mergeada (`main`), `docs-only`, **sin deploy** — no tocó runtime, Prisma, migraciones, APIs ni navegación.
Dejó la auditoría real, el ownership, los contratos, el snapshot, la idempotencia, los boundaries y el **Design
Freeze de Finanzas** ([`../design/screens/finance.md`](../design/screens/finance.md) + su
[referencia aprobada](../design/screens/finance-reference.html), aprobada por el owner el 2026-09-27). Estado y
evidencia: [`../CURRENT.md`](../CURRENT.md). **Una sola TASK activa por vez**: la próxima no se abre sin
**autorización explícita del owner**.

## NEXT

**`Money / Payments runtime`** (órdenes **4 y 5** del roadmap maestro, **una sola TASK**): crear los módulos
`money` y `payments`, implementar el catálogo de monedas y el historial de tasas, cerrar `A-68` (el cobro sin
convertir), `A-71` (idempotencia) y `A-72` (la tasa en el hecho), proyectar el estado financiero canónico
(`pending` / `partial` / `paid`) y ampliar `banks` con el tipo de entidad. Después **`Pedidos runtime`**
(orden **5b**), que es donde vive el recorte financiero del detalle (el remanente de `A-60`). Cada una necesita
su brief y su aprobación. **No se abre ninguna por iniciativa propia.**

## LATER

Los órdenes **6 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: «Pedido existente →
Cobrar en POS», Cash ownership, Configuración separada, Cierres / Facturas, Promotions ownership,
consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de
Catálogo y —al final— `Resumen`.
