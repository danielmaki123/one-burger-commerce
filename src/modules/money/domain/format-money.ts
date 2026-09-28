import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`) — **el único formato de dinero**.
 *
 * La auditoría de la fundación midió el formato «otra moneda con su código» escrito **siete veces** y los
 * decimales fijos en 2 (`shared/lib/format-currency.ts`). Acá la moneda es un dato del catálogo: su
 * símbolo, su código y **sus** decimales. Las siete copias colapsan en esta función.
 */
export type MoneyFormat = {
  /** Símbolo que se antepone al monto, por ejemplo `C$`. */
  symbol: string;
  /** Locale de `Intl.NumberFormat` para separadores y decimales. */
  locale: string;
  /** Decimales de la moneda. Sin dato, 2 (el comportamiento histórico). */
  decimals?: number;
  /** Código de la moneda. **Sin** él no se imprime: el símbolo solo no distingue `$` de `$`. */
  code?: string;
};

/**
 * El formato por defecto del negocio: símbolo, locale y decimales, **sin** código.
 *
 * Es el que usa una pantalla que muestra una sola moneda (el precio de la carta, el total de un pedido):
 * ahí el código sería ruido. El código entra cuando hay **más de una** moneda en pantalla y el símbolo solo
 * no alcanza.
 */
export const DEFAULT_MONEY_FORMAT: MoneyFormat = {
  symbol: DEFAULT_BUSINESS_SETTINGS.currencySymbol,
  locale: DEFAULT_BUSINESS_SETTINGS.locale,
  decimals: 2,
};

const FORMATTERS = new Map<string, Intl.NumberFormat>();

function formatterFor(locale: string, decimals: number): Intl.NumberFormat {
  const cacheKey = `${locale}|${decimals}`;
  const cached = FORMATTERS.get(cacheKey);
  if (cached) return cached;

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  FORMATTERS.set(cacheKey, formatter);
  return formatter;
}

/**
 * Formatea un monto con la moneda que se le pasa.
 *
 * El total siempre se calcula en el servidor: esto es sólo presentación. Un valor no finito se muestra
 * como cero en vez de `NaN` (un `NaN` en pantalla es peor que un cero visible).
 */
export function formatMoney(amount: number, format: MoneyFormat = DEFAULT_MONEY_FORMAT): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const decimals = Math.min(Math.max(Math.trunc(format.decimals ?? 2), 0), 4);
  const value = `${format.symbol}${formatterFor(format.locale, decimals).format(safeAmount)}`;

  return format.code ? `${value} ${currencyKey(format.code)}` : value;
}
