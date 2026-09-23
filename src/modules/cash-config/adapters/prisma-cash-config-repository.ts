import type { CashDenomination, LocationCashConfig, PosTerminal } from "@prisma/client";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type {
  CashDenominationRecord,
  CashConfigPatch,
  LocationCashConfigRecord,
  PosTerminalRecord,
} from "@/modules/cash-config/domain/cash-config.types";
import type {
  CashConfigRepository,
  UpdateCashConfigMeta,
} from "@/modules/cash-config/ports/cash-config-repository";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — el adaptador de Prisma.
 *
 * Dos detalles que no son obvios:
 *
 * 1. **`replaceDenominations` desactiva antes de subir**: lo que no viene en la lista queda `isActive:
 *    false`, no se borra. Es la razón por la que un cierre viejo sigue diciendo con qué billetes se contó
 *    (`ShiftCashCount` guarda el valor, no una referencia a esta tabla). Se hace en una transacción para
 *    que nadie vea la tabla con todo apagado a mitad de camino.
 * 2. **El `Decimal` se convierte a `number`**: el dominio y la pantalla trabajan con números; el
 *    `Decimal` se queda en la base (el tipo de la columna es la garantía de los dos decimales).
 */
function mapLocationConfig(row: LocationCashConfig): LocationCashConfigRecord {
  return {
    locationId: row.locationId,
    usdEnabled: row.usdEnabled,
    blindCount: row.blindCount,
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
  };
}

function mapDenomination(row: CashDenomination): CashDenominationRecord {
  return {
    currency: row.currency,
    value: Number(row.value),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export class PrismaCashConfigRepository implements CashConfigRepository {
  async getLocationConfig(locationId: string): Promise<LocationCashConfigRecord | null> {
    const row = await getPrismaClient().locationCashConfig.findUnique({ where: { locationId } });

    return row ? mapLocationConfig(row) : null;
  }

  async saveLocationConfig(
    locationId: string,
    patch: Pick<CashConfigPatch, "usdEnabled" | "blindCount">,
    meta: UpdateCashConfigMeta = {},
  ): Promise<LocationCashConfigRecord> {
    const updatedByUserId = meta.updatedByUserId ?? null;
    const data = {
      ...(patch.usdEnabled !== undefined ? { usdEnabled: patch.usdEnabled } : {}),
      ...(patch.blindCount !== undefined ? { blindCount: patch.blindCount } : {}),
    };

    const row = await getPrismaClient().locationCashConfig.upsert({
      where: { locationId },
      create: { locationId, ...data, updatedByUserId },
      update: { ...data, updatedByUserId },
    });

    return mapLocationConfig(row);
  }

  async listDenominations(): Promise<CashDenominationRecord[]> {
    const rows = await getPrismaClient().cashDenomination.findMany({
      orderBy: [{ currency: "asc" }, { value: "desc" }],
    });

    return rows.map(mapDenomination);
  }

  async replaceDenominations(rows: CashDenominationRecord[]): Promise<CashDenominationRecord[]> {
    const prisma = getPrismaClient();

    await prisma.$transaction([
      // Lo que no venga en la lista queda apagado (no borrado).
      prisma.cashDenomination.updateMany({ data: { isActive: false } }),
      ...rows.map((row) =>
        prisma.cashDenomination.upsert({
          where: { currency_value: { currency: row.currency, value: row.value } },
          create: {
            currency: row.currency,
            value: row.value,
            isActive: row.isActive,
            sortOrder: row.sortOrder,
          },
          update: { isActive: row.isActive, sortOrder: row.sortOrder },
        }),
      ),
    ]);

    return this.listDenominations();
  }

  async listPosTerminals(locationIds: readonly string[]): Promise<PosTerminalRecord[]> {
    const rows = await getPrismaClient().posTerminal.findMany({
      where: { locationId: { in: [...locationIds] } },
      orderBy: [{ locationId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    return rows.map(mapPosTerminal);
  }

  /**
   * Reemplaza las terminales de **una** sucursal.
   *
   * Dos cosas que no son obvias: el `id` de una terminal nueva lo pone la pantalla (`terminal_<uuid>` desde
   * el formulario) porque el `upsert` necesita la clave, y lo que no viene en la lista queda **apagado** —no
   * borrado—: un turno viejo la referencia y el `onDelete: Restrict` de la base lo exige.
   */
  async replacePosTerminals(
    locationId: string,
    rows: readonly PosTerminalRecord[],
  ): Promise<PosTerminalRecord[]> {
    const prisma = getPrismaClient();
    const keptIds = rows.map((row) => row.id);

    await prisma.$transaction([
      prisma.posTerminal.updateMany({
        where: { locationId, id: { notIn: keptIds.length > 0 ? [...keptIds] : ["__ninguna__"] } },
        data: { isActive: false },
      }),
      ...rows.map((row, index) =>
        prisma.posTerminal.upsert({
          where: { id: row.id },
          create: {
            id: row.id,
            locationId,
            label: row.label,
            isActive: row.isActive,
            sortOrder: Number.isInteger(row.sortOrder) ? row.sortOrder : index,
          },
          update: {
            label: row.label,
            isActive: row.isActive,
            sortOrder: Number.isInteger(row.sortOrder) ? row.sortOrder : index,
          },
        }),
      ),
    ]);

    return this.listPosTerminals([locationId]);
  }
}

function mapPosTerminal(row: PosTerminal): PosTerminalRecord {
  return {
    id: row.id,
    locationId: row.locationId,
    label: row.label,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}
