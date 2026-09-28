# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** `TASK-ORDERS-KITCHEN-RUNTIME-002` (Cocina runtime) **cerró entera**: mergeada (`main`, PR #79 +
#80), **desplegada** (`build-20260928-035241` sobre `72b22b5`), con health/readiness, los dos smokes y el
**QA autenticado de producción** en los cuatro viewports. Estado y evidencia:
[`../CURRENT.md`](../CURRENT.md) §1 y §4. **Una sola TASK activa por vez**: la próxima no se abre sin
**autorización explícita del owner**.

## NEXT

**`Money / Payments ownership`** (órdenes **4 y 5** del roadmap maestro) y después **`Pedidos runtime`**
(orden **5b**), que es donde vive el recorte financiero del detalle (el remanente de `A-60`). Cada una
necesita su brief y su aprobación. **No se abre ninguna por iniciativa propia.**

## LATER

Los órdenes **6 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: «Pedido existente →
Cobrar en POS», Cash ownership, Configuración separada, Cierres / Facturas, Promotions ownership,
consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de
Catálogo y —al final— `Resumen`.

