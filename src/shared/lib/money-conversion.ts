import {
  convertToBusinessCurrency,
  SUPPORTED_FOREIGN_CURRENCY as MONEY_SUPPORTED_FOREIGN_CURRENCY,
} from "@/modules/money/domain/convert-to-business-currency";
import type {
  ConversionFailure,
  ConversionResult,
} from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-305` → `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **el camino viejo, hacia el dueño nuevo**.
 *
 * La regla monetaria vivía acá y estaba escrita **cinco veces** en el repo (`A-69`). Ahora la aritmética
 * está una sola vez, en `@/modules/money/domain/convert-to-base-currency`, y este archivo queda como
 * **cáscara delgada** para los call sites que todavía no migraron (el POS y el arqueo pasan una única
 * tasa, la del dólar, leída de la configuración vieja): reexporta las formas de siempre y delega en
 * `money`.
 *
 * Lo que **no** puede volver acá: la multiplicación. Si alguien la reimplementa, el mismo cobro se
 * convierte distinto según quién lo mire.
 */
export { convertToBusinessCurrency };

/**
 * La única moneda extranjera que el negocio tomaba cuando se escribió esta regla.
 *
 * @deprecated `D-019`: el catálogo de monedas es un dato del negocio y no una lista cerrada. Sobrevive
 * **sólo** para los call sites viejos que siguen pasando la tasa del dólar; el código nuevo usa
 * `convertToBaseCurrency` con la tasa de la moneda que corresponda.
 */
export const SUPPORTED_FOREIGN_CURRENCY = MONEY_SUPPORTED_FOREIGN_CURRENCY;

export type { ConversionFailure, ConversionResult };
