import { roundCurrency } from "@/modules/money/domain/round-currency";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { hasMixedMethods, sumPaymentTotals } from "@/modules/payments/domain/payment-totals";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-020`, `D-021`) — **el estado financiero canónico del
 * pedido**. Un caso de uso dueño: `payments`. Los consumidores (`orders`, `invoices`, POS, React) lo
 * **consumen** y no lo recalculan.
 *
 * Antes de esto cada superficie decidía «pagado» con lo que tenía a mano: la factura con
 * `payments.length > 0`, el POS sumando montos **crudos** de monedas distintas, y el cobro de un pedido
 * existente comparando esa misma suma cruda contra el total (`A-68`: un pedido de C$365 aceptaba US$10 como
 * «10 pagados» y dejaba cobrar otros C$355).
 *
 * Tres reglas, y ninguna se negocia:
 *
 * 1. **`paidAmount` sólo suma lo demostrable**, en moneda base. El equivalente sale del **snapshot** del
 *    cobro (`baseAmount`), que es un hecho. Un cobro legacy sin snapshot **no se convierte con la tasa
 *    vigente**: eso sería inventar el pasado (ley 7, `D-020`).
 * 2. **`status` se deriva del saldo, no del conteo**, con precedencia exacta:
 *    `paid` ⇔ `outstandingAmount == 0` **y** `unresolvedAmount == 0`; si no, `partial` ⇔ `paidAmount > 0`
 *    **o** `unresolvedAmount > 0`; si no, `pending`.
 * 3. **Lo que no se puede demostrar se declara** (`unresolvedAmount`): el sistema dice «no se sabe», no
 *    «cero». Y un pedido con `unresolvedAmount > 0` **nunca** está `paid` ni habilita factura.
 *
 * El estado **no** es un campo de `Order`: es una proyección de los cobros, para que no pueda quedar
 * desincronizada del hecho que la produce. La aritmética de la suma vive en `payment-totals.ts`, una sola
 * vez, porque el tope del cobro y el POS suman con la misma función.
 */

export type OrderPaymentStatusValue = "pending" | "partial" | "paid";

/**
 * El alcance que no se puede liquidar, explícito. Lo usa el consumidor que necesita decir «esto no se cierra
 * hasta que alguien decida» en vez de tratar el pedido como cobrado.
 */
export const OUTSTANDING_UNRESOLVED = "unresolved" as const;

export type PaymentForFinancials = {
  id: string;
  amount: number;
  /** Moneda del cobro. `null` = la moneda del negocio (los cobros que no la declaran). */
  currency: string | null;
  /** La moneda base contra la que se convirtió. `null` en un cobro legacy. */
  baseCurrencyCode: string | null;
  /** La tasa aplicada. `null` en un cobro legacy. */
  exchangeRate: number | null;
  /** El equivalente en moneda base que produjo esa tasa. `null` en un cobro legacy. */
  baseAmount: number | null;
  /** El medio del cobro. `mixed` existe en la base histórica y **no** cuenta como medio (`D-017`). */
  method: string;
  createdAt: string;
  /** Si tiene marca de anulación, el cobro **no existió nunca para la plata** (`A-59`). */
  voidedAt: string | null;
};

export type OrderFinancialInput = {
  orderId: string;
  /** El total del pedido, en moneda base. */
  total: number;
  baseCurrencyCode: string;
  payments: readonly PaymentForFinancials[];
};

export type OrderPaymentStatus = {
  orderId: string;
  status: OrderPaymentStatusValue;
  /** Suma **demostrable** de los cobros no anulados, en moneda base. */
  paidAmount: number;
  /** `max(0, total − paidAmount)`: lo que falta cubrir. Sin contar lo no demostrable. */
  outstandingAmount: number;
  /** Plata cobrada cuyo equivalente **no se puede demostrar**. No es 0 por conveniencia: es «no se sabe». */
  unresolvedAmount: number;
  /** La moneda en la que están expresados los tres montos. */
  baseCurrencyCode: string;
  /** Cobros activos (lo que necesitan los consumidores para el detalle). */
  paymentCount: number;
  /** **Derivado**: más de un medio distinto. `mixed` no es un medio (`D-017`). */
  hasMixedMethods: boolean;
};

export type OrderFinancialDependencies = {
  /**
   * Resuelve el equivalente de un cobro **legacy** usando **datos persistidos existentes** —el snapshot de
   * un `Shift` que ya congeló su esperado en ambas monedas, un cobro hermano del mismo hecho—.
   *
   * Devuelve `null` cuando la equivalencia **no se puede demostrar**; el monto va entonces a
   * `unresolvedAmount`. Es una resolución **explícita y por caso**: nunca la tasa vigente (`D-020`).
   */
  resolveLegacyBaseAmount: (payment: PaymentForFinancials) => number | null;
};

export function projectOrderPaymentStatus(
  input: OrderFinancialInput,
  deps: OrderFinancialDependencies,
): OrderPaymentStatus {
  const baseCurrencyCode = currencyKey(input.baseCurrencyCode);
  const totals = sumPaymentTotals({
    payments: input.payments,
    baseCurrencyCode,
    demonstratedBaseAmount: (payment) => deps.resolveLegacyBaseAmount(payment as PaymentForFinancials),
  });

  const outstanding = roundCurrency(Math.max(0, input.total - totals.paidAmount));

  return {
    orderId: input.orderId,
    status: resolveStatus({
      paid: totals.paidAmount,
      outstanding,
      unresolved: totals.unresolvedAmount,
    }),
    paidAmount: totals.paidAmount,
    outstandingAmount: outstanding,
    unresolvedAmount: totals.unresolvedAmount,
    baseCurrencyCode,
    paymentCount: totals.count,
    hasMixedMethods: hasMixedMethods(totals.methods),
  };
}

/**
 * La precedencia exacta de `D-020`/`D-021`. Está en su propia función para que se lea como la regla que es
 * y para que ninguna superficie pueda inventar una variante.
 */
export function resolveStatus(input: {
  paid: number;
  outstanding: number;
  unresolved: number;
}): OrderPaymentStatusValue {
  if (input.outstanding === 0 && input.unresolved === 0) return "paid";
  if (input.paid > 0 || input.unresolved > 0) return "partial";

  return "pending";
}
