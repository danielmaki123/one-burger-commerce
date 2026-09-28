# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** `TASK-ORDERS-KITCHEN-RUNTIME-002` (Cocina runtime) está **mergeada** en `main` (PR #79) y
**falta su release**: la llamada a `deployService` devuelve **401** con el `EASYPANEL_TOKEN` del entorno,
así que el deploy está **bloqueado por credencial** (Stop Condition 6) y lo desbloquea el owner rotando el
token. Sin un segundo OK: con el token válido se dispara el release, se corre el QA de producción y se
cierra. **Una sola TASK activa por vez**: la próxima no se abre sin autorización explícita del owner.

## NEXT

**`Money / Payments ownership`** (órdenes **4 y 5** del roadmap maestro) y después **`Pedidos runtime`**
(orden **5b**), que es donde vive el recorte financiero del detalle (el remanente de `A-60`). Cada una
necesita su brief y su aprobación. **No se abre ninguna por iniciativa propia.**

## LATER

Los órdenes **6 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: «Pedido existente →
Cobrar en POS», Cash ownership, Configuración separada, Cierres / Facturas, Promotions ownership,
consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de
Catálogo y —al final— `Resumen`.

