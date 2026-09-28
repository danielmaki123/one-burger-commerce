import { describe, expect, it } from "vitest";

import {
  assertCanOperateKitchen,
  resolveKitchenOrdersQuery,
  type KitchenSession,
} from "./kitchen-orders-composition";

/**
 * La composición de la ruta de Cocina: **capacidad** y **alcance**.
 *
 * Es la parte de la ruta que no es orquestación —quién puede y qué ve—, y por eso se prueba sola: el
 * `route.test.ts` fija la respuesta HTTP, y acá se fijan las dos decisiones que la producen.
 */

function session(role: KitchenSession["user"]["role"], locationIds?: string[] | null): KitchenSession {
  return { user: { role, locationIds } };
}

describe("assertCanOperateKitchen · la capacidad de la superficie", () => {
  it("deja pasar al owner, al manager y al rol de cocina", () => {
    for (const role of ["owner", "manager", "kitchen"] as const) {
      expect(() => assertCanOperateKitchen(session(role)), role).not.toThrow();
    }
  });

  it("**rechaza al cajero**: no opera cocina aunque vea pedidos para cobrarlos", () => {
    expect(() => assertCanOperateKitchen(session("cashier"))).toThrowError(
      expect.objectContaining({ status: 403, code: "FORBIDDEN" }),
    );
  });
});

describe("resolveKitchenOrdersQuery · filtros y alcance", () => {
  it("descarta un filtro con un valor que la API no reconoce, sin llevarse los que sí sirven", () => {
    const { filter } = resolveKitchenOrdersQuery(
      new URLSearchParams("status=no-existe&type=tampoco&search=ana"),
      session("kitchen"),
    );

    // Campo por campo: los dos inválidos se caen y la búsqueda —que era válida— queda.
    expect(filter.status).toBeUndefined();
    expect(filter.type).toBeUndefined();
    expect(filter.search).toBe("ana");
  });

  it("acepta los estados del tablero", () => {
    for (const status of ["new", "confirmed", "accepted", "preparing", "ready", "ready_for_pickup"]) {
      const { filter } = resolveKitchenOrdersQuery(
        new URLSearchParams(`status=${status}`),
        session("kitchen"),
      );

      expect(filter.status, status).toBe(status);
    }
  });

  it("un usuario sin sucursales asignadas ve todas: `locationIds` queda sin filtro", () => {
    const { filter } = resolveKitchenOrdersQuery(new URLSearchParams(), session("kitchen", null));

    expect(filter.locationIds).toBeUndefined();
    expect(filter.scopeLocationIds).toBeNull();
  });

  it("el alcance viaja resuelto y en `meta`, para que la pantalla no lo reimplemente", () => {
    const { filter } = resolveKitchenOrdersQuery(
      new URLSearchParams(),
      session("manager", ["loc_centro", "loc_norte"]),
    );

    expect(filter.locationIds).toEqual(["loc_centro", "loc_norte"]);
    expect(filter.scopeLocationIds).toEqual(["loc_centro", "loc_norte"]);
  });

  it("una sucursal **fuera del alcance** no la muestra el filtro", () => {
    const { filter } = resolveKitchenOrdersQuery(
      new URLSearchParams("locationId=loc_ajena"),
      session("manager", ["loc_centro"]),
    );

    // No es un error: se ignora y se devuelve el alcance completo (la regla de `order-visibility`).
    expect(filter.locationIds).toEqual(["loc_centro"]);
  });

  it("dentro del alcance, la sucursal pedida sí filtra", () => {
    const { filter } = resolveKitchenOrdersQuery(
      new URLSearchParams("locationId=loc_norte"),
      session("manager", ["loc_centro", "loc_norte"]),
    );

    expect(filter.locationIds).toEqual(["loc_norte"]);
  });

  it("el owner ve todas: su asignación se ignora y la pedida es la que filtra", () => {
    const { filter } = resolveKitchenOrdersQuery(
      new URLSearchParams("locationId=loc_sur"),
      session("owner", ["loc_centro"]),
    );

    expect(filter.locationIds).toEqual(["loc_sur"]);
    expect(filter.scopeLocationIds).toBeNull();
  });
});
