import { convertToBusinessCurrency } from "@/shared/lib/money-conversion";
import { roundCurrency } from "@/shared/lib/order-totals";
import {
  BASE_CASH_CURRENCY,
  DEFAULT_CASH_DENOMINATIONS,
} from "@/modules/cash-config/domain/cash-config-defaults";

import { ShiftError } from "./shift-errors";

/**
 * TASK-305 — el conteo de la caja, por denominación y por moneda.
 *
 * El owner lo pidió explícito: el arqueo no es un número, es un conteo (diez de C$100, cuatro de
 * US$20). De ahí salen tres cosas que el arqueo de TASK-104 no podía hacer:
 *
 * 1. **Contar por moneda**: la caja puede tener córdobas y dólares a la vez.
 * 2. **Saber qué se contó**: se guardan las denominaciones, no solo el total.
 * 3. **Esperar solo el efectivo**: una tarjeta no entra al cajón. Antes el esperado sumaba *todos*
 *    los cobros (una venta con tarjeta hacía que la caja "sobrara" por ese monto) y sumaba los
 *    dólares como si fueran córdobas (`US$3` contaba 3).
 */

/**
 * Denominaciones que el local cuenta hoy. Es la lista del mostrador, no una regla universal: si el
 * negocio empieza a contar otra moneda, se agrega acá y el conteo la acepta.
 *
 * Fase 2 del rediseño de Caja (2026-09-22) — la lista **ya no vive acá**: la fuente es
 * `cash-config-defaults.ts` (el módulo de configuración, que es el que la siembra por migración y el que
 * la pantalla edita). Este alias se mantiene para los consumidores que usan los defaults como respaldo
 * —la grilla del conteo—, y desaparece cuando la grilla reciba siempre la config del local.
 *
 * @deprecated Usá `toCashCountConfig` (módulo `cash-config`) para contar con la config del local.
 */
export const CASH_DENOMINATIONS: Record<string, number[]> = DEFAULT_CASH_DENOMINATIONS;

export type ShiftCashCountKind = "opening" | "closing";

export type ShiftCashCountInput = {
  currency: string;
  denomination: number;
  quantity: number;
};

/** La config del conteo de un local: qué monedas maneja y con qué billetes. */
export type ShiftCashCountConfig = {
  currencies: string[];
  denominations: Record<string, number[]>;
};

/**
 * Valida el conteo completo y devuelve los errores por fila, para poder señalarlos en el formulario.
 *
 * Fase 2 del rediseño de Caja (2026-09-22) — con `config` valida contra **la config del local**: la moneda
 * apagada se rechaza (un local sin dólares no puede abrir la caja con dólares, aunque el payload venga
 * armado a mano) y solo pasan los billetes que la config ofrece. Sin `config` cae a los defaults del
 * módulo, que es el caso de una base recién creada.
 */
export function validateShiftCashCounts(
  counts: ShiftCashCountInput[],
  config?: ShiftCashCountConfig,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const seen = new Set<string>();
  const enabledCurrencies = config
    ? new Set(config.currencies.map((currency) => currency.trim().toUpperCase()))
    : null;

  counts.forEach((count, index) => {
    const currency = count.currency.trim().toUpperCase();
    const allowed = denominationsFor(currency, config);

    if (enabledCurrencies && !enabledCurrencies.has(currency)) {
      fields[`counts.${index}.currency`] = `Este local no cuenta en ${currency || "esa moneda"}.`;
      return;
    }

    if (!allowed) {
      fields[`counts.${index}.currency`] = `Todavía no se cuenta en ${currency || "esa moneda"}.`;
      return;
    }

    if (!allowed.includes(count.denomination)) {
      fields[`counts.${index}.denomination`] = "Ese billete no existe en esa moneda.";
      return;
    }

    if (!Number.isInteger(count.quantity) || count.quantity < 0) {
      fields[`counts.${index}.quantity`] = "La cantidad es un número entero de 0 o más.";
      return;
    }

    const key = `${currency}-${count.denomination}`;
    if (seen.has(key)) {
      fields[`counts.${index}.denomination`] = "Ese billete ya está contado en otra fila.";
      return;
    }
    seen.add(key);
  });

  return fields;
}

/**
 * Los billetes de una moneda: los de la config del local si los tiene, y los defaults del módulo si no.
 *
 * `null` = la moneda no se cuenta en este negocio (ni en la config ni en los defaults).
 */
