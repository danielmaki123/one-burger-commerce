import { describe, expect, it } from "vitest";

import { PosError } from "./pos-errors";
import { resolvePosLocationId } from "./pos-location";

/**
 * TASK-302 — de qué local es la venta del mostrador.
 *
 * La regla de alcance por sucursal es la que ya existe (`resolveOrderLocationScope`, A): el dueño ve
 * todas, y quien tiene sucursales asignadas solo las suyas. Acá solo se traduce a la pregunta del
 * POS ("¿cuál es el local de esta venta?") y se convierte en error de dominio, para que la ruta
 * quede fina y el mensaje sea el mismo en la API y en la pantalla.
 */

describe("local del POS", () => {
  it("sin local pedido no se puede abrir el mostrador", () => {
    expect(() => resolvePosLocationId({ requested: "  ", scope: { kind: "all" } })).toThrow(PosError);
  });

  it("el dueño (o quien no tiene sucursales asignadas) puede usar cualquier local", () => {
    expect(resolvePosLocationId({ requested: "loc_sur", scope: { kind: "all" } })).toBe("loc_sur");
  });

  it("con sucursales asignadas, la propia se acepta", () => {
    expect(
      resolvePosLocationId({ requested: "loc_norte", scope: { kind: "restricted", locationIds: ["loc_norte"] } }),
    ).toBe("loc_norte");
  });

  it("con sucursales asignadas, la ajena se rechaza con 403 y no con 500", () => {
    try {
      resolvePosLocationId({
        requested: "loc_sur",
        scope: { kind: "restricted", locationIds: ["loc_norte"] },
      });
      throw new Error("tendría que haber lanzado");
    } catch (error) {
      expect(error).toBeInstanceOf(PosError);
      expect((error as PosError).status).toBe(403);
      expect((error as PosError).fields?.locationId).toContain("acceso");
    }
  });

  it("recorta el id pedido (una query con espacios no rompe el alcance)", () => {
    expect(
      resolvePosLocationId({ requested: "  loc_norte  ", scope: { kind: "restricted", locationIds: ["loc_norte"] } }),
    ).toBe("loc_norte");
  });
});
