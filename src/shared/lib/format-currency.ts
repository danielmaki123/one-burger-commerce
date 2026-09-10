import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";

export type CurrencyFormat = {
  /** Símbolo que se antepone al monto, por ejemplo `C$`. */
  symbol: string;
  /** Locale de `Intl.NumberFormat` para separadores y decimales. */
  locale: string;
};

/**
 * Formato por defecto: sale del módulo de defaults, que es la única fuente de
 * verdad del branding. No hay un `"C$"` literal acá.
 */
export const DEFAULT_CURRENCY_FORMAT: CurrencyFormat = {
  symbol: DEFAULT_BUSINESS_SETTINGS.currencySymbol,
  locale: DEFAULT_BUSINESS_SETTINGS.locale,
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string): Intl.NumberFormat {
  const cached = FORMATTERS.get(locale);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  FORMATTERS.set(locale, formatter);
  return formatter;
}

/**
 * Formatea un monto con la moneda configurada.
 *
 * El total siempre se calcula en el servidor: esto es solo presentación.
 */
export function formatCurrency(
  amount: number,
  format: CurrencyFormat = DEFAULT_CURRENCY_FORMAT,
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return `${format.symbol}${formatterFor(format.locale).format(safeAmount)}`;
}
