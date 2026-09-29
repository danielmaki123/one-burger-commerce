# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** Money / Payments quedó cerrado en **dos pasadas**: el **runtime** (órdenes **4 y 5**, `money` +
`payments`, las nueve migraciones, `/admin/finance` y la factura con **`paid` estricto**, `D-021`) y su
**cierre de aceptación**, que puso el snapshot en el POS y en la devolución, dejó **una sola** autoridad
monetaria, hizo que el POS ofrezca los medios y las monedas **configurados**, congeló la moneda del pedido
(`D-022`), convirtió el cambio de base en una operación de **período cerrado** (`D-023`) y sacó `usdEnabled` de
la estructura de Caja. `A-68`…`A-75` y `A-81`…`A-90` están **cerrados** y el release está **desplegado**
(`build-20260929-040610` sobre `main` = `32ca238`). Estado y evidencia: [`../CURRENT.md`](../CURRENT.md).
**Una sola TASK activa por vez**: la próxima no se abre sin **autorización explícita del owner**.

## NEXT

**`Pedidos runtime`** (orden **5b** del roadmap maestro): el recorte financiero del detalle compartido
(el remanente de `A-60`) y la clasificación de los read models. **No incluye todavía el cobro real de un
pedido existente ni su handoff al POS**: eso es el orden **6** («Pedido existente → Cobrar en POS»), que
**compone** el backend que ya existe (`POST /api/admin/orders/[id]/payment`) y cierra `A-67`. Necesita su
brief y su aprobación. **No se abre por iniciativa propia.**

## LATER

Los órdenes **6 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: «Pedido existente →
Cobrar en POS», Cash ownership, Configuración separada, Cierres / Facturas, Promotions ownership,
consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de
Catálogo y —al final— `Resumen`.
