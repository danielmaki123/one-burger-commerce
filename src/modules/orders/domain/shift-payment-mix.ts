import type { PaymentRecord } from "@/modules/orders/domain/order.types";
import { convertToBusinessCurrency } from "@/shared/lib/money-conversion";
import { roundCurrency } from "@/shared/lib/order-totals";

import { ShiftError } from "./shift-errors";

/**
 * Tarea 1.2 del roadmap del POS + decisión del owner (2026-09-17) — el **desglose por método de pago** del
 * turno.
 *
 * El cierre congelaba solo el efectivo (lo que hay en el cajón) y el resto de la plata del día no aparecía
 * en ningún lado. Este resumen es la otra mitad: cuánto entró por tarjeta, por transferencia, el total, las
 * propinas y cuántos pedidos se cobraron. Lo consumen el **mensaje de cierre por Telegram** y (al cerrar) el
 * turno, con los mismos cobros que ya se leen para el arqueo: una sola fuente por cálculo.
 *
 * Cuatro reglas que no son obvias:
 *
 * 1. **La propina entra en su medio** (es plata que el cliente pagó con ese medio) y se informa aparte como
 *    detalle: sumarla otra vez al total sería contar doble.
 * 2. **El vuelto solo existe en efectivo**: es plata que no quedó en el cajón y se descuenta de la línea
 *    de efectivo (en tarjeta no hay cambio que dar, por eso `changeAmount` es 0).
 * 3. **Cada moneda se convierte** con la tasa cargada; sin tasa se rechaza en vez de sumar 10 dólares como
 *    10 córdobas (misma regla que el arqueo).
 * 4. **`orders` cuenta pedidos distintos**, no cobros: un pago partido es un pedido con dos cobros.
 *
 * `mixed` y `other` van juntos en `other`: son plata que entró sin ser efectivo ni una tarjeta de la
 * terminal, y esconderla dejaría el total sin explicar.
 */
export type ShiftPaymentMix = {
  /** Lo que entró en efectivo (monto + propina − vuelto), en la moneda del negocio. */
  cash: number;
  card: number;
  transfer: number;
  /** Mixto y otro: entró, pero no es efectivo ni una tarjeta de la terminal. */
  other: number;
  /** La suma de las cuatro líneas. Incluye las propinas. */
  total: number;
  /** Cuánto de ese total son propinas (detalle, no se suma otra vez). */
  tips: number;
  /** Pedidos distintos cobrados en el turno. */
  orders: number;
};

function toBusinessCurrency(
  amount: number,
  currency: string | null,
  input: { businessCurrencyCode: string; usdExchangeRate: number | null },
): number {
  const converted = convertToBusinessCurrency({
    amount,
    currency: currency ?? input.businessCurrencyCode,
    businessCurrencyCode: input.businessCurrencyCode,
    usdExchangeRate: input.usdExchangeRate,
  });

  if (!converted.ok) {
    throw new ShiftError(
      422,
      "VALIDATION_ERROR",
      converted.reason === "missing-rate"
        ? "Cargá el tipo de cambio del dólar en Configuración para cerrar una caja con dólares."
        : `Todavía no se cuenta en ${converted.currency}.`,
    );
  }

  return converted.amount;
}

/** Un turno sin cobros (o un cierre que no llegó a pasar): todo en cero, sin inventar líneas. */
export function emptyShiftPaymentMix(): ShiftPaymentMix {
  return { cash: 0, card: 0, transfer: 0, other: 0, total: 0, tips: 0, orders: 0 };
}

export function summarizeShiftPayments(input: {
  payments: readonly PaymentRecord[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): ShiftPaymentMix {
  const byMethod = { cash: 0, card: 0, transfer: 0, other: 0 };
  let tips = 0;

  for (const payment of input.payments) {
    const isCash = payment.method === "cash";
    // La propina la pagó el cliente con ese medio; el vuelto solo sale del efectivo.
    const amount = isCash
      ? payment.amount + payment.tip - payment.changeAmount
      : payment.amount + payment.tip;

    const converted = toBusinessCurrency(amount, payment.currency, input);

    tips = roundCurrency(tips + toBusinessCurrency(payment.tip, payment.currency, input));

    if (payment.method === "cash") byMethod.cash = roundCurrency(byMethod.cash + converted);
    else if (payment.method === "card") byMethod.card = roundCurrency(byMethod.card + converted);
    else if (payment.method === "transfer") byMethod.transfer = roundCurrency(byMethod.transfer + converted);
    else byMethod.other = roundCurrency(byMethod.other + converted);
  }

  return {
    ...byMethod,
    total: roundCurrency(byMethod.cash + byMethod.card + byMethod.transfer + byMethod.other),
    tips,
    orders: new Set(input.payments.map((payment) => payment.orderId)).size,
  };
}
