import { randomUUID } from "node:crypto";

import { mergeBankCatalog } from "@/modules/banks/domain/bank-catalog";
import type {
  BankCatalogEntry,
  BankRecord,
  LocationBankRecord,
} from "@/modules/banks/domain/bank.types";
import type { BankRepository } from "@/modules/banks/ports/bank-repository";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el doble en memoria, con las mismas reglas que Prisma:
 * el catálogo se reemplaza entero, lo que falta se apaga y un banco nuevo recibe su id acá.
 *
 * Es lo que usan los tests de los casos de uso y los de la pantalla: reproducir el adaptador de Prisma
 * exigiría una base.
 */
export class InMemoryBankRepository implements BankRepository {
  private banks: BankRecord[];
  private assignments: LocationBankRecord[];

  constructor(seed: { banks?: BankRecord[]; assignments?: LocationBankRecord[] } = {}) {
    this.banks = (seed.banks ?? []).map((bank) => ({ ...bank }));
    this.assignments = (seed.assignments ?? []).map((assignment) => ({ ...assignment }));
  }

  async listBanks(): Promise<BankRecord[]> {
    return [...this.banks]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((bank) => ({ ...bank }));
  }

  async listAssignments(): Promise<LocationBankRecord[]> {
    return this.assignments.map((assignment) => ({ ...assignment }));
  }

  async replaceCatalog(entries: BankCatalogEntry[]): Promise<BankCatalogEntry[]> {
    const resolved = entries.map((entry) => ({
      ...entry,
      id: entry.id.trim().length > 0 ? entry.id.trim() : `bank_${randomUUID()}`,
    }));

    const keptIds = new Set(resolved.map((entry) => entry.id));

    this.banks = this.banks.map((bank) =>
      keptIds.has(bank.id) ? bank : { ...bank, isActive: false },
    );

    for (const entry of resolved) {
      const existing = this.banks.find((bank) => bank.id === entry.id);
      const next: BankRecord = {
        id: entry.id,
        name: entry.name,
        code: entry.code,
        isActive: entry.isActive,
        sortOrder: entry.sortOrder,
      };

      if (existing) Object.assign(existing, next);
      else this.banks.push(next);
    }

    for (const assignment of this.assignments) {
      if (keptIds.has(assignment.bankId)) assignment.isActive = false;
    }

    for (const entry of resolved) {
      for (const locationId of entry.locationIds) {
        const existing = this.assignments.find(
          (assignment) => assignment.locationId === locationId && assignment.bankId === entry.id,
        );

        if (existing) {
          existing.isActive = true;
          existing.sortOrder = entry.sortOrder;
        } else {
          this.assignments.push({
            locationId,
            bankId: entry.id,
            isActive: true,
            sortOrder: entry.sortOrder,
          });
        }
      }
    }

    return mergeBankCatalog(await this.listBanks(), await this.listAssignments());
  }
}
