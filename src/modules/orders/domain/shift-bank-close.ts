import { roundCurrency } from "@/shared/lib/order-totals";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco** del turno.
 *
 * Hasta acá el cuadre de tarjeta y transferencia (11.1 del roadmap) se hacía a mano: el sistema exportaba
 * un CSV con lo que había cobrado y el owner lo comparaba con el lote de la terminal y el extracto. Acá el
 * número del lote entra al sistema: por cada banco con el que liquida la sucursal se declara **cuánto
 * reportó** (con su lote y su terminal), y el cierre compara eso con lo que el sistema cobró.
 *
 * Tres decisiones que este archivo fija, y que son las que hacen que el número signifique algo:
 *
 * 1. **El efectivo no entra**: su cuadre es el arqueo del cajón (contado contra esperado). Acá se cuadra
 *    solo lo que **no** pasó por el cajón.
 * 2. **Qué se compara**: tarjeta y transferencia. `mixto` y `otro` entraron pero no tienen lote contra el
 *    cual cuadrar (decisión del owner en la Tarea 10: se informan aparte, no van al cuadre).
 * 3. **Cada moneda se cuenta en la suya**: un cobro en dólares convertido con la tasa de hoy sería un
 *    número que el lote nunca tuvo, así que el detalle va por moneda y la conversión queda solo para el
 *    total en la moneda del negocio.
 */

/** Una fila del cuadre: lo que un banco reportó para este turno. */
export type ShiftBankCloseInput = {
  bankId: string;
  /** Lo que dice el banco (o la terminal). */
  declaredAmount: number;
  currency: string;
  /** El lote del voucher de la terminal. */
  lote?: string | null;
  terminalLabel?: string | null;
  notes?: string | null;
};

/**
 * Lo que el local tiene cargado: los bancos de **esa** sucursal y las monedas con las que trabaja.
 *
 * Los dos juntos porque los dos acotan el cuadre: un banco que no liquida en el local no se puede
 * declarar aunque el payload venga armado a mano, y una moneda que el local no trabaja tampoco.
 */
export type ShiftBankCloseConfig = {
  currencies: string[];
  bankIds: string[];
};

const MAX_LOTE = 40;
const MAX_TERMINAL = 40;
const MAX_NOTES = 200;

/**
 * Valida las filas del cuadre y devuelve los errores **por fila**, para señalarlos en el formulario (la
 * misma forma que `validateShiftCashCounts`).
 */
export function validateShiftBankCloses(
  closes: readonly ShiftBankCloseInput[],
  config: ShiftBankCloseConfig,
): Record<string, string> {
  const fields: Record<string, string> = {};
  const currencies = new Set(config.currencies.map(normalize));
  const bankIds = new Set(config.bankIds);
  const seen = new Set<string>();

  closes.forEach((close, index) => {
    const bankId = (close.bankId ?? "").trim();

    if (!bankId) {
      fields[`bankCloses.${index}.bankId`] = "Elegí el banco.";
      return;
    }

    if (!bankIds.has(bankId)) {
      fields[`bankCloses.${index}.bankId`] = "Ese banco no liquida en este local.";
      return;
    }

    if (!Number.isFinite(close.declaredAmount) || close.declaredAmount < 0) {
      fields[`bankCloses.${index}.declaredAmount`] = "Tiene que ser 0 o más.";
      return;
    }

    const currency = normalize(close.currency);

    if (!/^[A-Z]{3}$/.test(currency)) {
      fields[`bankCloses.${index}.currency`] = "Elegí la moneda.";
      return;
    }

    if (!currencies.has(currency)) {
      fields[`bankCloses.${index}.currency`] = `Este local no liquida en ${currency}.`;
      return;
    }

    const texts: [keyof ShiftBankCloseInput, number][] = [
      ["lote", MAX_LOTE],
      ["terminalLabel", MAX_TERMINAL],
      ["notes", MAX_NOTES],
    ];

    for (const [field, max] of texts) {
      const value = close[field];
      if (typeof value === "string" && value.trim().length > max) {
        fields[`bankCloses.${index}.${field}`] = `Máximo ${max} caracteres.`;
      }
    }

    const key = `${bankId}-${currency}`;
    if (seen.has(key)) {
      fields[`bankCloses.${index}.bankId`] = "Ese banco ya está declarado en esa moneda.";
      return;
    }

    seen.add(key);
  });

  return fields;
}

/** Lo declarado por moneda, sin convertir: es lo que dice el lote de cada banco. */
export function bankClosesTotalByCurrency(
  closes: readonly ShiftBankCloseInput[],
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const close of closes) {
    const currency = normalize(close.currency);
    totals[currency] = roundCurrency((totals[currency] ?? 0) + close.declaredAmount);
  }

  return totals;
}

/**
 * Lo que el sistema cobró **fuera del cajón**, por moneda: tarjeta y transferencia.
 *
 * `mixto` y `otro` quedan afuera a propósito (no tienen lote contra el cual cuadrar) y el efectivo también:
 * su cuadre es el arqueo del cajón.
 */
export function nonCashTotalsByCurrency(input: {
  payments: readonly {
    method: string;
    currency: string | null;
    amount: number;
    tip: number;
    changeAmount: number;
  }[];
  businessCurrencyCode: string;
}): Record<string, number> {
  const totals: Record<string, number> = {};
  const fallback = normalize(input.businessCurrencyCode);

  for (const payment of input.payments) {
    if (payment.method !== "card" && payment.method !== "transfer") continue;

    const currency = payment.currency ? normalize(payment.currency) : fallback;
    const net = payment.amount + payment.tip - payment.changeAmount;
    totals[currency] = roundCurrency((totals[currency] ?? 0) + net);
  }

  return totals;
}

/** La diferencia por moneda: lo declarado menos lo cobrado. Positivo = el banco reporta de más. */
export function bankDifferenceByCurrency(input: {
  declared: Record<string, number>;
  charged: Record<string, number>;
}): Record<string, number> {
  const currencies = new Set([...Object.keys(input.declared), ...Object.keys(input.charged)]);
  const difference: Record<string, number> = {};

  for (const currency of currencies) {
    difference[currency] = roundCurrency(
      (input.declared[currency] ?? 0) - (input.charged[currency] ?? 0),
    );
  }

  return difference;
}

/** Convierte a la moneda del negocio y traduce el fallo del cambio a un error de validación del cierre. */
function normalize(currency: string | null | undefined): string {
  return (currency ?? "").trim().toUpperCase();
}
