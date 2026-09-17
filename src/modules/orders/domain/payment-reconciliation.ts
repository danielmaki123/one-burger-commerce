import type { PaymentMethodType, PaymentRecord } from "@/modules/orders/domain/order.types";

/**
 * Tarea 10 del brief (2026-09-17) — la **conciliación de tarjeta y transferencia** (11.1/11.2).
 *
 * El arqueo del cajón ya dice si el efectivo cuadra. Lo que no tenía ninguna superficie era la otra plata
 * del día: la que entró por la **terminal** (que se liquida contra un lote) y por **transferencia** (que
 * aparece en el extracto del banco). El owner comparaba eso a mano.
 *
 * Tres decisiones que valen la pena:
 *
 * 1. **El efectivo no entra**: su cuadre es el arqueo del turno (`expectedAmount`), no un lote externo.
 * 2. **Cada moneda se cuenta en la suya**: un cobro en dólares convertido con la tasa de hoy sería un
 *    número que el lote de la terminal nunca tuvo. La conciliación se hace contra el papel del banco o de
 *    la terminal, y ahí los dólares están en dólares.
 * 3. **Lo que no es tarjeta ni transferencia se informa aparte** (`mixed`, `other`): esconderlo dejaría
 *    plata del día sin explicar, y meterlo en el total de tarjeta haría que ese total no cuadre nunca.
 *
 * Dominio puro, sin I/O: se prueba solo.
 */

/** Las formas de pago que se concilian contra un tercero (terminal o banco), en el orden que se muestran. */
export const RECONCILIATION_METHODS = ["card", "transfer"] as const;

export type ReconciliationMethod = (typeof RECONCILIATION_METHODS)[number];

export function isReconciliationMethod(method: PaymentMethodType): method is ReconciliationMethod {
  return (RECONCILIATION_METHODS as readonly string[]).includes(method);
}

export type ReconciliationMethodTotals = {
  method: ReconciliationMethod;
  /** Cuántos cobros entraron por esta vía. */
  count: number;
  /** El total por moneda: `{ NIO: 750.5, USD: 20 }`. Vacío cuando no hubo cobros. */
  byCurrency: Record<string, number>;
};

export type ReconciliationSummary = {
  /** Tarjeta y transferencia, siempre las dos (en cero si no hubo). */
  methods: ReconciliationMethodTotals[];
  /** Lo demás que no es efectivo: informado, fuera del export. */
  others: { count: number; byCurrency: Record<string, number> };
};

/** La moneda del cobro: `null` en `Payment` significa la del negocio. */
function currencyOf(payment: PaymentRecord, baseCurrencyCode: string): string {
  return (payment.currency ?? baseCurrencyCode).toUpperCase();
}

/** Suma montos por moneda. La propina **no** entra en el monto: el lote del banco trae lo cobrado. */
function totalsOf(
  payments: readonly PaymentRecord[],
  baseCurrencyCode: string,
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const payment of payments) {
    const currency = currencyOf(payment, baseCurrencyCode);

    totals[currency] = (totals[currency] ?? 0) + payment.amount;
  }

  return totals;
}

export function summarizeReconciliation(
  payments: readonly PaymentRecord[],
  options: { baseCurrencyCode: string },
): ReconciliationSummary {
  // El efectivo queda afuera de las dos listas: no se concilia contra un tercero ni es «otra forma» de
  // pago sin explicar — su cuadre es el arqueo del cajón.
  const fromOthers = payments.filter(
    (payment) => payment.method !== "cash" && !isReconciliationMethod(payment.method),
  );

  return {
    methods: RECONCILIATION_METHODS.map((method) => {
      const matching = payments.filter((payment) => payment.method === method);

      return {
        method,
        count: matching.length,
        byCurrency: totalsOf(matching, options.baseCurrencyCode),
      };
    }),
    others: {
      count: fromOthers.length,
      byCurrency: totalsOf(fromOthers, options.baseCurrencyCode),
    },
  };
}
