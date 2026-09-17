import type { PaymentMethodType } from "@/modules/orders/domain/order.types";
import { roundCurrency } from "@/shared/lib/order-totals";

import { convertPaymentToBusinessCurrency } from "./payment-conversion";
import { PosError } from "./pos-errors";

/**
 * TASK-303b — los cobros de una venta de mostrador.
 *
 * Un cobro puede llegar en la moneda del negocio o en dólares, y el arqueo necesita saber **en qué
 * moneda entró** cada uno (de nada sirve saber que "entraron 365" si en el cajón hay 10 billetes de
 * dólar). Por eso cada cobro viaja con su moneda y acá se suma **convertido a la moneda del
 * negocio**, que es la que se compara contra el total del pedido.
 */

export type PosSalePaymentInput = {
  /**
   * Bloque 4 del roadmap del POS (Fase 2) — el medio del **cobro real**, no la declaración del
   * cliente: son los del enum `PaymentMethodType` (efectivo, tarjeta, transferencia, mixto, otro). El
   * checkout público sigue ofreciendo dos porque ahí el cliente **declara** cómo va a pagar.
   */
  method: PaymentMethodType;
  /** Moneda en la que el cliente paga (la del negocio o el dólar). */
  currency: string;
  /** Monto **en esa moneda**. */
  amount: number;
  /** Referencia externa del cobro (voucher, id de transferencia). Opcional. */
  reference?: string | null;
};

/** Suma de los cobros convertidos a la moneda del negocio. Lanza si un cobro no se puede convertir. */
export function paymentsTotalInBusinessCurrency(input: {
  payments: PosSalePaymentInput[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  if (input.payments.length === 0) {
    throw new PosError(422, "VALIDATION_ERROR", "Registrá al menos un cobro.", {
      payments: "Registrá al menos un cobro.",
    });
  }

  const total = input.payments.reduce(
    (sum, payment) =>
      sum +
      convertPaymentToBusinessCurrency({
        amount: payment.amount,
        currency: payment.currency,
        businessCurrencyCode: input.businessCurrencyCode,
        usdExchangeRate: input.usdExchangeRate,
      }),
    0,
  );

  return roundCurrency(total);
}
