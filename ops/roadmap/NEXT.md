# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** `TASK-GOV-001` **cerró** (mergeada, `docs-only`, sin deploy) y no hay ninguna TASK de runtime en
curso: **una sola TASK activa por vez** y la próxima **no se abre sin autorización explícita del owner**.
Estado y evidencia: [`../CURRENT.md`](../CURRENT.md) § 4.

## NEXT

**Auditoría y diseño de `Pedidos / Cocina`** (orden 3 del roadmap), **pendiente de que el owner autorice la
TASK**: hoy Órdenes es una sola superficie y mezcla la bandeja de operación con la vista de cocina. Cuando se
autorice, arranca con la **auditoría real** de las dos necesidades, el **reuse audit** y la decisión de
**ownership** (¿una pantalla con dos vistas o dos entradas?), y sigue con la spec y su aprobación antes de
tocar código.

Antes de abrirla: leer [`../CURRENT.md`](../CURRENT.md) § 4–5 y el orden autoritativo del
[roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2.

## LATER

Los órdenes **4 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: Money ownership,
Payments ownership, «Pedido existente → Cobrar en POS», Cash ownership, Configuración separada, Cierres /
Facturas, Promotions ownership, consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`,
Table Service/Mesas, refinamiento de Catálogo y —al final— `Resumen`.

**No se abre ninguna de esas TASK por iniciativa propia**: cada una necesita su brief y su aprobación.
