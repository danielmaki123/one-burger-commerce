/**
 * Fase 2 del rediseño de Caja (2026-09-22) — los **valores de fábrica** de la configuración de caja.
 *
 * Este archivo es la única fuente de los billetes y monedas con los que arranca el negocio:
 *
 * 1. La **migración** siembra la tabla `CashDenomination` con estas filas (y hay un test de contrato que
 *    falla si los dos se desincronizan, igual que con `business-settings-defaults.ts`).
 * 2. El dominio cae acá cuando una moneda **no tiene filas activas**: una base recién creada, o una
 *    sucursal sin tocar, no puede quedarse sin poder contar la caja.
 *
 * Antes esta lista estaba hardcodeada dentro del dominio del turno (`orders/domain/shift-cash.ts`): el
 * brief del rediseño pide que sea **configurable** y que la config viva en un módulo propio.
 */

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-88`) — **el dólar dejó de ser estructura**.
 *
 * `NIO`/`USD` y sus denominaciones siguen acá como **seed inicial** de Nicaragua: son los billetes con los
 * que arranca el negocio y lo que la migración siembra en `CashDenomination`. Lo que **ya no** hay es un
 * `usdEnabled`: qué monedas cuenta cada sucursal es una **lista configurable**
 * (`LocationCashConfig.countedCurrencyCodes`), así que una moneda nueva se agrega desde
 * `/admin/cash/config` sin tocar código ni agregar una columna.
 *
 * Una moneda nueva **no recibe billetes inventados**: `DEFAULT_CASH_DENOMINATIONS` no la conoce y su lista
 * de valores queda vacía hasta que el dueño la cargue.
 */

/** La moneda del negocio: se cuenta siempre, no se puede apagar. */
export const BASE_CASH_CURRENCY = "NIO";

/**
 * Billetes y monedas de cada moneda, de mayor a menor.
 *
 * Es la lista del mostrador, no una regla universal: si el negocio empieza a contar otra moneda, se
 * carga desde `/admin/cash/config` (Fase 2) sin tocar código.
 */
export const DEFAULT_CASH_DENOMINATIONS: Record<string, number[]> = {
  NIO: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  USD: [100, 50, 20, 10, 5, 2, 1],
};

/** Monedas que el módulo sabe contar de fábrica (la del negocio siempre; el dólar si el local lo cuenta). */
export const KNOWN_CASH_CURRENCIES = [BASE_CASH_CURRENCY, "USD"] as const;

/**
 * La configuración por sucursal tal como nace: **sin monedas contables extra** (cada local decide qué
 * cuenta, además de la base) y con **arqueo ciego prendido** (decisión del brief: el cajero no ve el
 * esperado ni la diferencia; la aplicación efectiva en la pantalla llega en la Fase 4).
 */
export const DEFAULT_LOCATION_CASH_CONFIG = {
  countedCurrencyCodes: [] as string[],
  blindCount: true,
} as const;
