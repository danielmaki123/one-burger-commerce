import type { PaymentMethodType } from "@/modules/orders/domain/order.types";
import { roundCurrency } from "@/shared/lib/order-totals";

import { convertPaymentToBusinessCurrency } from "./payment-conversion";
import { PosError } from "./pos-errors";

/**
 * Bloque 4 del roadmap del POS (Fase 2) — **los medios que el mostrador cobra**, en una sola lista.
 *
 * Son los mismos tres lugares a la vez: lo que el cajero elige en pantalla, lo que acepta la API del cobro y
 * lo que queda guardado cuando la venta pasa a la espera (tareas 9.4/9.5). Estaban escritos tres veces; con
 * una sola lista no pueden desincronizarse.
 *
 * **`mixed` no está y es a propósito**: en el pedido existe —es el resultado de partir el cobro entre dos
 * medios— pero el cajero no lo elige, lo **deriva** de haber más de un cobro.
 */
export const POS_PAYMENT_METHODS = ["cash", "card", "transfer", "other"] as const;

export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export function isPosPaymentMethod(value: unknown): value is PosPaymentMethod {
  return typeof value === "string" && (POS_PAYMENT_METHODS as readonly string[]).includes(value);
}

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

/**
 * Tarea 11 del brief (2026-09-17) — la misma suma, sobre los cobros **ya guardados**.
 *
 * La necesita el reintento de un cobro: cuando el servidor reconoce la operación (misma clave de intento)
 * no registra los cobros otra vez —los duplicaría y el arqueo contaría la venta dos veces—, así que la
 * respuesta se arma con los que ya están. Un `Payment` viejo puede no tener moneda declarada (`null`): es
 * la del negocio.
 */
export function recordedPaymentsTotalInBusinessCurrency(input: {
  payments: readonly { amount: number; currency: string | null }[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  const total = input.payments.reduce(
    (sum, payment) =>
      sum +
      convertPaymentToBusinessCurrency({
        amount: payment.amount,
        currency: payment.currency ?? input.businessCurrencyCode,
        businessCurrencyCode: input.businessCurrencyCode,
        usdExchangeRate: input.usdExchangeRate,
      }),
    0,
  );

  return roundCurrency(total);
}
