import type { Currency } from "@prisma/client";

import { getPrismaClient, type DatabaseClient } from "@/infrastructure/database/prisma";
import { currencyCodeKey, type CurrencyDraft } from "@/modules/money/domain/currency-catalog";
import type { CurrencyRecord } from "@/modules/money/domain/money.types";
import type { CurrencyRepository } from "@/modules/money/ports/currency-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`) — el catálogo de monedas en Postgres.
 *
 * Dos detalles que no son obvios:
 *
 * 1. **Nada se borra.** No hay `delete` acá a propósito: un `Payment` de ayer nombra su moneda y la clave
 *    foránea de `ExchangeRate` es `onDelete: Restrict`. La baja es `isActive = false`.
 * 2. **El `upsert` no toca `isActive`.** Editar el nombre de una moneda apagada no la vuelve a prender:
 *    prender y apagar es `setCurrencyActive`, una decisión distinta.
 */
function mapCurrency(row: Currency): CurrencyRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    isKnown: row.isKnown,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export class PrismaCurrencyRepository implements CurrencyRepository {
  constructor(private readonly client: DatabaseClient = getPrismaClient()) {}

  async listCurrencies(): Promise<CurrencyRecord[]> {
    const rows = await this.client.currency.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });

    return rows.map(mapCurrency);
  }

  async findCurrencyByCode(code: string): Promise<CurrencyRecord | null> {
    const row = await this.client.currency.findUnique({ where: { code: currencyCodeKey(code) } });

    return row ? mapCurrency(row) : null;
  }

  async upsertCurrency(draft: CurrencyDraft): Promise<CurrencyRecord> {
    const code = currencyCodeKey(draft.code);

    const row = await this.client.currency.upsert({
      where: { code },
      create: {
        code,
        name: draft.name,
        symbol: draft.symbol,
        decimals: draft.decimals,
        isKnown: draft.isKnown,
        isActive: true,
      },
      // La identidad se actualiza; `isActive` no (la baja tiene su propia operación).
      update: {
        name: draft.name,
        symbol: draft.symbol,
        decimals: draft.decimals,
        isKnown: draft.isKnown,
      },
    });

    return mapCurrency(row);
  }

  async setCurrencyActive(code: string, isActive: boolean): Promise<CurrencyRecord | null> {
    const key = currencyCodeKey(code);

    // `updateMany` + lectura: no tira `P2025` cuando la moneda no está, y el caso de uso decide qué
    // hacer con un `null` en vez de recibir una excepción de Prisma.
    const result = await this.client.currency.updateMany({ where: { code: key }, data: { isActive } });
    if (result.count === 0) return null;

    const row = await this.client.currency.findUnique({ where: { code: key } });

    return row ? mapCurrency(row) : null;
  }

  async countActiveCurrencies(): Promise<number> {
    return this.client.currency.count({ where: { isActive: true } });
  }
}
