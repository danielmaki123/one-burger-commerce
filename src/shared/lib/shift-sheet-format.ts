import { formatCurrency, type CurrencyFormat } from "@/shared/lib/format-currency";
import { formatShiftDateTime } from "@/shared/lib/shift-datetime";

/**
 * Tarea 7 del brief (2026-09-17) — el formato que comparten los **papeles de la caja**.
 *
 * La hoja de cierre (Bloque 13.3) y el corte X (1.12) dicen los mismos números con las mismas reglas:
 * la moneda del negocio con su símbolo, otra moneda con **su** código (ponerle el símbolo local a dólares
 * es un número falso en un papel que se firma), la diferencia con signo y la fecha en la zona del local.
 * Estaba escrito dentro de la hoja de cierre; vive acá para que el corte y el cierre **no** puedan decir
 * cosas distintas del mismo turno.
 *
 * Son funciones puras: datos adentro, texto afuera, sin navegador ni base.
 */

export type ShiftSheetOptions = {
  businessName: string;
  timezone: string;
  locale: string;
  currencyCode: string;
  currencySymbol: string;
};

/** La línea para firmar. Un papel de caja sin firma es un papel que después no explica nada. */
export const SHIFT_SIGNATURE_LINE = "Firma: ______________________________";

export function sheetCurrencyFormat(
  currencyCode: string,
  options: SheetMoneyOptions,
): CurrencyFormat {
  return { symbol: options.currencySymbol, locale: options.locale };
}

/**
 * Lo mínimo para escribir un monto en un papel: la moneda del negocio (su código y su símbolo) y el
 * locale. La hoja de cierre pasa sus opciones completas; la **factura simple** (2026-09-18) solo necesita
 * esto, y así el formato de plata de los dos papeles sigue siendo el mismo.
 */
export type SheetMoneyOptions = Pick<
  ShiftSheetOptions,
  "currencyCode" | "currencySymbol" | "locale"
>;

/** Un monto en su moneda: la del negocio con símbolo (`C$305.00`), otra con su código (`USD 20.00`). */
export function formatSheetAmount(
  amount: number,
  currency: string,
  options: SheetMoneyOptions,
): string {
  if (currency.toUpperCase() === options.currencyCode.toUpperCase()) {
    return formatCurrency(amount, sheetCurrencyFormat(currency, options));
  }

  return formatCurrency(amount, { symbol: `${currency.toUpperCase()} `, locale: options.locale });
}

/** `-C$100.00` / `+C$50.00` / `sin diferencia`, con el símbolo de su moneda. */
export function formatSheetDelta(
  amount: number,
  currency: string,
  options: ShiftSheetOptions,
): string {
  if (amount === 0) return "sin diferencia";

  return `${amount > 0 ? "+" : "-"}${formatSheetAmount(Math.abs(amount), currency, options)}`;
}

/** El neto de los movimientos: cero se dice con palabras (no es una diferencia de plata que falte). */
export function formatSheetMovement(amount: number, options: ShiftSheetOptions): string {
  if (amount === 0) return "sin movimientos";

  return formatSheetDelta(amount, options.currencyCode, options);
}

/** Un total que puede no existir todavía: `null` = no se contó, y eso se dice. */
export function formatSheetTotal(amount: number | null, options: ShiftSheetOptions): string {
  return amount === null ? "Sin contar" : formatSheetAmount(amount, options.currencyCode, options);
}

/** La hora del papel es la del **local**, no la del servidor ni la del navegador. */
export function formatSheetMoment(iso: string | null, options: ShiftSheetOptions): string {
  return formatShiftDateTime(iso, { timezone: options.timezone, locale: options.locale });
}
