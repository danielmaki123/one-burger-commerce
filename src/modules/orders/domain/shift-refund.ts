import type { RefundRecord } from "@/modules/orders/domain/order.types";

export type { RefundRecord } from "@/modules/orders/domain/order.types";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — las devoluciones y el arqueo del turno.
 *
 * Una devolución **en efectivo** saca plata del cajón: si no entra al esperado, el cierre marca
 * faltante y el cajero queda como responsable de plata que devolvió con motivo. Tres reglas:
 *
 * 1. Solo resta el efectivo: una devolución de tarjeta no pasó por el cajón.
 * 2. Solo resta lo **aprobado**: una pendiente todavía no salió y una rechazada no salió nunca.
 * 3. Resta en **su** moneda: devolver US$20 no puede restar 20 córdobas.
 */
export function refundsTotalByCurrency(refunds: RefundRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const refund of refunds) {
    if (refund.status !== "approved") continue;
    if (refund.method !== "cash") continue;

    const currency = refund.currency.trim().toUpperCase();
    totals[currency] = totals[currency] ?? 0;
    totals[currency] = Number((totals[currency] - refund.amount).toFixed(2));
  }

  return totals;
}

/** El neto de las devoluciones en la moneda del negocio (siempre negativo o 0). */
export function refundsTotalInBusinessCurrency(input: {
  refunds: RefundRecord[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  const byCurrency = refundsTotalByCurrency(input.refunds);

  return Number(
    Object.entries(byCurrency)
      .reduce((sum, [currency, amount]) => {
        const rate =
          currency === input.businessCurrencyCode.trim().toUpperCase()
            ? 1
            : currency === "USD"
              ? input.usdExchangeRate
              : null;

        if (rate === null) {
          throw new Error(`No hay tasa de cambio para ${currency}.`);
        }

        return sum + amount * rate;
      }, 0)
      .toFixed(2),
  );
}
