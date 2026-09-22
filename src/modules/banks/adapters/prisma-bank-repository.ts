import { randomUUID } from "node:crypto";

import type { Bank } from "@prisma/client";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { mergeBankCatalog } from "@/modules/banks/domain/bank-catalog";
import type {
  BankCatalogEntry,
  BankRecord,
  LocationBankRecord,
} from "@/modules/banks/domain/bank.types";
import type { BankRepository } from "@/modules/banks/ports/bank-repository";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el adaptador de Prisma del catálogo de bancos.
 *
 * Tres detalles que no son obvios:
 *
 * 1. **`replaceCatalog` no borra**: lo que no viene en la lista queda `isActive: false` (banco y
 *    asignación). Borrar fallaría por la clave foránea de `ShiftBankClose` y, sobre todo, dejaría un cierre
 *    viejo sin el banco contra el que se cuadró.
 * 2. **El id de un banco nuevo lo pone acá**: la pantalla manda el catálogo completo y una fila nueva sin
 *    id; sin id resuelto, la asignación por sucursal no tendría a qué apuntar. El id es del servidor,
 *    igual que el de un turno.
 * 3. **La identidad del banco es su id**: renombrar no crea una fila nueva, así que el `upsert` va por id
 *    y el nombre es solo una etiqueta (única, pero etiqueta al fin).
 */
function mapBank(row: Bank): BankRecord {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

/** `notIn: []` no filtra nada en Prisma; el caso «el catálogo quedó vacío» se trata aparte. */
function notIn(ids: readonly string[]): { notIn: string[] } {
  return { notIn: ids.length > 0 ? [...ids] : ["__ninguno__"] };
}

export class PrismaBankRepository implements BankRepository {
  async listBanks(): Promise<BankRecord[]> {
    const rows = await getPrismaClient().bank.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return rows.map(mapBank);
  }

  async listAssignments(): Promise<LocationBankRecord[]> {
    const rows = await getPrismaClient().locationBank.findMany({
      orderBy: [{ locationId: "asc" }, { sortOrder: "asc" }],
    });

    return rows.map((row) => ({
      locationId: row.locationId,
      bankId: row.bankId,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    }));
  }

  async replaceCatalog(entries: BankCatalogEntry[]): Promise<BankCatalogEntry[]> {
    const resolved = entries.map((entry) => ({
      ...entry,
      id: entry.id.trim().length > 0 ? entry.id.trim() : `bank_${randomUUID()}`,
    }));

    await this.replaceBanks(resolved);
    await this.replaceAssignments(resolved);

    const [banks, assignments] = await Promise.all([this.listBanks(), this.listAssignments()]);

    return mergeBankCatalog(banks, assignments);
  }

  private async replaceBanks(entries: BankCatalogEntry[]): Promise<void> {
    const prisma = getPrismaClient();
    const keptIds = entries.map((entry) => entry.id);

    await prisma.$transaction([
      // Lo que no venga en la lista se apaga (no se borra).
      prisma.bank.updateMany({ where: { id: notIn(keptIds) }, data: { isActive: false } }),
      ...entries.map((entry) =>
        prisma.bank.upsert({
          where: { id: entry.id },
          create: {
            id: entry.id,
            name: entry.name,
            code: entry.code,
            isActive: entry.isActive,
            sortOrder: entry.sortOrder,
          },
          update: {
            name: entry.name,
            code: entry.code,
            isActive: entry.isActive,
            sortOrder: entry.sortOrder,
          },
        }),
      ),
    ]);
  }

  /**
   * Las asignaciones de los bancos **incluidos** se reemplazan enteras: prender y apagar un banco en una
   * sucursal es una sola decisión, y dejar media lista vieja haría que el cierre ofrezca un banco que ya no
   * liquida ahí. Se apaga por **banco** (no por sucursal) para que quitarle a un banco su última sucursal
   * también apague su fila: la sucursal que ya no aparece en ninguna lista no se puede usar como filtro.
   */
  private async replaceAssignments(entries: BankCatalogEntry[]): Promise<void> {
    const prisma = getPrismaClient();
    const bankIds = entries.map((entry) => entry.id);

    if (bankIds.length === 0) {
      await prisma.locationBank.updateMany({ data: { isActive: false } });
      return;
    }

    await prisma.$transaction([
      prisma.locationBank.updateMany({
        where: { bankId: { in: bankIds } },
        data: { isActive: false },
      }),
      ...entries.flatMap((entry) =>
        entry.locationIds.map((locationId) =>
          prisma.locationBank.upsert({
            where: { locationId_bankId: { locationId, bankId: entry.id } },
            create: { locationId, bankId: entry.id, isActive: true, sortOrder: entry.sortOrder },
            update: { isActive: true, sortOrder: entry.sortOrder },
          }),
        ),
      ),
    ]);
  }
}
