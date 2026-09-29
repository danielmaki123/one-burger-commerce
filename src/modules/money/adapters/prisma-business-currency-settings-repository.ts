import type { BusinessCurrencySettings, Prisma } from "@prisma/client";

import { getPrismaClient, type DatabaseClient } from "@/infrastructure/database/prisma";
import type { RecordAuditLogInput } from "@/modules/audit/ports/audit-log-repository";
import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { currencyKey } from "@/modules/money/domain/convert-to-base-currency";
import {
  MONEY_SETTINGS_ID,
  type BusinessCurrencySettingsRecord,
} from "@/modules/money/domain/money.types";
import type {
  BusinessCurrencySettingsRepository,
  ChangeBaseCurrencyRepositoryInput,
} from "@/modules/money/ports/business-currency-settings-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-018`, `A-80`) — **la autoridad monetaria actual** en Postgres.
 *
 * La fila es **una sola** (`id = 'default'`): la moneda base no es una columna del catálogo ni un campo
 * de texto que se reescribe hacia atrás. Cambiarla es una operación explícita, y sus tres escrituras van
 * en una misma transacción:
 *
 * 1. la fila única (la base nueva y su locale);
 * 2. el **cierre** de los períodos de tasa abiertos contra la base anterior —se cierran, no se
 *    reescriben: la tasa vieja sigue nombrando la base contra la que se registró—;
 * 3. el asiento de auditoría, con de/para.
 *
 * **No** toca `Payment`, `Refund`, `Shift` ni `Invoice`: el hecho histórico conserva su moneda, su tasa y
 * su equivalente (ley 7, `D-018`).
 */
function mapSettings(row: BusinessCurrencySettings): BusinessCurrencySettingsRecord {
  return {
    baseCurrencyCode: row.baseCurrencyCode,
    locale: row.locale,
    updatedByUserId: row.updatedByUserId,
  };
}

function auditData(entry: RecordAuditLogInput) {
  return {
    action: entry.action,
    actorUserId: entry.actorUserId,
    targetType: entry.targetType,
    targetId: entry.targetId,
    ...(entry.detail ? { detail: entry.detail as Prisma.InputJsonValue } : {}),
  };
}

export class PrismaBusinessCurrencySettingsRepository
  implements BusinessCurrencySettingsRepository
{
  constructor(private readonly client: DatabaseClient = getPrismaClient()) {}

  async getSettings(): Promise<BusinessCurrencySettingsRecord | null> {
    const row = await this.client.businessCurrencySettings.findUnique({
      where: { id: MONEY_SETTINGS_ID },
    });

    return row ? mapSettings(row) : null;
  }

  async changeBaseCurrency(
    input: ChangeBaseCurrencyRepositoryInput,
  ): Promise<BusinessCurrencySettingsRecord> {
    const baseCurrencyCode = currencyKey(input.baseCurrencyCode);
    const previousBaseCurrencyCode = currencyKey(input.previousBaseCurrencyCode);
    // El cliente raíz: un `tx` no puede abrir otra transacción (ver `infrastructure/database/prisma.ts`).
    const prisma = getPrismaClient();

    const saved = await prisma.$transaction(async (tx) => {
      if (previousBaseCurrencyCode !== baseCurrencyCode) {
        await tx.exchangeRate.updateMany({
          where: { toCurrencyCode: previousBaseCurrencyCode, effectiveTo: null },
          data: { effectiveTo: new Date(input.effectiveFrom) },
        });
      }

      const row = await tx.businessCurrencySettings.upsert({
        where: { id: MONEY_SETTINGS_ID },
        create: {
          id: MONEY_SETTINGS_ID,
          baseCurrencyCode,
          locale: input.locale,
          updatedByUserId: input.updatedByUserId,
        },
        update: {
          baseCurrencyCode,
          locale: input.locale,
          updatedByUserId: input.updatedByUserId,
        },
      });

      await tx.adminAuditLog.create({ data: auditData(input.audit) });

      return row;
    });

    return mapSettings(saved);
  }

  /**
   * `A-87` — sólo el formato regional.
   *
   * Un `UPDATE` de un campo de presentación: **no** cierra períodos de tasa, **no** deja asiento y **no**
   * toca la moneda base. Compartir el camino de `changeBaseCurrency` era el bug: el dominio rechaza cambiar
   * la base por la misma base, así que el formato nunca se guardaba.
   */
  async setLocale(input: {
    locale: string;
    updatedByUserId: string | null;
  }): Promise<BusinessCurrencySettingsRecord> {
    const current = await this.getSettings();
    const baseCurrencyCode = currencyKey(
      current?.baseCurrencyCode ?? DEFAULT_BUSINESS_SETTINGS.currencyCode,
    );

    const row = await this.client.businessCurrencySettings.upsert({
      where: { id: MONEY_SETTINGS_ID },
      create: {
        id: MONEY_SETTINGS_ID,
        baseCurrencyCode,
        locale: input.locale,
        updatedByUserId: input.updatedByUserId,
      },
      update: { locale: input.locale, updatedByUserId: input.updatedByUserId },
    });

    return mapSettings(row);
  }
}
