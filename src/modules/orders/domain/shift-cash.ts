import { convertToBusinessCurrency } from "@/shared/lib/money-conversion";
import { roundCurrency } from "@/shared/lib/order-totals";

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
 */
export const CASH_DENOMINATIONS: Record<string, number[]> = {
  NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  USD: [100, 50, 20, 10, 5, 2, 1],
};

export type ShiftCashCountKind = "opening" | "closing";

export type ShiftCashCountInput = {
  currency: string;
  denomination: number;
  quantity: number;
};

function denominationsFor(currency: string): number[] | null {
  return CASH_DENOMINATIONS[currency.trim().toUpperCase()] ?? null;
}

/** Valida el conteo completo y devuelve los errores por fila, para poder señalarlos en el formulario. */
export function validateShiftCashCounts(counts: ShiftCashCountInput[]): Record<string, string> {
  const fields: Record<string, string> = {};
  const seen = new Set<string>();

  counts.forEach((count, index) => {
    const currency = count.currency.trim().toUpperCase();
    const allowed = denominationsFor(currency);

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
  cashPayments: { currency: string | null; amount: number; tip: number; changeAmount: number }[];
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

  for (const payment of input.cashPayments) {
    const currency = (payment.currency ?? businessCurrency).trim().toUpperCase();
    const net = payment.amount + payment.tip - payment.changeAmount;
    expected[currency] = roundCurrency((expected[currency] ?? 0) + net);
  }

  return expected;
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
