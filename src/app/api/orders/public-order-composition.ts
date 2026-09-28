import type { CreateOrderRequest } from "@/modules/orders/features/create-order/create-order";

/**
 * La composición del alta del **menú público**: qué `source` declara esta puerta y con qué datos de
 * servidor se completa el pedido.
 *
 * Vive acá —y no dentro del `route.ts`— por dos motivos: el handler se queda en su tope de líneas y
 * *orquesta*, y estas tres decisiones se pueden probar solas:
 *
 * 1. **El canal de origen** (`TASK-ORDERS-KITCHEN-RUNTIME-002`) lo declara **la puerta**, no el cliente:
 *    este es el menú público, así que el pedido entra como `menu`. Va **después** del cuerpo del request
 *    a propósito: un cuerpo hostil no puede elegir el canal.
 * 2. **La hora prometida la fija el servidor**: la que eligió el cliente o «ahora + preparación» con el
 *    reloj del servidor. Si el cliente mandara su propia hora, un formulario lento la volvería una hora
 *    del pasado.
 * 3. **`pickupScheduled` se deriva** de si vino una hora: el cliente no puede declararse programado sin
 *    haber elegido nada.
 */
export function buildPublicOrderInput(input: {
  /** Lo que validó el `querySchema` de la ruta, sin la hora ni la clave. */
  parsed: Omit<CreateOrderRequest, "source" | "pickupTime" | "pickupScheduled" | "idempotencyKey">;
  /** La hora que resolvió `resolveOrderAcceptance` (la elegida o «ahora + preparación»). */
  acceptancePickupTime: Date;
  /** Si el cliente había pedido una hora (no es «lo antes posible»). */
  requestedPickupTime: boolean;
  idempotencyKey?: string | null;
}): CreateOrderRequest {
  return {
    ...input.parsed,
    source: "menu",
    pickupTime: input.acceptancePickupTime.toISOString(),
    pickupScheduled: input.requestedPickupTime,
    idempotencyKey: input.idempotencyKey ?? null,
  };
}
