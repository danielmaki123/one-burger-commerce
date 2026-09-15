import { describe, expect, it } from "vitest";

import { createInMemoryLocation } from "@/modules/locations/adapters/in-memory-location-repository";

import { pickPosLocations } from "./pos-locations";

/**
 * TASK-308 — qué locales ofrece el mostrador.
 *
 * Dos condiciones y el alcance que ya existe: el local tiene que estar **encendido** (si no, el POS
 * no opera ahí) y tener el **punto de venta prendido**. Un cajero con sucursales asignadas sigue
 * viendo solo las suyas: prender el POS en otro local no se lo habilita.
 */
describe("pickPosLocations", () => {
  const norte = createInMemoryLocation({ id: "loc_norte", name: "Norte" });
  const sur = createInMemoryLocation({ id: "loc_sur", name: "Sur", posEnabled: false });
  const bodega = createInMemoryLocation({ id: "loc_bodega", name: "Bodega", isActive: false });
  const locations = [norte, sur, bodega];

  it("deja solo los locales encendidos y con el POS prendido", () => {
    expect(pickPosLocations(locations, { kind: "all" }).map((item) => item.id)).toEqual([
      "loc_norte",
    ]);
  });

  it("respeta el alcance por sucursal del staff", () => {
    expect(
      pickPosLocations([norte, createInMemoryLocation({ id: "loc_este", name: "Este" })], {
        kind: "restricted",
        locationIds: ["loc_este"],
      }).map((item) => item.id),
    ).toEqual(["loc_este"]);
  });

  it("sin ningún local disponible no hay mostrador", () => {
    expect(pickPosLocations([sur, bodega], { kind: "all" })).toEqual([]);
  });
});
