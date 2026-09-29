import {
  DEFAULT_CASH_DENOMINATIONS,
  DEFAULT_LOCATION_CASH_CONFIG,
} from "@/modules/cash-config/domain/cash-config-defaults";
import type {
  CashCountConfig,
  CashDenominationRecord,
} from "@/modules/cash-config/domain/cash-config.types";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) + `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-88`) — la
 * config del conteo, en una función pura.
 *
 * Es la regla que comparten la **pantalla** (dibuja la grilla con esto) y el **servidor** (valida el
 * payload con esto): si la pantalla ofreciera un billete que el servidor rechaza —o al revés—, el cajero
 * no podría cerrar la caja con un conteo que él hizo bien.
 *
 * Tres reglas:
 *
 * 1. La **moneda base del negocio siempre está**, aunque la lista guardada no la nombre: es la que más
 *    entra y el arqueo no puede quedarse sin poder contarla. El resto son las **monedas contables de la
 *    sucursal**, una lista configurable; antes esto era un booleano del dólar (`usdEnabled`) y sumar una
 *    tercera moneda exigía columnas y código nuevos.
 * 2. **Solo las denominaciones activas**, de mayor a menor: desactivar un billete lo saca de la grilla y
 *    del payload aceptado, sin borrar la fila (los cierres viejos conservan sus billetes).
 * 3. Si una moneda se queda **sin filas activas**, se cae a los defaults del módulo: una base recién
 *    creada —o una sucursal sin tocar— no puede quedarse sin poder contar. Una moneda nueva **sin**
 *    denominaciones cargadas no recibe billetes inventados: la lista queda vacía y el dueño la carga.
 */
export function toCashCountConfig(input: {
  /** La moneda base del negocio (hoy `NIO`), la que no se puede apagar. */
  businessCurrencyCode: string;
  /**
   * Las monedas contables que la sucursal configuró, además de la base. Códigos en cualquier forma: se
   * normalizan y se descartan los que repiten la base.
   */
  countedCurrencyCodes: readonly string[];
  denominations: CashDenominationRecord[];
}): CashCountConfig {
  const businessCurrency = input.businessCurrencyCode.trim().toUpperCase();
  const configured = input.countedCurrencyCodes
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code.length > 0 && code !== businessCurrency);

  const currencies = [businessCurrency, ...new Set(configured)];

  const denominations: Record<string, number[]> = {};

  for (const currency of currencies) {
    denominations[currency] = activeValuesFor(input.denominations, currency);
  }

  return { currencies, denominations };
}

/**
 * Los valores contables de una moneda: los activos de la config, de mayor a menor, o los defaults si la
 * moneda no tiene ninguno activo.
 */
export function activeValuesFor(
  denominations: CashDenominationRecord[],
  currency: string,
): number[] {
  const target = currency.trim().toUpperCase();

  const active = denominations
    .filter((row) => row.currency.trim().toUpperCase() === target && row.isActive)
    .map((row) => row.value);

  const values = active.length > 0 ? active : (DEFAULT_CASH_DENOMINATIONS[target] ?? []);

  // De mayor a menor: el cajero cuenta de arriba hacia abajo, y así lo muestran la grilla y el papel.
  return [...values].sort((a, b) => b - a);
}

/** La config por sucursal con sus valores de fábrica, para una sucursal que todavía no tiene fila. */
export function defaultLocationCashConfig(locationId: string) {
  return {
    locationId,
    /**
     * `A-88` — una sucursal nueva nace contando **sólo la moneda base** (la lista vacía la agrega
     * `toCashCountConfig`). Es lo mismo que hacía `usdEnabled: false`, pero sin el booleano: sumar otra
     * moneda es agregarla a la lista, no encender un interruptor que sólo existe para el dólar.
     */
    countedCurrencyCodes: [] as string[],
    blindCount: DEFAULT_LOCATION_CASH_CONFIG.blindCount,
    updatedAt: null,
    updatedByUserId: null,
  };
}
