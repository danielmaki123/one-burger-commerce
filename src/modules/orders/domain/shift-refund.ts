import { convertAmountToBase } from "@/modules/money/domain/convert-to-base-currency";
import { roundCurrency } from "@/modules/money/domain/round-currency";
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

/**
 * El neto de las devoluciones en la moneda del negocio (siempre negativo o 0).
 *
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69a`, `D-019`) — la regla propia murió: el `"USD"` hardcodeado y
 * el `toFixed(2)` de este archivo eran la copia que redondeaba distinto que el resto del sistema. Ahora el
 * equivalente sale de `money` (`convertToBaseCurrency`, `monto × tasa`) y el redondeo de `roundCurrency`,
 * con la tasa que llega como **dato** —una por moneda— porque cuál es y cuánto vale es configuración del
 * negocio, no estructura del código.
 *
 * Sin la tasa de una moneda **no se inventa un equivalente**: un arqueo que resta 20 dólares como si
 * fueran 20 córdobas «cierra» con un faltante que nadie puede explicar. Falla y lo dice.
 */
export function refundsTotalInBusinessCurrency(input: {
  refunds: RefundRecord[];
  businessCurrencyCode: string;
  /** Tasa vigente por moneda (`{ USD: 36.5 }`): cuántas unidades de la base vale una de la moneda. */
  rates: Record<string, number | null | undefined>;
}): number {
  const byCurrency = refundsTotalByCurrency(input.refunds);

  let total = 0;

  for (const [currency, amount] of Object.entries(byCurrency)) {
    const converted = convertAmountToBase({
      amount,
      currency,
      baseCurrencyCode: input.businessCurrencyCode,
      rates: input.rates,
    });

    if (converted === null) {
      throw new Error(
        `No hay tasa de cambio para ${currency}: el arqueo no puede restar un monto en otra moneda.`,
      );
    }

    total += converted;
  }

  return roundCurrency(total);
}
