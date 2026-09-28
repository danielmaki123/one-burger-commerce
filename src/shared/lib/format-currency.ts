import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { formatMoney, type MoneyFormat } from "@/modules/money/domain/format-money";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — el formato de la plata, con **el dueño nuevo**.
 *
 * El formato estaba escrito «a mano» acá y en otros seis lugares, siempre con dos decimales fijos
 * (`A-69`). Ahora el dueño es `money`: `decimals` y `code` son **opcionales** y, sin ellos, el
 * comportamiento es el histórico (símbolo + locale + dos decimales), así que todos los usos que ya
 * existían siguen mostrando exactamente el mismo texto.
 */
export type CurrencyFormat = MoneyFormat;

/**
 * Formato por defecto: sale del módulo de defaults, que es la única fuente de
 * verdad del branding. No hay un `"C$"` literal acá.
 */
export const DEFAULT_CURRENCY_FORMAT: CurrencyFormat = {
  symbol: DEFAULT_BUSINESS_SETTINGS.currencySymbol,
  locale: DEFAULT_BUSINESS_SETTINGS.locale,
};

/**
 * Formatea un monto con la moneda configurada.
 *
 * El total siempre se calcula en el servidor: esto es solo presentación.
 */
export function formatCurrency(
  amount: number,
  format: CurrencyFormat = DEFAULT_CURRENCY_FORMAT,
): string {
  return formatMoney(amount, format);
}
