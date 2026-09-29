import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { rateForCurrency, type MoneyContext } from "@/modules/money/domain/money-context";
import { roundCurrency } from "@/modules/money/domain/round-currency";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-017`, `D-020`, `A-71`) — **el contrato del cobro nuevo**.
 *
 * Dos reglas viven acá, y son las dos que no se pueden relajar sin romper el dinero:
 *
 * 1. **El snapshot es obligatorio** (`D-020`). Un `Payment` nuevo congela monto original, moneda, moneda
 *    base, tasa aplicada y equivalente en moneda base. Sin esos cinco el cobro **no se firma**, porque sin
 *    ellos el hecho no se puede explicar después sin volver a la configuración de hoy (ley 7).
 *
 *    Es una regla de **dominio y de transacción**, no un `NOT NULL` de la columna: las columnas nacen
 *    nullable justamente para que los cobros **legacy** sigan leyéndose.
 *
 * 2. **La clave de idempotencia la manda el cliente** (`A-71`). La unicidad la garantiza la base (índice
 *    único parcial); acá se valida la forma. Su alcance es el **cobro**, no el pedido: dos cobros parciales
 *    legítimos conviven con claves distintas y el mismo request repetido produce uno solo.
 */

export const PAYMENT_METHOD_KINDS = ["cash", "card", "bank_transfer", "wallet", "other"] as const;

export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

export function isPaymentMethodKind(value: unknown): value is PaymentMethodKind {
  return typeof value === "string" && (PAYMENT_METHOD_KINDS as readonly string[]).includes(value);
}

/** Los cinco campos de `D-020`, en el orden en que se leen. */
export const PAYMENT_SNAPSHOT_FIELDS = [
  "amount",
  "currency",
  "baseCurrencyCode",
  "exchangeRate",
  "baseAmount",
] as const;

export const MAX_IDEMPOTENCY_KEY_LENGTH = 80;

export type PaymentSnapshotInput = {
  amount: number;
  currency: string;
  baseCurrencyCode: string;
  exchangeRate: number;
  methodKind: PaymentMethodKind;
};

export type PaymentSnapshot = {
  /** Monto original, en la moneda en la que entró. */
  amount: number;
  currency: string;
  baseCurrencyCode: string;
  exchangeRate: number;
  baseAmount: number;
  methodKind: PaymentMethodKind;
};

/** El error de un cobro que no se puede firmar. La ruta lo mapea a 422 con el campo que lo causó. */
export class PaymentSnapshotError extends Error {
  constructor(
    readonly field: keyof PaymentSnapshotInput | "idempotencyKey",
    message: string,
  ) {
    super(message);
    this.name = "PaymentSnapshotError";
  }
}

function assertAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PaymentSnapshotError("amount", "El monto tiene que ser mayor que cero.");
  }

  return roundCurrency(amount);
}

function assertNonEmpty(value: string, field: "currency" | "baseCurrencyCode", label: string): string {
  const normalized = currencyKey(value ?? "");

  if (normalized.length === 0) {
    throw new PaymentSnapshotError(field, `Falta la ${label} del cobro.`);
  }

  return normalized;
}

function assertRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new PaymentSnapshotError(
      "exchangeRate",
      "Falta la tasa aplicada: sin ella el equivalente no se puede explicar después.",
    );
  }

  return rate;
}

/**
 * Construye el snapshot de un cobro **nuevo** o falla explicando qué falta.
 *
 * El equivalente base **se calcula acá, una sola vez**, con el redondeo de `money`. No se recalcula después
 * ni se re-deriva con la tasa vigente: es un hecho.
 */
export function buildPaymentSnapshot(input: PaymentSnapshotInput): PaymentSnapshot {
  const amount = assertAmount(input.amount);
  const currency = assertNonEmpty(input.currency, "currency", "moneda");
  const baseCurrencyCode = assertNonEmpty(input.baseCurrencyCode, "baseCurrencyCode", "moneda base");
  const exchangeRate = assertRate(input.exchangeRate);

  if (!isPaymentMethodKind(input.methodKind)) {
    throw new PaymentSnapshotError(
      "methodKind",
      "El medio tiene que tener un tipo canónico (efectivo, tarjeta, transferencia, billetera u otro).",
    );
  }

  return {
    amount,
    currency,
    baseCurrencyCode,
    exchangeRate,
    baseAmount: roundCurrency(amount * exchangeRate),
    methodKind: input.methodKind,
  };
}

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-81`, `D-024`) — **el snapshot desde el contexto
 * monetario**.
 *
 * Es la forma que usan los caminos productivos, y existe para que ninguno de ellos tenga que resolver la
 * tasa por su cuenta: recibe el contexto de `money` y congela los cinco campos de `D-020`. El POS productivo
 * escribía los cobros sin pasar por acá (`A-81`), que es exactamente el hueco que esto cierra.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **Un cobro en la moneda base se congela con tasa `1`**, no con la tasa «faltante». La igualdad es un
 *    hecho del cobro y tiene que quedar escrita: si dentro de seis meses la base cambia, un `baseAmount`
 *    `null` obligaría a reconstruir el pasado con la configuración de ese día, que es lo que `D-020`/`D-022`
 *    prohíben. `rateForCurrency` devuelve `null` para la base justamente porque ahí no hay tasa que buscar.
 * 2. **Sin tasa vigente no se firma.** El error es de dominio —no hay equivalente que inventar— y cada
 *    superficie lo traduce a su error de negocio.
 */
