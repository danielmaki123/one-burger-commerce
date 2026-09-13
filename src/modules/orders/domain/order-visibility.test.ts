import { describe, expect, it } from "vitest";

import {
  canAccessOrderLocation,
  resolveOrderListLocationIds,
  resolveOrderLocationScope,
} from "./order-visibility";

/**
 * TASK-staff-location-scope (A) — quién ve los pedidos de qué sucursal.
 *
 * La regla que acordó el owner: **varias sucursales por usuario**, y **sin asignar = ve todas**
 * (el día del deploy nadie queda ciego: hoy no hay ninguna asignación cargada). El dueño ve todo
 * y su asignación se ignora.
 */
describe("resolveOrderLocationScope", () => {
  it("el dueño ve todas las sucursales, tenga o no asignaciones", () => {
    expect(resolveOrderLocationScope({ role: "owner", assignedLocationIds: [] })).toEqual({
      kind: "all",
    });
    expect(
      resolveOrderLocationScope({ role: "owner", assignedLocationIds: ["loc_norte"] }),
    ).toEqual({ kind: "all" });
  });

  it("un gerente o cocina sin asignar ve todas (no se rompe la operación actual)", () => {
    expect(resolveOrderLocationScope({ role: "manager", assignedLocationIds: [] })).toEqual({
      kind: "all",
    });
    expect(resolveOrderLocationScope({ role: "kitchen", assignedLocationIds: null })).toEqual({
      kind: "all",
    });
    expect(resolveOrderLocationScope({ role: "kitchen" })).toEqual({ kind: "all" });
  });

  it("un gerente o cocina con sucursales asignadas ve solo esas", () => {
    expect(
      resolveOrderLocationScope({ role: "manager", assignedLocationIds: ["loc_norte"] }),
    ).toEqual({ kind: "restricted", locationIds: ["loc_norte"] });

    expect(
      resolveOrderLocationScope({ role: "kitchen", assignedLocationIds: ["loc_sur", "loc_norte"] }),
    ).toEqual({ kind: "restricted", locationIds: ["loc_sur", "loc_norte"] });
  });

  it("ignora identificadores vacíos y repetidos", () => {
    expect(
      resolveOrderLocationScope({
        role: "manager",
        assignedLocationIds: ["loc_norte", "loc_norte", "", "   ", "loc_sur"],
      }),
    ).toEqual({ kind: "restricted", locationIds: ["loc_norte", "loc_sur"] });
  });

  it("una asignación a un local borrado no rompe: el alcance sigue siendo ese id", () => {
    // La existencia del local la valida la capa de composición; el dominio no consulta la base.
    expect(
      resolveOrderLocationScope({ role: "kitchen", assignedLocationIds: ["loc_borrado"] }),
    ).toEqual({ kind: "restricted", locationIds: ["loc_borrado"] });
  });
});

describe("resolveOrderListLocationIds", () => {
  it("sin pedido de filtro, el alcance manda", () => {
    expect(
      resolveOrderListLocationIds({
        scope: resolveOrderLocationScope({ role: "manager", assignedLocationIds: ["loc_norte"] }),
      }),
    ).toEqual(["loc_norte"]);

    // Sin restricción no se filtra nada: `undefined` = todas.
    expect(
      resolveOrderListLocationIds({ scope: resolveOrderLocationScope({ role: "owner" }) }),
    ).toBeUndefined();
  });

  it("con el dueño, el filtro pedido se honra tal cual", () => {
    expect(
      resolveOrderListLocationIds({
        scope: resolveOrderLocationScope({ role: "owner" }),
        requestedLocationId: "loc_sur",
      }),
    ).toEqual(["loc_sur"]);
  });

  it("un usuario acotado puede pedir una de sus sucursales", () => {
    const scope = resolveOrderLocationScope({
      role: "manager",
      assignedLocationIds: ["loc_norte", "loc_sur"],
    });

    expect(resolveOrderListLocationIds({ scope, requestedLocationId: "loc_sur" })).toEqual([
      "loc_sur",
    ]);
  });

  it("una sucursal pedida fuera del alcance se ignora, no se honra ni rompe", () => {
    // Es lo importante de seguridad: pedir por query una sucursal ajena nunca la muestra.
    const scope = resolveOrderLocationScope({
      role: "kitchen",
      assignedLocationIds: ["loc_norte"],
    });

    expect(resolveOrderListLocationIds({ scope, requestedLocationId: "loc_sur" })).toEqual([
      "loc_norte",
    ]);
  });

  it("un filtro vacío o en blanco se trata como 'sin filtro'", () => {
    const scope = resolveOrderLocationScope({ role: "owner" });

    expect(resolveOrderListLocationIds({ scope, requestedLocationId: "" })).toBeUndefined();
    expect(resolveOrderListLocationIds({ scope, requestedLocationId: "   " })).toBeUndefined();
    expect(resolveOrderListLocationIds({ scope, requestedLocationId: null })).toBeUndefined();
  });
});

describe("canAccessOrderLocation", () => {
  it("el dueño y el usuario sin asignar pueden ver cualquier sucursal", () => {
    const owner = resolveOrderLocationScope({ role: "owner" });
    const unassigned = resolveOrderLocationScope({ role: "kitchen", assignedLocationIds: [] });

    expect(canAccessOrderLocation(owner, "loc_sur")).toBe(true);
    expect(canAccessOrderLocation(unassigned, "loc_sur")).toBe(true);
  });

  it("el usuario acotado solo puede ver las suyas", () => {
    const scope = resolveOrderLocationScope({
      role: "manager",
      assignedLocationIds: ["loc_norte", "loc_casa"],
    });

    expect(canAccessOrderLocation(scope, "loc_norte")).toBe(true);
    expect(canAccessOrderLocation(scope, "loc_casa")).toBe(true);
    expect(canAccessOrderLocation(scope, "loc_sur")).toBe(false);
  });
});
