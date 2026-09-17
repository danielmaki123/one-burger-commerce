import { describe, expect, it } from "vitest";

import { ShiftError } from "@/modules/orders/domain/shift-errors";

import { assertShiftInScope, parseReopenShiftPayload } from "./reopen-payload";

/**
 * Bloque 1.10 del roadmap del POS (Fase 2) — las guardas de la reapertura.
 *
 * Reabrir una caja ya cerrada es la operación más sensible del arqueo: el motivo es obligatorio (una
 * reapertura sin razón escrita no se audita) y el turno tiene que ser de una sucursal del alcance de
 * quien reabre.
 */
describe("reopen payload", () => {
  it("acepta un motivo con texto y lo recorta", () => {
    expect(parseReopenShiftPayload({ reason: "  Conté mal los billetes.  " })).toEqual({
      reason: "Conté mal los billetes.",
    });
  });

  it.each([
    [{}, "sin motivo"],
    [{ reason: "" }, "vacío"],
    [{ reason: "   " }, "solo espacios"],
    [{ reason: "x".repeat(301) }, "demasiado largo"],
  ])("rechaza el payload %j (%s) con 422", (body: unknown, _motivo: string) => {
    expect(() => parseReopenShiftPayload(body)).toThrow(ShiftError);
  });

  it("rechaza un cuerpo que no es un objeto con 422", () => {
    expect(() => parseReopenShiftPayload("no-es-un-objeto")).toThrow(ShiftError);
  });

  it("un turno fuera del alcance no existe: 404, no 403", () => {
    const locations = ["loc_principal"];

    expect(() => assertShiftInScope({ locationId: "loc_principal" }, locations)).not.toThrow();
    // Confirmar con un 403 que el id existe ya sería decir de más.
    expect(() => assertShiftInScope({ locationId: "loc_ajena" }, locations)).toThrow(ShiftError);
    expect(() => assertShiftInScope(null, locations)).toThrow(ShiftError);
  });
});
