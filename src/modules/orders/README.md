# Módulo `orders`

El pedido y su ciclo de vida: alta desde el checkout, estados y su historial, seguimiento público,
promos con código, forma de pago y vuelto, PIN de retiro y las zonas de delivery/mesas que quedaron
**fuera del MVP** (siguen en el código, no se ofrecen en la UI ni en las APIs públicas).

Ver `AGENTS.md` (reglas), `.agents/CONTEXT.md` (cómo está construido el sistema), `ops/CURRENT.md`
(el estado real de hoy) y `src/modules/locations/README.md` (el local del pedido, T8).

## Estructura

```
domain/
  order.types.ts          OrderType/Status, etiquetas, formas de pago, registros públicos y de admin
  order-workflows.ts      transiciones válidas por tipo de pedido (delivery/pickup/table)
  order-errors.ts         OrderError (400/401/404/409/422)
  order-tracking.ts       hash del token de consulta del pedido
  payment-change.ts       el vuelto se DERIVA del monto y el total (no se guarda)
  pickup-pin.ts           PIN de 4 dígitos (azar del sistema, generador inyectable)
  coupon-eligibility.ts · promo-bogo.ts · promotion-rules.ts    promos y su alcance
ports/
  order-repository.ts     listOrders(filtros) / findOrderById / findOrderByOrderNumber / create /
                          updateStatus + historial + cupones + mesas
  delivery-zone-repository.ts
adapters/
  prisma-order-repository.ts · in-memory-order-repository.ts (doble completo, para tests)
  prisma-delivery-zone-repository.ts · in-memory-delivery-zone-repository.ts
features/
  create-order/           el alta real: precios, promos, totales, gate operativo, PIN y token
  get-order/              detalle del admin (con el punto de retiro resuelto)
  get-public-order/       detalle del cliente por token (sin datos internos)
  track-order/            seguimiento público (número + WhatsApp o token)
  list-admin-orders/      bandeja del admin (con el nombre del local)
  update-order-status/    cambio de estado con historial y nota
  validate-coupon/ · create-promotion/ · update-promotion/ · delete-promotion/ · list-promotions/
  delivery zones y `add-table-order-items` (fuera del MVP)
```

## Reglas

- **El servidor resuelve los precios.** El cliente manda `productId`, `quantity`, `modifierOptionIds`
  y `notes`; nunca un precio. `createOrder` lee el catálogo, aplica las excepciones del **local** (T8) y
  calcula los totales con `calculateOrderTotals` (el mismo módulo que usa el checkout para estimar).
- **`lineTotal = unitPrice × quantity` y el empaque va aparte** (`packagingTotalAmount`). Sumarlo en los
  dos lados fue un bug real de dinero mostrado (arreglado el 2026-09-12): si aparece un total distinto al
  que se cobra, mirar primero acá.
- **El pick-up es opcional y programable, incluso para días futuros.** El instante lo resuelve el cliente
  en la **zona del negocio** (`pickupInstant`), y el servidor lo valida contra el horario **del día
  elegido**; sin hora, el servidor completa con "ahora + preparación" usando su propio reloj.
- **El gate operativo es del local** (`resolveLocation` + `resolveOrderAcceptance`): horario, minutos de
  preparación, `isAcceptingOrders` y `closedMessage` del local del pedido (con la configuración del
  negocio como respaldo si no hay ningún local). El checkout evalúa la misma regla para no ofrecer un
  botón que va a fallar; **la decisión que vale es la del servidor** (rechaza con 409 y `fields.acceptance`).
- **Estados**: las transiciones válidas por tipo están en `order-workflows.ts` y son las únicas que acepta
  `updateOrderStatus`; cancelar exige una nota y todo cambio queda en el historial (estado, quién, cuándo).
- **El pedido guarda el `locationId`**, no el nombre ni la dirección del local: eso se resuelve al leer.
- **Seguimiento**: el cliente consulta con el token (`?token=`, guardado hasheado) o con número + WhatsApp.
  El payload público **no expone** WhatsApp, dirección, GPS ni el hash del token (hay tests que lo fijan).
- **Promos**: el código se normaliza en las dos puntas (mayúsculas/espacios) y **el servidor decide** el
  descuento; el checkout solo lo estima. Una promo con `usageLimit` agotado no se puede usar.
- **Pago**: `cash` o `card`, informativo (se cobra en el local). El **vuelto se deriva** del monto
  declarado y el total, así un total corregido no deja un vuelto viejo.
- **PIN de retiro**: cuatro dígitos para dictar en caja. **No autoriza, no identifica y no es único**.
- Fuera del MVP: zonas de delivery, `review-delivery-fee` y mesas siguen acá, pero sus APIs públicas
  fueron retiradas; no reactivarlas sin pedido explícito.

## Migraciones del módulo

`Order.locationId` (T8, con backfill), `paymentMethod` (T11), `paidWithAmount` (T12), `pickupPin` (T13) y
`pickupScheduled` (retiro programable). Todas con default o backfill: una base nueva arranca sin nulos.

## Superficies

| Superficie | Qué hace |
|---|---|
| `POST /api/orders` | alta del pedido (valida local, horario, promos, precios y PIN) |
| `GET /api/orders/[id]?token=` | detalle público (sin datos internos) |
| `POST /api/orders/track` | seguimiento por número + WhatsApp o token |
| `GET/PATCH /api/admin/orders[/[id][/status]]` | bandeja y operación del admin |
| `/admin/orders` · `/admin/orders/[id]` | bandeja por turno (con filtro por local) y detalle |
| `/checkout` · `/success/[orderId]` · `/activity` · `/orders` | alta, confirmación e historial del cliente |
