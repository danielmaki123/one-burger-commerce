import type { KnownCurrency } from "@/modules/money/domain/currency-catalog";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`/`D-019`) — **las formas con las que viaja la configuración
 * financiera**.
 *
 * Son los registros de persistencia tal como los consumen el dominio y los casos de uso: sin Prisma, sin
 * `Decimal` y con las fechas en ISO. El adaptador es el único que traduce (y el que convierte
 * `Decimal` con `Number(d.toString())`).
 *
 * `BusinessCurrencySettings` es una **fila única**: su id no lo elige nadie, y por eso vive acá como
 * constante y no como campo del tipo. Cuál es la moneda base **no** es una columna del catálogo de
 * monedas: es esta fila (`D-018`), y cambiarla es una operación explícita y auditada.
 */

export const MONEY_SETTINGS_ID = "default";

export type CurrencyRecord = {
  id: string;
  /** El código con el que la moneda se nombra en todo el sistema, normalizado a mayúsculas. */
  code: string;
  name: string;
  symbol: string;
  /** Decimales del catálogo: son de la moneda, no del formateador. `0..4`. */
  decimals: number;
  /** `true` = está en el catálogo conocido; `false` = la cargó el negocio (`D-019`). */
  isKnown: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type BusinessCurrencySettingsRecord = {
  baseCurrencyCode: string;
  /** Cómo se muestra la plata (`es-NI`). Cambiarlo cambia la vista, no ningún monto guardado. */
  locale: string;
  updatedByUserId: string | null;
};

/**
 * Lo que la pantalla de Finanzas necesita para mostrar —y para convertir— la configuración vigente.
 *
 * `activeRates` es el mapa `moneda → tasa` que consume `convertToBaseCurrency` (`{ USD: 36.5 }`): la tasa
 * **vigente** de cada moneda contra la base de hoy, no el historial.
 */
export type MoneySettingsView = {
  baseCurrencyCode: string;
  locale: string;
  /** El catálogo completo, activos e inactivos: una moneda no se borra, se apaga. */
  currencies: CurrencyRecord[];
  /** Tasa vigente por moneda (`ratesFromActive`): lista para `convertToBaseCurrency`. */
  activeRates: Record<string, number>;
  /** El catálogo conocido de fábrica: conveniencia para el formulario, no una restricción. */
  knownCurrencies: readonly KnownCurrency[];
};
