/**
 * Fase 2 del rediseño de Caja (2026-09-22) — los tipos de la configuración de caja.
 *
 * Dos cosas distintas viven juntas a propósito:
 *
 * - La **config por sucursal** (`LocationCashConfig`): qué monedas se cuentan (`usdEnabled`) y si el
 *   cajero ve el esperado (`blindCount`). Cada local es independiente (brief §12).
 * - Las **denominaciones** (`CashDenomination`), que son del negocio y no de la sucursal: los billetes de
 *   córdoba son los mismos en los tres locales. Se editan una vez y valen para todos.
 */

/** Una fila del catálogo de billetes y monedas. `isActive: false` = existe pero ya no se cuenta. */
export type CashDenominationRecord = {
  currency: string;
  value: number;
  isActive: boolean;
  sortOrder: number;
};

/** La configuración de una sucursal, sin las denominaciones. */
export type LocationCashConfigRecord = {
  locationId: string;
  /** La moneda del negocio se cuenta siempre; el dólar, solo si esto está prendido. */
  usdEnabled: boolean;
  /** Arqueo ciego: el cajero no ve el esperado ni la diferencia (se aplica en la pantalla). */
  blindCount: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

/** Lo que devuelve la API y lo que edita la pantalla. */
export type CashConfigRecord = LocationCashConfigRecord & {
  denominations: CashDenominationRecord[];
};

/** Lo que se puede cambiar. Todo opcional: la pantalla manda lo que tocó. */
export type CashConfigPatch = {
  usdEnabled?: boolean;
  blindCount?: boolean;
  denominations?: CashDenominationRecord[];
};

/**
 * Lo que consume el **conteo** (la grilla de la pantalla y la validación del servidor).
 *
 * `currencies` está ordenado con la moneda del negocio primero, y `denominations` trae **solo las
 * activas**, de mayor a menor. Es el contrato entre la config y el conteo: los dos lados leen lo mismo.
 */
/**
 * Fase 4 del rediseño de Caja (2026-09-22) — la config del conteo **más el arqueo ciego**, que es lo que
 * necesita la pantalla del turno: la grilla (monedas y billetes) y si el cajero puede ver la diferencia.
 *
 * El servidor valida con CashCountConfig (no le importa el ciego); la pantalla recibe esta.
 */
export type CashViewConfig = CashCountConfig & { blindCount: boolean };

export type CashCountConfig = {
  currencies: string[];
  denominations: Record<string, number[]>;
};