function denominationsFor(
  currency: string,
  config?: ShiftCashCountConfig,
): number[] | undefined {
  const target = currency.trim().toUpperCase();
  const configured = config?.denominations[target];

  if (configured) return configured;
  if (config) {
    // Con config, una moneda sin filas propias solo existe si es la del negocio o el dólar conocido.
    return target === BASE_CASH_CURRENCY || target === "USD"
      ? DEFAULT_CASH_DENOMINATIONS[target]
      : undefined;
  }

  return DEFAULT_CASH_DENOMINATIONS[target];
}

/** Total contado de una moneda, sin convertir. */
export function cashCountsTotal(counts: ShiftCashCountInput[], currency: string): number {
  const target = currency.trim().toUpperCase();

  return roundCurrency(
    counts
      .filter((count) => count.currency.trim().toUpperCase() === target)
      .reduce((sum, count) => sum + count.denomination * count.quantity, 0),
  );
}

/** Monedas presentes en el conteo, ordenadas para que la pantalla y los tests sean estables. */
export function countedCurrencies(counts: ShiftCashCountInput[]): string[] {
  return [...new Set(counts.map((count) => count.currency.trim().toUpperCase()))].sort();
}

/**
 * El conteo convertido a la moneda del negocio. Sin tasa cargada, un conteo en dólares **se rechaza**:
 * un arqueo con un número inventado es peor que un arqueo que no se puede cerrar.
 */
