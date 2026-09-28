# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**`TASK-MONEY-PAYMENTS-RUNTIME-001`** (Money / Payments runtime, órdenes **4 y 5** en **una sola TASK**,
`high-risk-e2e`): **implementada y en PR** ([#85](https://github.com/danielmaki123/one-burger-commerce/pull/85)),
esperando el CI. Creó los módulos `money` y `payments`, las **nueve migraciones** del catálogo, las tasas, el
snapshot y la idempotencia, la puerta de la factura con **`paid` estricto** (`D-021`) y la superficie
`/admin/finance`. Cerró `A-68`, `A-71`, `A-72`, `A-73`, `A-74` y `A-75`; `A-69` quedó **parcial** (la suma
cruda multi-moneda de `pos-payment.tsx` sigue abierta). Estado y evidencia: [`../CURRENT.md`](../CURRENT.md).
**Una sola TASK activa por vez**: la próxima no se abre sin **autorización explícita del owner**.

## NEXT

**`Pedidos runtime`** (orden **5b** del roadmap maestro): el recorte financiero del detalle compartido
(el remanente de `A-60`), el cobro de un pedido existente desde Órdenes (`A-67`) y la clasificación de los
read models. Necesita su brief y su aprobación. **No se abre por iniciativa propia.**

## LATER

Los órdenes **6 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: «Pedido existente →
Cobrar en POS», Cash ownership, Configuración separada, Cierres / Facturas, Promotions ownership,
consolidación de la historia del pedido, saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de
Catálogo y —al final— `Resumen`.
