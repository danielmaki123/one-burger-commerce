import { roundCurrency } from "@/modules/money/domain/round-currency";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-020`, `D-017`, `A-59`) — **la aritmética del saldo del pedido**.
 *
 * Existe una sola vez, y por eso vive acá y no en cada consumidor: la proyección del estado financiero
 * (`projectOrderPaymentStatus`), el **tope** del cobro (`A-68`) y el **POS** tienen que sumar lo mismo. La
 * auditoría de la fundación encontró exactamente lo contrario —tres saldos ad-hoc y una suma cruda en
 * React—, y ése es el defecto que esta función cierra.
 *
 * Tres reglas:
 *
 * 1. **Un cobro anulado no cuenta**: no existió nunca para la plata (`A-59`).
 * 2. **Sólo se suma el equivalente demostrable.** Un cobro con snapshot aporta su `baseAmount`; un cobro en
 *    la moneda base aporta su monto (es una **identidad**, no una conversión); un cobro legacy en otra
 *    moneda aporta **sólo** si un dato persistido demuestra su equivalencia (`D-020`). Nunca se convierte
 *    con la tasa vigente.
 * 3. **`mixed` no es un medio** (`D-017`): se deriva de más de un `Payment`.
 */
export type PaymentMetric = {
  id: string;
  amount: number;
  /** Moneda del cobro. `null` = la moneda del negocio. */
  currency: string | null;
  /** La moneda base contra la que se convirtió. `null` en un cobro legacy. */
  baseCurrencyCode?: string | null;
  /** El equivalente que produjo la tasa. `null` en un cobro legacy. */
  baseAmount?: number | null;
  method: string;
  voidedAt: string | null;
};

export type PaymentTotals = {
  /** Suma **demostrable** de los cobros vigentes, en moneda base. */
  paidAmount: number;
  /** Cobros vigentes. */
  count: number;
  /** Plata cobrada cuyo equivalente no se puede demostrar. Se declara: no es cero. */
  unresolvedAmount: number;
  /** Los medios distintos. `mixed` no aporta ninguno. */
  methods: string[];
};

export type PaymentTotalsInput = {
  payments: readonly PaymentMetric[];
  baseCurrencyCode: string;
  /**
   * La evidencia de un cobro **legacy**, cuando existe: el snapshot de un cierre que ya congeló el esperado
   * en ambas monedas, un cobro hermano del mismo hecho. Se resuelve **por caso**, no por regla general.
   */
  demonstratedBaseAmount?: (payment: PaymentMetric) => number | null;
};

/** El equivalente demostrable de un cobro, o `null`. El orden importa: primero el snapshot del hecho. */
function demonstratedBaseAmount(
  payment: PaymentMetric,
  base: string,
  resolver?: (payment: PaymentMetric) => number | null,
): number | null {
  const paymentBase = payment.baseCurrencyCode ? currencyKey(payment.baseCurrencyCode) : null;
  const amount = payment.baseAmount ?? null;

  if (amount !== null && paymentBase !== null) {
    // Un cobro convertido contra **otra** moneda base conserva su equivalente y no se traduce a la base de
    // hoy: cambiar la moneda base no recalcula nada (`D-018`).
    return paymentBase === base ? roundCurrency(amount) : null;
  }

  // Identidad: si entró en la moneda base, su equivalente **es** su monto. No hace falta una tasa.
  const currency = payment.currency ? currencyKey(payment.currency) : base;
  if (currency === base) return roundCurrency(payment.amount);

  const resolved = resolver ? resolver(payment) : null;

  return resolved === null ? null : roundCurrency(resolved);
}

/**
 * Suma los cobros de un pedido en **una sola moneda**. Nunca deja que un equivalente no demostrable se
 * cuente como cobrado.
 */
export function sumPaymentTotals(input: PaymentTotalsInput): PaymentTotals {
  const base = currencyKey(input.baseCurrencyCode);
  const methods = new Set<string>();

  let paidAmount = 0;
  let unresolvedAmount = 0;
  let count = 0;

  for (const payment of input.payments) {
    if (payment.voidedAt !== null) continue;

    count += 1;

    const demonstrated = demonstratedBaseAmount(payment, base, input.demonstratedBaseAmount);

    if (demonstrated === null) {
      unresolvedAmount += payment.amount;
    } else {
      paidAmount += demonstrated;
    }

    // `mixed` puede existir en la base y se muestra tal cual era, pero no es un medio: no aporta uno propio.
    if (payment.method !== "mixed") methods.add(payment.method);
  }

  return {
    paidAmount: roundCurrency(paidAmount),
    count,
    unresolvedAmount: roundCurrency(unresolvedAmount),
    methods: [...methods],
  };
}

/** Más de un medio distinto. Es la definición de «mixto» del sistema (`D-017`). */
export function hasMixedMethods(methods: readonly string[]): boolean {
  return new Set(methods).size > 1;
}

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-74`, `D-020`) — **el equivalente en moneda base de una devolución**.
 *
 * El dashboard restaba `Refund.amount` **crudo** del total del pedido, ignorando `Refund.currency`: una
 * devolución de `US$20` sobre un pedido en córdobas restaba 20 al neto en vez de su equivalente. Es la
 * contracara de `A-58` (que ya había cerrado *qué* se descuenta) y un caso de `A-69` que quedó fuera de su
 * lista.
 *
 * La regla es la misma que la del cobro, y por eso vive al lado:
 *
 * 1. si la devolución congeló su `baseAmount`, se usa **ese** hecho;
 * 2. si su moneda **es** la moneda base, el equivalente es una **identidad** (`20 NIO` vale `20 NIO`), no
 *    una conversión;
 * 3. si no, se resuelve sólo con un dato persistido que lo demuestre —nunca con la tasa vigente (`D-020`)—;
 * 4. y si no se puede demostrar, devuelve **`null`**: la devolución se declara, no se resta un número que
 *    nadie puede explicar.
 */
export function refundBaseAmount(input: {
  refund: {
    amount: number;
    currency: string;
    baseCurrencyCode?: string | null;
    baseAmount?: number | null;
  };
  baseCurrencyCode: string;
  demonstratedBaseAmount?: number | null;
}): number | null {
  const base = currencyKey(input.baseCurrencyCode);
  const refundBase = input.refund.baseCurrencyCode ? currencyKey(input.refund.baseCurrencyCode) : null;
  const stored = input.refund.baseAmount ?? null;

  if (stored !== null && refundBase !== null) {
    // Una devolución convertida contra **otra** moneda base conserva su equivalente: cambiar la base no
    // recalcula nada (`D-018`).
    return refundBase === base ? roundCurrency(stored) : null;
  }

  if (currencyKey(input.refund.currency) === base) return roundCurrency(input.refund.amount);

  const demonstrated = input.demonstratedBaseAmount ?? null;

  return demonstrated === null ? null : roundCurrency(demonstrated);
}
