import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-72`) — **la tasa es un hecho con fecha**, no un valor
 * mutable.
 *
 * Hoy la tasa es un `Float?` en la fila única de `BusinessSettings`: se pisa, no tiene fecha y no dice
 * contra qué moneda base se registró. La consecuencia medida (`A-72`) es que el reintento de una venta
 * re-suma los cobros guardados con la tasa **vigente** en vez de con la del cobro.
 *
 * Acá cada tasa es una fila con `effectiveFrom` y `effectiveTo` (el intervalo es **semiabierto**: el
 * `effectiveFrom` pertenece al período nuevo y el `effectiveTo` al siguiente, así dos períodos no se
 * solapan en el instante del cambio). Registrar una tasa nueva **cierra** la anterior; no la pisa.
 */

export type ExchangeRateRecord = {
  id: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: number;
  /** ISO del momento desde el que rige esta tasa (inclusive). */
  effectiveFrom: string;
  /** ISO del momento en que dejó de regir (exclusive). `null` = vigente. */
  effectiveTo: string | null;
};

export type ExchangeRatePeriodDraft = {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rate: number;
  effectiveFrom: string;
};

function matchesPair(record: ExchangeRateRecord, from: string, to: string): boolean {
  return (
    currencyKey(record.fromCurrencyCode) === currencyKey(from) &&
    currencyKey(record.toCurrencyCode) === currencyKey(to)
  );
}

function milliseconds(value: string): number {
  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/**
 * La tasa que **estaba vigente** en el momento de un hecho.
 *
 * `null` significa «no se puede demostrar con este historial»: ni la más vieja del pasado se usa como
 * comodín, porque afirmar que un cobro de antes del primer período usó la primera tasa es inventar el
 * hecho (ley 7, `D-020`).
 */
export function resolveRateAt(
  history: readonly ExchangeRateRecord[],
  input: { from: string; to: string; at: string },
): number | null {
  const at = milliseconds(input.at);

  if (Number.isNaN(at)) return null;

  for (const record of history) {
    if (!matchesPair(record, input.from, input.to)) continue;

    const from = milliseconds(record.effectiveFrom);
    if (Number.isNaN(from) || at < from) continue;

    if (record.effectiveTo !== null) {
      const to = milliseconds(record.effectiveTo);
      if (!Number.isNaN(to) && at >= to) continue;
    }

    return record.rate;
  }

  return null;
}

/** La tasa **vigente hoy** de un par: la que no tiene `effectiveTo`. */
export function findActiveRate(
  history: readonly ExchangeRateRecord[],
  input: { from: string; to: string },
): ExchangeRateRecord | null {
  return history.find((record) => matchesPair(record, input.from, input.to) && record.effectiveTo === null) ?? null;
}

/**
 * El cierre del período anterior cuando se registra una tasa nueva: lo que hay que escribir, no una copia
 * de la fila entera.
 */
export function closePeriod(
  previous: ExchangeRateRecord,
  effectiveFrom: string,
): { id: string; effectiveTo: string } {
  return { id: previous.id, effectiveTo: effectiveFrom };
}

/** Una tasa tiene que ser un número positivo y finito: cero o negativo no es un dato, es un error de tipeo. */
export function assertRateValue(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("La tasa tiene que ser mayor que cero.");
  }

  return rate;
}

/** El mapa `moneda → tasa` que consume la conversión, armado con las tasas vigentes. */
export function ratesFromActive(
  history: readonly ExchangeRateRecord[],
  toCurrencyCode: string,
): Record<string, number> {
  const rates: Record<string, number> = {};
  const base = currencyKey(toCurrencyCode);

  for (const record of history) {
    if (record.effectiveTo !== null) continue;
    if (currencyKey(record.toCurrencyCode) !== base) continue;

    rates[currencyKey(record.fromCurrencyCode)] = record.rate;
  }

  return rates;
}
