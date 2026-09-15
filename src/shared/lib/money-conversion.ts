import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * TASK-305 — cuánto vale un monto en la moneda del negocio.
 *
 * La regla (una sola tasa configurable para el dólar) la necesitan **dos** módulos: el POS, para
 * saber cuánto cubre un cobro, y el arqueo, para saber cuánto entró al cajón. Vive acá, sin errores
 * de dominio ni I/O, y cada módulo traduce el fallo a **su** error: el POS a `PosError` y la caja a
 * `ShiftError`. Si cada uno tuviera su aritmética, un día dirían números distintos.
 */

/** La única moneda extranjera que el negocio toma hoy (decisión del owner, 2026-09-14). */
export const SUPPORTED_FOREIGN_CURRENCY = "USD";

export type ConversionFailure =
  | { ok: false; reason: "missing-rate"; currency: string }
  | { ok: false; reason: "unsupported-currency"; currency: string };

export type ConversionResult = { ok: true; amount: number } | ConversionFailure;

export function convertToBusinessCurrency(input: {
  amount: number;
  currency: string;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): ConversionResult {
  const currency = input.currency.trim().toUpperCase();
  const businessCurrency = input.businessCurrencyCode.trim().toUpperCase();

  if (currency === businessCurrency) {
    return { ok: true, amount: roundCurrency(input.amount) };
  }

  if (currency !== SUPPORTED_FOREIGN_CURRENCY) {
    return { ok: false, reason: "unsupported-currency", currency };
  }

  const rate = input.usdExchangeRate;
  if (rate === null || !Number.isFinite(rate) || rate <= 0) {
    return { ok: false, reason: "missing-rate", currency };
  }

  return { ok: true, amount: roundCurrency(input.amount * rate) };
}
