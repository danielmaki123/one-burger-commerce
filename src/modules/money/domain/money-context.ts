import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — **el contexto monetario de una operación**.
 *
 * Es lo que un consumidor (el POS, el cobro de un pedido, una devolución, un cierre) recibe **una sola vez**
 * y con lo que congela su snapshot. Existe para que ningún consumidor vuelva a leer la configuración por su
 * cuenta: la autoridad es `money`, y el que escribe plata recibe el dato ya resuelto.
 *
 * Los dos campos que lo hacen útil:
 *
 * - `baseCurrencyCode` es la moneda base **del momento de la operación**, no una constante: es la que se
 *   congela en el hecho (`D-020`) y la que explica el pasado cuando la base cambie (`D-018`/`D-022`);
 * - `rates` es la tasa **vigente por moneda** —cuántas unidades de la base vale **una** unidad de la
 *   moneda—, con las monedas que no tienen tasa vigente afuera del mapa. Un consumidor que no encuentra su
 *   moneda **no convierte**: rechaza la operación con `missing-rate` en vez de inventar un equivalente.
 */
export type MoneyContext = {
  baseCurrencyCode: string;
  /** Cómo se muestra la plata. Es presentación: cambiarlo no altera ningún monto guardado. */
  locale: string;
  rates: Record<string, number | null | undefined>;
  /** El catálogo activo. Sirve para distinguir «no conozco esa moneda» de «no tiene tasa hoy». */
  knownCurrencyCodes?: readonly string[];
};

/**
 * El contexto del caso más simple: no hay otra moneda que la base.
 *
 * Es lo que usan los tests y las composiciones que todavía no leen `money`, y **no** es un atajo para
 * producción: un negocio con monedas aceptadas tiene que leer su configuración real (`A-83`).
 */
export function baseOnlyMoneyContext(baseCurrencyCode: string, locale = "es-NI"): MoneyContext {
  return { baseCurrencyCode: currencyKey(baseCurrencyCode), locale, rates: {} };
}

/**
 * La tasa que se le aplicó a una moneda, o `null` si esa moneda no se puede convertir.
 *
 * Devuelve `null` **también** cuando la moneda **es** la base: la tasa de un cobro en la moneda base no
 * existe (no hay conversión que explicar) y el snapshot no tiene que inventar un `1`. El llamador decide
 * qué hacer con ese caso, que es el más común de todos.
 */
export function rateForCurrency(currency: string, context: MoneyContext): number | null {
  const key = currencyKey(currency);
  const base = currencyKey(context.baseCurrencyCode);

  if (key === base) return null;

  const rate = context.rates[key];

  return rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0 ? null : rate;
}
