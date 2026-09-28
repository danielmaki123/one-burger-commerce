import type { CurrencyDraft } from "@/modules/money/domain/currency-catalog";
import type { CurrencyRecord } from "@/modules/money/domain/money.types";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-69`, `D-019`) — el puerto del catálogo de monedas.
 *
 * Cinco operaciones y **ninguna borra**: una moneda se apaga (`isActive`), porque un cobro de ayer sigue
 * nombrándola y la clave foránea de `ExchangeRate` lo exige (`onDelete: Restrict`). `upsertCurrency`
 * tampoco toca `isActive`: la baja es `setCurrencyActive`, que es una decisión distinta de editar el
 * nombre.
 */
export interface CurrencyRepository {
  /** El catálogo completo, activos e inactivos, ordenado para la pantalla. */
  listCurrencies(): Promise<CurrencyRecord[]>;
  findCurrencyByCode(code: string): Promise<CurrencyRecord | null>;
  /**
   * Crea la moneda si falta o actualiza su identidad (nombre, símbolo, decimales) si ya está. **No**
   * cambia `isActive`: prender y apagar es otra operación.
   */
  upsertCurrency(draft: CurrencyDraft): Promise<CurrencyRecord>;
  /** La baja (o la reactivación). `null` si esa moneda no está en el catálogo. */
  setCurrencyActive(code: string, isActive: boolean): Promise<CurrencyRecord | null>;
  /** Cuántas monedas quedan activas: el catálogo no puede quedar sin ninguna. */
  countActiveCurrencies(): Promise<number>;
}
