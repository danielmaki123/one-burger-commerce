/**
 * Fase 3 del rediseño de Caja (2026-09-23) — los tipos del catálogo de bancos.
 *
 * Dos cosas con dueños distintos, como en la config del conteo:
 *
 * - El **banco** es del negocio: el mismo banco liquida en las tres sucursales.
 * - La **asignación** (`LocationBank`) es por sucursal: es lo que decide qué bloques dibuja el cierre de
 *   cada local, y lo que el servidor valida cuando recibe un cuadre.
 */

export type BankRecord = {
  id: string;
  name: string;
  /** Nombre corto del papel (`BAC`, `BANPRO`). `null` = se usa el nombre largo. */
  code: string | null;
  isActive: boolean;
  sortOrder: number;
};

/** Una asignación banco ↔ sucursal. `isActive: false` = se apagó sin perder la historia. */
export type LocationBankRecord = {
  locationId: string;
  bankId: string;
  isActive: boolean;
  sortOrder: number;
};

/** El banco con las sucursales donde está activo: lo que edita la pantalla y lo que devuelve la API. */
export type BankCatalogEntry = BankRecord & {
  locationIds: string[];
};
