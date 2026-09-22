import { describe, expect, it } from "vitest";

import {
  mergeBankCatalog,
  normalizeBankCode,
  validateBankCatalog,
  type BankCatalogEntry,
} from "./bank-catalog";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el catálogo de bancos del negocio.
 *
 * El catálogo es del negocio (los bancos son los mismos en las tres sucursales) y la **asignación** es por
 * sucursal: es lo que decide qué bloques dibuja el cierre de cada local.
 */

function entry(overrides: Partial<BankCatalogEntry> = {}): BankCatalogEntry {
  return {
    id: "bank_bac",
    name: "BAC Credomatic",
    code: "BAC",
    isActive: true,
    sortOrder: 0,
    locationIds: ["loc_principal"],
    ...overrides,
  };
}

describe("validateBankCatalog", () => {
  it("acepta un catálogo bien formado", () => {
    expect(validateBankCatalog([entry()])).toEqual({});
  });

  it("el nombre es obligatorio: un banco sin nombre no se puede elegir en el cierre", () => {
    const fields = validateBankCatalog([entry({ name: "   " })]);

    expect(fields["banks.0.name"]).toBe("Escribí el nombre del banco.");
  });

  it("no acepta dos bancos con el mismo nombre (el índice único lo rechazaría con un error de servidor)", () => {
    const fields = validateBankCatalog([entry(), entry({ id: "bank_otro" })]);

    expect(fields["banks.1.name"]).toBe("Ya hay un banco con ese nombre.");
  });

  it("tampoco dos con el mismo código corto, aunque el nombre cambie", () => {
    const fields = validateBankCatalog([
      entry(),
      entry({ id: "bank_otro", name: "Otro banco", code: "bac" }),
    ]);

    expect(fields["banks.1.code"]).toBe("Ya hay un banco con ese código.");
  });

  it("el código es opcional: sin él el cierre imprime el nombre largo", () => {
    expect(validateBankCatalog([entry({ code: null })])).toEqual({});
  });

  it("acota los textos", () => {
    const fields = validateBankCatalog([
      entry({ name: "N".repeat(61), code: "C".repeat(13) }),
    ]);

    expect(fields["banks.0.name"]).toBe("Máximo 60 caracteres.");
    expect(fields["banks.0.code"]).toBe("Máximo 12 caracteres.");
  });
});

describe("normalizeBankCode", () => {
  it("el código se guarda en mayúsculas y sin espacios de sobra", () => {
    expect(normalizeBankCode("  bac ")).toBe("BAC");
  });

  it("vacío es `null`, no una cadena vacía (el índice único no admite dos «»)", () => {
    expect(normalizeBankCode("   ")).toBeNull();
  });
});

describe("mergeBankCatalog", () => {
  it("junta los bancos con las sucursales donde están activos", () => {
    const entries = mergeBankCatalog(
      [
        { id: "bank_bac", name: "BAC Credomatic", code: "BAC", isActive: true, sortOrder: 0 },
        { id: "bank_banpro", name: "Banpro", code: null, isActive: true, sortOrder: 1 },
      ],
      [
        { locationId: "loc_principal", bankId: "bank_bac", isActive: true, sortOrder: 0 },
        { locationId: "loc_masaya", bankId: "bank_bac", isActive: true, sortOrder: 0 },
        { locationId: "loc_principal", bankId: "bank_banpro", isActive: false, sortOrder: 1 },
      ],
    );

    expect(entries).toEqual([
      { ...entry({ locationIds: ["loc_principal", "loc_masaya"] }) },
      {
        id: "bank_banpro",
        name: "Banpro",
        code: null,
        isActive: true,
        sortOrder: 1,
        locationIds: [],
      },
    ]);
  });

  it("una asignación apagada no cuenta como sucursal del banco", () => {
    const entries = mergeBankCatalog(
      [{ id: "bank_bac", name: "BAC", code: "BAC", isActive: true, sortOrder: 0 }],
      [{ locationId: "loc_principal", bankId: "bank_bac", isActive: false, sortOrder: 0 }],
    );

    expect(entries[0]?.locationIds).toEqual([]);
  });

  it("un banco apagado no muestra sucursales aunque sus asignaciones sigan vivas", () => {
    // Apagar un banco es sacarlo del cierre: si la pantalla lo mostrara asignado a una sucursal, diría que
    // liquida ahí cuando el cierre ya no lo ofrece.
    const entries = mergeBankCatalog(
      [{ id: "bank_bac", name: "BAC", code: "BAC", isActive: false, sortOrder: 0 }],
      [{ locationId: "loc_principal", bankId: "bank_bac", isActive: true, sortOrder: 0 }],
    );

    expect(entries[0]?.locationIds).toEqual([]);
  });
});
