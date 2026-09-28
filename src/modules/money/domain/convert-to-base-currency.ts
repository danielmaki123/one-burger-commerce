import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-68`, `A-69`, `D-016`) — **la única conversión de dinero**.
 *
 * La aritmética es la que ya existía en `shared/lib/money-conversion.ts` (`TASK-305`): `monto × tasa`,
 * redondeado al centavo. Lo que cambió es el **dueño** y el **dato**:
 *
 * - el literal `SUPPORTED_FOREIGN_CURRENCY = "USD"` murió (`D-019`, el negocio opera internacionalmente):
 *   ahora la tasa llega como un mapa **por moneda**, resuelto por `money` con la vigencia que
 *   corresponde al momento del hecho (`D-018`, `A-72`);
 * - `knownCurrencyCodes` permite distinguir «no conozco esa moneda» (`unsupported-currency`, se arregla
 *   agregándola al catálogo) de «la conozco y no tiene tasa vigente» (`missing-rate`, se arregla
 *   registrando la tasa). Un solo motivo para las dos cosas deja al dueño sin saber qué hacer.
 *
 * El dominio no conoce Prisma, Next ni HTTP: recibe el dato ya resuelto.
 */

export type ConversionFailure =
  | { ok: false; reason: "missing-rate"; currency: string }
  | { ok: false; reason: "unsupported-currency"; currency: string };

export type ConversionResult = { ok: true; amount: number } | ConversionFailure;

export type ConversionContext = {
  /** La moneda del negocio **en este momento de la historia** (o el snapshot del hecho). */
  baseCurrencyCode: string;
  /** Tasa por moneda: cuántas unidades de la base vale **una** unidad de la moneda. */
  rates: Record<string, number | null | undefined>;
  /** Si viene, una moneda fuera de esta lista es `unsupported-currency` y no `missing-rate`. */
  knownCurrencyCodes?: readonly string[];
};

/** La forma canónica con la que se compara una moneda en todo el sistema. */
export function currencyKey(code: string): string {
  return code.trim().toUpperCase();
}

/** Dos códigos nombran la misma moneda. Una sola forma de preguntarlo (`A-69`). */
export function isSameCurrency(a: string, b: string): boolean {
  return currencyKey(a) === currencyKey(b);
}

export function isCurrencyKnown(code: string, knownCurrencyCodes: readonly string[]): boolean {
  const key = currencyKey(code);

  return knownCurrencyCodes.some((known) => currencyKey(known) === key);
}

/**
 * Convierte un monto a la moneda base y **devuelve el motivo** cuando no puede.
 *
 * No adivina: sin tasa no hay equivalente. Inventar uno con la tasa vigente es exactamente lo que `D-020`
 * prohíbe para el pasado.
 */
export function convertToBaseCurrency(
  input: { amount: number; currency: string },
  context: ConversionContext,
): ConversionResult {
  const currency = currencyKey(input.currency);
  const baseCurrency = currencyKey(context.baseCurrencyCode);

  if (currency === baseCurrency) {
    return { ok: true, amount: roundCurrency(input.amount) };
  }

  if (context.knownCurrencyCodes && !isCurrencyKnown(currency, context.knownCurrencyCodes)) {
    return { ok: false, reason: "unsupported-currency", currency };
  }

  const rate = context.rates[currency];
  if (rate === null || rate === undefined || !Number.isFinite(rate) || rate <= 0) {
    return { ok: false, reason: "missing-rate", currency };
  }

  return { ok: true, amount: roundCurrency(input.amount * rate) };
}

/**
 * La forma corta para una superficie que ya resolvió que la tasa existe: convierte o devuelve `null`.
 *
 * Existe para que nadie escriba su propio `monto * tasa`: si el resultado es `null`, la superficie decide
 * cómo contarlo —el POS lo traduce a su error de cobro y el arqueo al suyo— pero **la aritmética es una**.
 */
export function convertAmountToBase(input: {
  amount: number;
  currency: string;
  baseCurrencyCode: string;
  rates: Record<string, number | null | undefined>;
  knownCurrencyCodes?: readonly string[];
}): number | null {
  const result = convertToBaseCurrency(
    { amount: input.amount, currency: input.currency },
    {
      baseCurrencyCode: input.baseCurrencyCode,
      rates: input.rates,
      ...(input.knownCurrencyCodes ? { knownCurrencyCodes: input.knownCurrencyCodes } : {}),
    },
  );

  return result.ok ? result.amount : null;
}