export function buildPaymentSnapshotFor(
  input: {
    amount: number;
    currency: string;
    methodKind: PaymentMethodKind;
  },
  context: MoneyContext,
): PaymentSnapshot {
  const currency = currencyKey(input.currency);
  const baseCurrencyCode = currencyKey(context.baseCurrencyCode);

  if (currency === baseCurrencyCode) {
    return buildPaymentSnapshot({
      amount: input.amount,
      currency,
      baseCurrencyCode,
      exchangeRate: 1,
      methodKind: input.methodKind,
    });
  }

  const rate = rateForCurrency(currency, context);

  if (rate === null) {
    const known = context.knownCurrencyCodes
      ? context.knownCurrencyCodes.some((code) => currencyKey(code) === currency)
      : context.rates[currency] !== undefined;

    throw new PaymentSnapshotError(
      "exchangeRate",
      known
        ? `No hay una tasa vigente para ${currency}: registrala en Finanzas antes de cobrar en esa moneda.`
        : `No conocemos la moneda ${currency}: agregala al catálogo de Finanzas antes de cobrar en ella.`,
    );
  }

  return buildPaymentSnapshot({
    amount: input.amount,
    currency,
    baseCurrencyCode,
    exchangeRate: rate,
    methodKind: input.methodKind,
  });
}

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-82`, `D-020`, `D-024`) — **el snapshot de una
 * devolución**.
 *
 * Misma ley que el cobro y por la misma razón: una devolución es plata que **salió**, y sin la moneda base,
 * la tasa y el equivalente, el neto del negocio no se puede explicar después sin volver a la configuración
 * de ese día (`A-74` ya dependía de este equivalente para no restar dólares como córdobas).
 *
 * Se apoya en `buildPaymentSnapshotFor` a propósito: el cálculo del equivalente es **uno solo** para las dos
 * puntas de la misma operación de dinero. Una devolución en la moneda base congela la igualdad; una en otra
 * moneda, la tasa **vigente en el momento de la devolución** —que no tiene por qué ser la del cobro: el cobro
 * explica cuánto valía la plata cuando entró, la devolución cuánto vale la que sale—.
 */
export function buildRefundSnapshotFor(
  input: {
    amount: number;
    currency: string;
    /** El tipo canónico que hereda del cobro: la devolución sale por el mismo medio. */
    methodKind: PaymentMethodKind;
  },
  context: MoneyContext,
): PaymentSnapshot {
  return buildPaymentSnapshotFor(input, context);
}

/** Valida y normaliza la clave de idempotencia que mandó el cliente. */
export function assertIdempotencyKey(key: string | null | undefined): string {
  const normalized = (key ?? "").trim();

  if (normalized.length === 0) {
    throw new PaymentSnapshotError(
      "idempotencyKey",
      "Falta la clave de idempotencia del cobro: sin ella un reintento cobra dos veces.",
    );
  }

  if (normalized.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new PaymentSnapshotError(
      "idempotencyKey",
      `La clave de idempotencia no puede pasar de ${MAX_IDEMPOTENCY_KEY_LENGTH} caracteres.`,
    );
  }

  return normalized;
}
