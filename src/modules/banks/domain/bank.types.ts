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
  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-019`) — **qué clase de entidad de cobro es**: banco, adquirente,
   * proveedor digital u otro.
   *
   * Es lo que el medio de pago necesita para saber contra qué se liquida, y por eso vive en el catálogo que
   * ya existía: **no** hay un segundo catálogo de entidades. Las entidades cargadas antes de la columna
   * quedan en `other` **explícito** (`D-020`): el tipo **no** se infiere del nombre.
   *
   * Es **opcional en el tipo** porque los llamadores que no editan entidades (el cierre de caja, los seeds de
   * test) siguen construyendo un `BankRecord` sin él; el adaptador de Prisma **siempre** lo devuelve, y la
   * pantalla que lo edita lo exige.
   */
  entityType?: BankEntityType;
  isActive: boolean;
  sortOrder: number;
};

export const BANK_ENTITY_TYPES = ["bank", "acquirer", "digital_provider", "other"] as const;

export type BankEntityType = (typeof BANK_ENTITY_TYPES)[number];

export function isBankEntityType(value: unknown): value is BankEntityType {
  return typeof value === "string" && (BANK_ENTITY_TYPES as readonly string[]).includes(value);
}

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
