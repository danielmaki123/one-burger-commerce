import { convertToBaseCurrency } from "@/modules/money/domain/convert-to-base-currency";
import type { ConversionResult } from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-305` → `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **la cáscara de compatibilidad del dólar**.
 *
 * La aritmética de la conversión vive **una sola vez** en `money` (`convertToBaseCurrency`). Esto queda
 * para los call sites que todavía no migraron —el POS y el arqueo pasan una sola tasa, la del dólar,
 * leída de la configuración vieja—: mapea `usdExchangeRate` al mapa `{ USD: rate }` y deja que la regla
 * sea la misma. Una segunda multiplicación acá sería la copia número seis que la auditoría midió
 * (`A-69`).
 *
 * `knownCurrencyCodes` acota el catálogo a la moneda base y al dólar **para conservar el contrato
 * histórico**: una moneda que no es ninguna de las dos es `unsupported-currency` («todavía no se cobra en
 * esa moneda»), no `missing-rate` («falta cargar la tasa»), que son dos arreglos distintos.
 */

/**
 * La única moneda extranjera que el negocio tomaba cuando esta regla se escribió (decisión del owner,
 * 2026-09-14).
 *
 * @deprecated `D-019`: el catálogo de monedas es del negocio y no una lista cerrada. Se conserva sólo
 * para los call sites viejos que todavía pasan una única tasa; el código nuevo usa
 * `convertToBaseCurrency` con la tasa de **la** moneda que corresponda.
 */
export const SUPPORTED_FOREIGN_CURRENCY = "USD";

/**
 * Convierte un cobro a la moneda del negocio con la tasa del dólar.
 *
 * @deprecated Usá `convertToBaseCurrency` (o `money/features/convert-amount`) con la tasa vigente de la
 * moneda; esta forma no puede expresar más de una moneda extranjera.
 */
export function convertToBusinessCurrency(input: {
  amount: number;
  currency: string;
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): ConversionResult {
  return convertToBaseCurrency(
    { amount: input.amount, currency: input.currency },
    {
      baseCurrencyCode: input.businessCurrencyCode,
      rates: { [SUPPORTED_FOREIGN_CURRENCY]: input.usdExchangeRate },
      knownCurrencyCodes: [input.businessCurrencyCode, SUPPORTED_FOREIGN_CURRENCY],
    },
  );
}
