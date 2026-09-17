import { describe, expect, it } from "vitest";

import { PosError } from "@/modules/pos/domain/pos-errors";

import { parseReconciliationDate } from "./reconciliation-payload";

/**
 * Tarea 10 del brief (2026-09-17) — la fecha del export de **conciliación**.
 *
 * Sin fecha se usa el día del negocio; con una fecha inválida se rechaza con un 422 y no se deja el rango
 * abierto: un rango abierto exportaría el historial completo, que no es lo que nadie pidió.
 */

describe("parseReconciliationDate", () => {
  it("sin fecha no inventa nada: la ruta usa el día del negocio", () => {
    expect(parseReconciliationDate(null)).toBeNull();
    expect(parseReconciliationDate("   ")).toBeNull();
  });

  it("acepta el día natural del negocio", () => {
    expect(parseReconciliationDate(" 2026-09-17 ")).toBe("2026-09-17");
  });

  it("rechaza lo que no es una fecha del día del negocio", () => {
    for (const value of ["17/09/2026", "ayer", "2026-09-17T10:00:00Z"]) {
      expect(() => parseReconciliationDate(value)).toThrow(PosError);
    }

    // El detalle del campo dice qué se esperaba: el error de arriba es el titular de la pantalla.
    try {
      parseReconciliationDate("ayer");
      expect.unreachable("tenía que rechazar la fecha");
    } catch (error) {
      expect((error as PosError).fields?.date).toMatch(/YYYY-MM-DD/);
    }
  });
});
