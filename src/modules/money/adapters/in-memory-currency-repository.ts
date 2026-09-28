import { randomUUID } from "node:crypto";

import { currencyCodeKey, type CurrencyDraft } from "@/modules/money/domain/currency-catalog";
import type { CurrencyRecord } from "@/modules/money/domain/money.types";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el doble en memoria del catálogo de monedas, con las mismas reglas
 * que el adaptador de Prisma: nada se borra, el `upsert` no toca `isActive` y una moneda nueva nace
 * activa con su id puesto acá.
 *
 * Es lo que usan los tests de los casos de uso de `money` y de la pantalla: reproducir el adaptador de
 * Prisma exigiría una base.
 */
export class InMemoryCurrencyRepository implements CurrencyRepository {
  private currencies: CurrencyRecord[];

  constructor(seed: { currencies?: CurrencyRecord[] } = {}) {
    this.currencies = (seed.currencies ?? []).map((currency) => ({ ...currency }));
  }

  async listCurrencies(): Promise<CurrencyRecord[]> {
    return [...this.currencies]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map((currency) => ({ ...currency }));
  }

  async findCurrencyByCode(code: string): Promise<CurrencyRecord | null> {
    const key = currencyCodeKey(code);
    const found = this.currencies.find((currency) => currency.code === key);

    return found ? { ...found } : null;
  }

  async upsertCurrency(draft: CurrencyDraft): Promise<CurrencyRecord> {
    const code = currencyCodeKey(draft.code);
    const existing = this.currencies.find((currency) => currency.code === code);

    if (existing) {
      existing.name = draft.name;
      existing.symbol = draft.symbol;
      existing.decimals = draft.decimals;
      existing.isKnown = draft.isKnown;

      return { ...existing };
    }

    const created: CurrencyRecord = {
      id: `cur_${randomUUID()}`,
      code,
      name: draft.name,
      symbol: draft.symbol,
      decimals: draft.decimals,
      isKnown: draft.isKnown,
      isActive: true,
      sortOrder: this.currencies.length,
    };

    this.currencies.push(created);

    return { ...created };
  }

  async setCurrencyActive(code: string, isActive: boolean): Promise<CurrencyRecord | null> {
    const key = currencyCodeKey(code);
    const existing = this.currencies.find((currency) => currency.code === key);

    if (!existing) return null;

    existing.isActive = isActive;

    return { ...existing };
  }

  async countActiveCurrencies(): Promise<number> {
    return this.currencies.filter((currency) => currency.isActive).length;
  }
}
