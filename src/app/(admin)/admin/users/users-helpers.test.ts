import { describe, expect, it } from "vitest";

import { describeAssignedLocations, getErrorMessage } from "./users-helpers";

const LOCATIONS = [
  { id: "loc_1", name: "Camino de Oriente" },
  { id: "loc_2", name: "Carretera Masaya" },
];

describe("describeAssignedLocations", () => {
  it("el dueño ve todas las sucursales", () => {
    expect(
      describeAssignedLocations({ role: "owner", locationIds: [] }, LOCATIONS),
    ).toBe("Ve todas las sucursales");
  });

  it("sin sucursales asignadas el backend resuelve que ve todas", () => {
    expect(
      describeAssignedLocations({ role: "kitchen", locationIds: [] }, LOCATIONS),
    ).toBe("Sin asignar · ve todas");
  });

  it("nombra las sucursales asignadas", () => {
    expect(
      describeAssignedLocations({ role: "manager", locationIds: ["loc_1"] }, LOCATIONS),
    ).toBe("Asignado a: Camino de Oriente");
    expect(
      describeAssignedLocations({ role: "manager", locationIds: ["loc_1", "loc_2"] }, LOCATIONS),
    ).toBe("Asignado a: Camino de Oriente, Carretera Masaya");
  });

  it("una asignación huérfana no inventa el nombre", () => {
    expect(
      describeAssignedLocations({ role: "kitchen", locationIds: ["loc_borrada"] }, LOCATIONS),
    ).toBe("Asignado a una sucursal");
  });
});

describe("getErrorMessage", () => {
  it("lee el mensaje del error del backend", () => {
    expect(getErrorMessage({ error: { message: "Ya existe" } }, "fallback")).toBe("Ya existe");
  });

  it("cualquier otra forma cae en el texto por defecto", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback");
    expect(getErrorMessage({ error: "texto" }, "fallback")).toBe("fallback");
    expect(getErrorMessage({ error: { message: 42 } }, "fallback")).toBe("fallback");
  });
});