export function cashCountsTotalInBusinessCurrency(input: {
  counts: ShiftCashCountInput[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  return roundCurrency(
    input.counts.reduce((sum, count) => {
      const converted = convertToBusinessCurrency({
        amount: count.denomination * count.quantity,
        currency: count.currency,
        businessCurrencyCode: input.businessCurrencyCode,
        usdExchangeRate: input.usdExchangeRate,
      });

      if (!converted.ok) {
        throw new ShiftError(
          422,
          "VALIDATION_ERROR",
          converted.reason === "missing-rate"
            ? "Cargá el tipo de cambio del dólar en Configuración para cerrar una caja con dólares."
            : `Todavía no se cuenta en ${converted.currency}.`,
          {
            counts:
              converted.reason === "missing-rate"
                ? "Cargá el tipo de cambio del dólar en Configuración."
                : `Todavía no se cuenta en ${converted.currency}.`,
          },
        );
      }

      return sum + converted.amount;
    }, 0),
  );
}

/**
 * Lo que tiene que haber en el cajón, por moneda: el fondo con el que se abrió más **el efectivo**
 * que entró entre la apertura y el cierre —monto y propina, que también entra al cajón—, menos el
 * vuelto que salió.
 *
 * La tarjeta no entra (no está en el cajón) y el vuelto se descuenta porque **salió**: sin eso, un
 * día con vueltos parecería que falta plata todos los días.
 */
export function expectedCashByCurrency(input: {
  openingCounts: ShiftCashCountInput[];
  /**
   * El fondo cuando **no** hay conteo de apertura: es un monto en la moneda del negocio. Sin esto el
   * detalle por moneda no cerraba con el total (el fondo quedaba fuera del desglose).
   */
  openingAmount?: number;
  cashPayments: { currency: string | null; amount: number; tip: number; changeAmount: number }[];
  /** Bloque 2 — retiros e ingresos del turno. Sin esto, un retiro parecía un faltante. */
  cashMovements?: { kind: "withdrawal" | "deposit"; currency: string; amount: number }[];
  businessCurrencyCode: string;
}): Record<string, number> {
  const expected: Record<string, number> = {};

  for (const count of input.openingCounts) {
    const currency = count.currency.trim().toUpperCase();
    expected[currency] = roundCurrency(
      (expected[currency] ?? 0) + count.denomination * count.quantity,
    );
  }

  const businessCurrency = input.businessCurrencyCode.trim().toUpperCase();

  if (input.openingCounts.length === 0 && input.openingAmount) {
    expected[businessCurrency] = roundCurrency(
      (expected[businessCurrency] ?? 0) + input.openingAmount,
    );
  }

  for (const payment of input.cashPayments) {
    const currency = (payment.currency ?? businessCurrency).trim().toUpperCase();
    const net = payment.amount + payment.tip - payment.changeAmount;
    expected[currency] = roundCurrency((expected[currency] ?? 0) + net);
  }

  for (const movement of input.cashMovements ?? []) {
    const currency = movement.currency.trim().toUpperCase();
    const signed = movement.kind === "withdrawal" ? -movement.amount : movement.amount;
    expected[currency] = roundCurrency((expected[currency] ?? 0) + signed);
  }

  return expected;
}

/**
 * Bloque 2 del roadmap del POS (Fase 2) — cuánto mueven los movimientos del turno, **en la moneda
 * del negocio**.
 *
 * Es el número que se congela en el arqueo junto al efectivo del turno: dice cuánto de la diferencia
 * la explican los retiros y los ingresos, en vez de quedar como un faltante sin causa.
 */
export function cashMovementsTotalInBusinessCurrency(input: {
  movements: { kind: "withdrawal" | "deposit"; currency: string; amount: number }[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  const byCurrency = cashMovementsTotalByCurrency(input);

  return roundCurrency(
    Object.entries(byCurrency).reduce((sum, [currency, amount]) => {
      const converted = convertToBusinessCurrency({
        amount,
        currency,
        businessCurrencyCode: input.businessCurrencyCode,
        usdExchangeRate: input.usdExchangeRate,
      });

      if (!converted.ok) {
        throw new ShiftError(
          422,
          "VALIDATION_ERROR",
          converted.reason === "missing-rate"
            ? "Cargá el tipo de cambio del dólar en Configuración para cerrar una caja con movimientos en dólares."
            : `Todavía no se cuenta en ${converted.currency}.`,
          {
            counts:
              converted.reason === "missing-rate"
                ? "Cargá el tipo de cambio del dólar en Configuración."
                : `Todavía no se cuenta en ${converted.currency}.`,
          },
        );
      }

      return sum + converted.amount;
    }, 0),
  );
}

/**
 * Bloque 2 del roadmap del POS (Fase 2) — cuánto mueven los movimientos del turno, **por moneda**.
 *
 * Un **retiro resta** del esperado y un **ingreso suma**: son plata que salió o entró del cajón sin
 * ser un cobro. El resultado va en la moneda de cada movimiento (un retiro de US$20 no puede restar 20
 * córdobas) y solo aparecen las monedas que tuvieron movimiento.
 */
export function cashMovementsTotalByCurrency(input: {
  movements: { kind: "withdrawal" | "deposit"; currency: string; amount: number }[];
}): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const movement of input.movements) {
    const currency = movement.currency.trim().toUpperCase();
    const signed = movement.kind === "withdrawal" ? -movement.amount : movement.amount;
    totals[currency] = roundCurrency((totals[currency] ?? 0) + signed);
  }

  return totals;
}

/**
 * Bloque 1.2 del roadmap del POS (Fase 2) — lo que entró **en efectivo** en el turno, en la moneda
 * del negocio.
 *
 * Es el otro número del arqueo: el esperado dice cuánto tiene que haber, esto dice cuánto entró. Se
 * calcula con la misma regla que el esperado (monto + propina − vuelto) para que no puedan discrepar,
 * y se congela al cerrar: recomputarlo después usaría una tasa de cambio distinta.
 */
export function cashPaymentsTotalInBusinessCurrency(input: {
  cashPayments: { currency: string | null; amount: number; tip: number; changeAmount: number }[];
  businessCurrencyCode: string;
  usdExchangeRate: number | null;
}): number {
  return roundCurrency(
    input.cashPayments.reduce((sum, payment) => {
      const converted = convertToBusinessCurrency({
        amount: payment.amount + payment.tip - payment.changeAmount,
        currency: payment.currency ?? input.businessCurrencyCode,
        businessCurrencyCode: input.businessCurrencyCode,
        usdExchangeRate: input.usdExchangeRate,
      });

      if (!converted.ok) {
        throw new ShiftError(
          422,
          "VALIDATION_ERROR",
          converted.reason === "missing-rate"
            ? "Cargá el tipo de cambio del dólar en Configuración para cerrar una caja con dólares."
            : `Todavía no se cuenta en ${converted.currency}.`,
          {
            counts:
              converted.reason === "missing-rate"
                ? "Cargá el tipo de cambio del dólar en Configuración."
                : `Todavía no se cuenta en ${converted.currency}.`,
          },
        );
      }

      return sum + converted.amount;
    }, 0),
  );
}
