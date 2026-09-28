# NEXT — secuencia inmediata

> **Qué es**: la secuencia inmediata del [roadmap maestro de producto y UX](PRODUCT-UX-ROADMAP.md)
> (`ops/roadmap/PRODUCT-UX-ROADMAP.md`), que es el **único** roadmap. Acá no se decide el orden: se dice qué
> está activo hoy, qué sigue y qué queda lejos. **Regla de tamaño**: este archivo se mantiene **chico**
> (≤ 60 líneas). Si crece, el detalle se va al roadmap o a `CURRENT.md`.

## ACTIVE

**Ninguno.** `TASK-ORDERS-KITCHEN-FOUNDATIONS-001` **cerró** (mergeada, `docs-only`, sin deploy) y no hay
ninguna TASK de runtime en curso: **una sola TASK activa por vez**, y la próxima no se abre sin
**autorización explícita del owner**. Estado y evidencia: [`../CURRENT.md`](../CURRENT.md) § 4.

## NEXT

**`TASK-ORDERS-KITCHEN-RUNTIME-002` — Cocina runtime** (orden **3b** del roadmap): `/admin/kitchen` como
**proyección de `orders`**, con el carril de `confirmed` corregido y el canal de origen.
**Delivery Mode a declarar: `high-risk-e2e`** (toca `auth` + esquema). Specs y Design Freeze:
[`../design/screens/kitchen.md`](../design/screens/kitchen.md) (contrato:
[`kitchen-reference.html`](../design/screens/kitchen-reference.html), owner 2026-09-27).
Brief: [`TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md`](../tasks/TASK-ORDERS-KITCHEN-FOUNDATIONS-001.md).

**Runtime que podrá tocar** (y nada más):

- `src/app/(admin)/admin/kitchen/**` (página y componentes) y su entrada en
  `src/app/(admin)/admin/admin-layout-helpers.ts`.
- La ruta nueva de la API de la proyección (src/app/api/admin/kitchen/orders/route.ts, aún sin crear) y el
  caso de uso `src/modules/orders/features/list-kitchen-orders/**`.
- `src/modules/orders/domain/` (mapa canónico de carriles movido desde la app, sellos por etapa en
  `order-stage-times.ts`, `order.types.ts`) y `src/modules/orders/ports/order-repository.ts` + sus dos
  adaptadores.
- `prisma/schema.prisma` + **una** migración aditiva sin BOM: `Order.source` (canal), escrito por las **dos**
  puertas de creación (`create-order.ts`/`api/orders/route.ts` → menú; `commit-sale.ts` → POS).
- `src/modules/auth/domain/admin-permissions.ts` (+ test), `canOperateKitchen` y el recorte financiero del
  servidor en `src/app/api/admin/orders/[id]/route.ts`.
- `src/app/(admin)/admin/orders/**`: **sólo** para sacar de ahí el tablero y el modo cocina.

**Prohibido duplicar** en esa TASK:

- **Nada** de dinero: ni `Payment`, ni `money`, ni `invoices`, ni el estado financiero `pending`/`partial`/`paid`.
- Un `modules/kitchen`, un dominio nuevo o un segundo mapa estado→carril (se **mueve** el existente).
- `order-workflows.ts`, `calculateOrderTotals`, `order-search`, `order-visibility`, los umbrales del local, el
  polling, la frescura, el sonido ni el alcance por sucursal.
- La preparación desde `createdAt`, ni el inicio recomendado ni el saldo calculados en React.
- `POST /api/admin/orders/[id]/payment` (se **compone**, no se reconstruye).
- Un `source` inferido por heurística, o un backfill que adivine el pasado.

## LATER

Los órdenes **4 a 16** del [roadmap maestro](PRODUCT-UX-ROADMAP.md) § 2, en ese orden: Money ownership,
Payments ownership, Pedidos runtime (**5b**), «Pedido existente → Cobrar en POS», Cash ownership,
Configuración separada, Cierres / Facturas, Promotions ownership, consolidación de la historia del pedido,
saneamiento `FROZEN`/`LEGACY`, Table Service/Mesas, refinamiento de Catálogo y —al final— `Resumen`.

**No se abre ninguna de esas TASK por iniciativa propia**: cada una necesita su brief y su aprobación.
