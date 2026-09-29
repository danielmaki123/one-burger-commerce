/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`D-023`) — **qué es una obligación viva, dicho una vez**.
 *
 * Vive en `payments` —el módulo dueño del estado financiero del pedido (`D-016`)— y no en el adaptador de la
 * guarda: la pregunta «¿a este pedido todavía se le exige plata?» la contesta el dueño de la regla, y la
 * guarda del cambio de base sólo la consume. Antes cada consumidor decidía «pagado» con lo que tenía a mano;
 * ésta es la misma ley que aplica la proyección canónica, escrita para una **consulta masiva** (contar, no
 * proyectar uno por uno).
 */

/**
 * Los estados en los que un pedido **ya no le debe nada a nadie**: se entregó o se canceló.
 *
 * Es la lista de estados terminales del negocio. El orden y los nombres salen del flujo de trabajo del
 * pedido; un estado nuevo que sea terminal tiene que entrar acá, y por eso vive en un solo lugar.
 */
export const SETTLED_ORDER_STATUSES = [
  "delivered",
  "picked_up",
  "served",
  "closed",
  "cancelled",
] as const;

export function isSettledOrderStatus(status: string): boolean {
  return (SETTLED_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Cuánto se cobró de un pedido, **en los montos nominales de sus cobros activos**.
 *
 * Es la suma que usa la guarda del cambio de base para saber si un pedido sigue debiendo. Es
 * deliberadamente nominal —no usa el equivalente congelado— porque su única pregunta es «¿entró plata por
 * todo el total?»: un cobro legacy sin snapshot suma su monto y un pedido que en realidad estaba cobrado
 * puede contarse como pendiente. Es el lado seguro del error y **no** convierte nada con la tasa vigente,
 * que es lo que `D-020` prohíbe.
 */
export function chargedAmountOf(
  payments: readonly { amount: number | string | { toString(): string } }[],
): number {
  return payments.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0);
}
