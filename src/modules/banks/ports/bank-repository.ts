import type { BankCatalogEntry, BankRecord, LocationBankRecord } from "@/modules/banks/domain/bank.types";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el puerto del catálogo de bancos.
 *
 * Tres operaciones, y ninguna borra: el cierre se apoya en que un banco apagado siga existiendo (los
 * cierres viejos lo referencian y el `onDelete: Restrict` de la base lo exige).
 */
export interface BankRepository {
  /** Todos los bancos, activos e inactivos, ordenados para la pantalla. */
  listBanks(): Promise<BankRecord[]>;
  /** Todas las asignaciones banco ↔ sucursal (activas e inactivas): son pocas y las lee la config. */
  listAssignments(): Promise<LocationBankRecord[]>;
  /**
   * Guarda el catálogo **completo**: sube lo que viene, apaga lo que falta y reemplaza las asignaciones de
   * las sucursales incluidas. Devuelve el catálogo tal como quedó.
   */
  replaceCatalog(entries: BankCatalogEntry[]): Promise<BankCatalogEntry[]>;
}
