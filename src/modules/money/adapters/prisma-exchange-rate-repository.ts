import type { ExchangeRate, Prisma } from "@prisma/client";

import { getPrismaClient, type DatabaseClient } from "@/infrastructure/database/prisma";
import type { RecordAuditLogInput } from "@/modules/audit/ports/audit-log-repository";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import { closePeriod, type ExchangeRateRecord } from "@/modules/money/domain/exchange-rate";
import type {
  CreateExchangeRateInput,
  ExchangeRateRepository,
} from "@/modules/money/ports/exchange-rate-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-72`, `A-80`, `D-018`) — el historial de tasas en Postgres.
 *
 * Tres reglas que el adaptador tiene que hacer cumplir:
 *
 * 1. **Registrar una tasa no pisa la anterior**: se la cierra con `effectiveTo = effectiveFrom` (el
 *    intervalo es semiabierto, así dos períodos no se solapan en el instante del cambio) y se agrega una
 *    fila. `closePeriod` decide **qué** se escribe; esto sólo lo lleva a la base.
 * 2. **La fila y su asiento son una sola unidad**: `$transaction` abre la unidad y el asiento se escribe
 *    con el `tx`. Si el log falla, la tasa no queda registrada — al revés que un asiento best-effort, que
 *    es lo correcto para un hecho que ya pasó (un cobro) y no para una configuración que se está
 *    firmando.
 * 3. **El `Decimal` se convierte con `Number(d.toString())`**, como el resto de los adaptadores: pasar por
 *    `Number(d)` a secas arrastraría la representación binaria del `Decimal` de Prisma.
 */
function mapRate(row: ExchangeRate): ExchangeRateRecord {
  return {
    id: row.id,
    fromCurrencyCode: row.fromCurrencyCode,
    toCurrencyCode: row.toCurrencyCode,
    rate: Number(row.rate.toString()),
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo ? row.effectiveTo.toISOString() : null,
  };
}

function auditData(entry: RecordAuditLogInput) {
  return {
    action: entry.action,
    actorUserId: entry.actorUserId,
    targetType: entry.targetType,
    targetId: entry.targetId,
    // Prisma pide su propio tipo para `Json`; el detalle es un objeto plano (lo arma el dominio).
    ...(entry.detail ? { detail: entry.detail as Prisma.InputJsonValue } : {}),
  };
}

export class PrismaExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly client: DatabaseClient = getPrismaClient()) {}

  async listRatesForPair(from: string, to: string): Promise<ExchangeRateRecord[]> {
    const rows = await this.client.exchangeRate.findMany({
      where: {
        fromCurrencyCode: currencyKey(from),
        toCurrencyCode: currencyKey(to),
      },
      orderBy: { effectiveFrom: "asc" },
    });

    return rows.map(mapRate);
  }

  async listActiveRatesTo(baseCurrencyCode: string): Promise<ExchangeRateRecord[]> {
    const rows = await this.client.exchangeRate.findMany({
      where: { toCurrencyCode: currencyKey(baseCurrencyCode), effectiveTo: null },
      orderBy: { fromCurrencyCode: "asc" },
    });

    return rows.map(mapRate);
  }

  async createRate(input: CreateExchangeRateInput): Promise<ExchangeRateRecord> {
    const from = currencyKey(input.fromCurrencyCode);
    const to = currencyKey(input.toCurrencyCode);
    const effectiveFrom = new Date(input.effectiveFrom);

    // El cliente raíz: un `tx` no puede abrir otra transacción (ver `infrastructure/database/prisma.ts`).
    const prisma = getPrismaClient();

    const created = await prisma.$transaction(async (tx) => {
      const previous = await tx.exchangeRate.findFirst({
        where: { fromCurrencyCode: from, toCurrencyCode: to, effectiveTo: null },
      });

      if (previous) {
        const closed = closePeriod(mapRate(previous), input.effectiveFrom);

        await tx.exchangeRate.update({
          where: { id: closed.id },
          // Sólo se cierra: la tasa y el `effectiveFrom` del período anterior no se reescriben.
          data: { effectiveTo: new Date(closed.effectiveTo) },
        });
      }

      const row = await tx.exchangeRate.create({
        data: {
          fromCurrencyCode: from,
          toCurrencyCode: to,
          rate: input.rate,
          effectiveFrom,
          createdByUserId: input.createdByUserId,
        },
      });

      await tx.adminAuditLog.create({ data: auditData(input.audit) });

      return row;
    });

    return mapRate(created);
  }

  async closeActiveRate(from: string, to: string, effectiveTo: string): Promise<number> {
    const result = await this.client.exchangeRate.updateMany({
      where: {
        fromCurrencyCode: currencyKey(from),
        toCurrencyCode: currencyKey(to),
        effectiveTo: null,
      },
      data: { effectiveTo: new Date(effectiveTo) },
    });

    return result.count;
  }

  async closeRatesTo(baseCurrencyCode: string, effectiveTo: string): Promise<number> {
    const result = await this.client.exchangeRate.updateMany({
      // Las tasas anteriores **siguen nombrando** la base contra la que se registraron: sólo se cierran.
      where: { toCurrencyCode: currencyKey(baseCurrencyCode), effectiveTo: null },
      data: { effectiveTo: new Date(effectiveTo) },
    });

    return result.count;
  }
}
