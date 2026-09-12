import { roundCurrency } from "@/shared/lib/order-totals";

import type { OrderPaymentMethod } from "@/modules/orders/domain/order.types";

/**
 * Vuelto del pago en efectivo (T12).
 *
 * El cliente dice con cuánto va a pagar y el sistema calcula el cambio. Sirve
 * **en la caja**, no en la cocina: la comanda no necesita saber con qué billete
 * pagó alguien. No se guarda el cambio: se deriva del monto y el total, así no
 * puede quedar un número viejo si el total cambia.
 */

/**
 * Tope de cordura para el monto.
 *
 * No es una regla de negocio: es para que un dedazo (un cero de más) no deje un
 * "cambio" absurdo en la caja. Es relativo al total y no un número fijo, porque
 * la moneda la elige el negocio.
 */
export const MAX_PAID_WITH_TOTAL_MULTIPLIER = 20;

export type PaidWithValidationContext = {
  paidWithAmount: number | null | undefined;
  total: number;
  paymentMethod: OrderPaymentMethod;
};

/** Error del monto con el que paga el cliente, o `null` si está bien. */
export function validatePaidWithAmount({
  paidWithAmount,
  total,
  paymentMethod,
}: PaidWithValidationContext): string | null {
  if (paidWithAmount === null || paidWithAmount === undefined) return null;

  if (!Number.isFinite(paidWithAmount)) return "Tiene que ser un número";

  if (paymentMethod !== "cash") {
    return "El vuelto solo se calcula cuando pagás en efectivo";
  }

  if (paidWithAmount <= 0) return "Tiene que ser mayor que cero";

  if (paidWithAmount < total) return "Tiene que alcanzar para pagar el total";

  if (paidWithAmount > total * MAX_PAID_WITH_TOTAL_MULTIPLIER) {
    return "Es un monto demasiado alto para este pedido";
  }

  return null;
}

/**
 * Cambio que hay que devolver, o `null` si no hay monto declarado.
 *
 * No valida: eso es `validatePaidWithAmount`, que corre antes de guardar.
 */
export function calculateOrderChange({
  paidWithAmount,
  total,
}: {
  paidWithAmount: number | null | undefined;
  total: number;
}): number | null {
  if (paidWithAmount === null || paidWithAmount === undefined) return null;
  if (!Number.isFinite(paidWithAmount)) return null;

  return roundCurrency(Math.max(0, paidWithAmount - total));
}

/** Copy del ticket: `Cambio C$465.00` o `Sin cambio (paga con lo justo)`. */
export function formatOrderChangeLabel(
  change: number | null,
  formatCurrency: (value: number) => string,
): string | null {
  if (change === null) return null;

  return change === 0 ? "Sin cambio (paga con lo justo)" : `Cambio ${formatCurrency(change)}`;
}
