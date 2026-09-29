import type { PaymentMethodType } from "@/modules/orders/domain/order.types";
import type { MoneyContext } from "@/modules/money/domain/money-context";
import { paymentMethodKindFor } from "@/modules/payments/domain/payment-method-kind";
import {
  buildPaymentSnapshotFor,
  type PaymentSnapshot,
} from "@/modules/payments/domain/payment-snapshot";
import { roundCurrency } from "@/shared/lib/order-totals";

import {
  convertPaymentToBusinessCurrency,
  recordedPaymentsBaseTotal,
} from "./payment-conversion";
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

/** Suma de los cobros convertidos a la moneda base vigente. Lanza si un cobro no se puede convertir. */
export function paymentsTotalInBusinessCurrency(input: {
  payments: PosSalePaymentInput[];
  money: MoneyContext;
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
        money: input.money,
      }),
    0,
  );

  return roundCurrency(total);
}

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-024`) — **los snapshots de la venta**, uno por
 * cobro y en el mismo orden.
 *
 * Es la puerta por la que pasa todo cobro del mostrador. Existe como función propia para que la use el caso
 * de uso **y** la escritura (`commitSale`): la escritura construye los suyos por si el llamador no los pasó
 * —un doble, un test, una superficie futura—, y así es **imposible** que el POS vuelva a escribir un `Payment`
 * con el snapshot en `null`, que era el hueco `A-81`.
 */
export function buildSalePaymentSnapshots(input: {
  payments: PosSalePaymentInput[];
  money: MoneyContext;
}): PaymentSnapshot[] {
  return input.payments.map((payment) =>
    buildPaymentSnapshotFor(
      {
        amount: payment.amount,
        currency: payment.currency,
        /**
         * `D-017` — el tipo **canónico** del momento. El medio del mostrador es el enum histórico
         * (`cash`/`card`/`transfer`/`other`); su semántica contable la traduce `payments`, que es la dueña de
         * la correspondencia. `mixed` no llega acá: se deriva de más de un cobro.
         */
        methodKind: paymentMethodKindFor(payment.method),
      },
      input.money,
    ),
  );
}

/**
 * Tarea 11 del brief (2026-09-17) — la misma suma, pero sobre los cobros **ya guardados**.
 *
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-020`) — **ya no convierte**: suma el
 * equivalente que cada cobro **congeló** cuando se registró. La versión anterior re-convertía con la tasa
 * vigente, así que el reintento de una venta devolvía un número distinto del que el cajero vio la primera
 * vez —y el saldo del pedido se movía solo si alguien cambiaba la tasa—. Un cobro legacy sin snapshot vale
 * `0` acá a propósito: el pasado no se reinterpreta (`D-020`).
 */
export function recordedPaymentsTotalInBusinessCurrency(input: {
  payments: readonly { baseAmount?: number | null }[];
}): number {
  return recordedPaymentsBaseTotal(input.payments);
}
