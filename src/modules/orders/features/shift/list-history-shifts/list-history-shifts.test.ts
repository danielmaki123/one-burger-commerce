import { describe, expect, it, vi } from "vitest";

import type { ShiftRecord } from "@/modules/orders/domain/order.types";

import { listHistoryShifts } from "./list-history-shifts";

/**
 * Punto 2 del roadmap (2026-09-18) — los cierres del Historial, cruzando las sucursales del alcance.
 *
 * La pantalla es de consulta: acá solo se arma la lista que se ve. Cuatro reglas que importan: **solo
 * turnos cerrados** (un turno abierto no es un cierre), del más nuevo al más viejo, con los filtros de
 * la barra (fecha, cajero, solo descuadre) y con el **nombre del cajero** resuelto una sola vez por
 * persona aunque tenga varios turnos en la lista.
 */

function shift(overrides: Partial<ShiftRecord> = {}): ShiftRecord {
  return {
    id: "shift_01",
    locationId: "loc_norte",
    userId: "user_ana",
    status: "closed",
    openedAt: "2026-09-17T14:00:00.000Z",
    closedAt: "2026-09-17T22:00:00.000Z",
    openingAmount: 500,
    closingAmount: 1500,
    expectedAmount: 1500,
    difference: 0,
    notes: null,
    createdAt: "2026-09-17T14:00:00.000Z",
    updatedAt: "2026-09-17T22:00:00.000Z",
    ...overrides,
  };
}

function deps(shifts: Record<string, ShiftRecord[]>, users: Record<string, string> = {}) {
  const listShifts = vi.fn(async (locationId: string) => shifts[locationId] ?? []);
  const findUserById = vi.fn(async (id: string) =>
    users[id] ? { id, name: users[id] } : null,
  );

  return {
    shiftRepository: { listShifts },
    userRepository: { findUserById },
    listShifts,
    findUserById,
  };
}

const LOCATIONS = [
  { id: "loc_norte", name: "Norte" },
  { id: "loc_sur", name: "Sur" },
];

describe("listHistoryShifts", () => {
  it("junta las sucursales del alcance y solo muestra turnos cerrados", async () => {
    const d = deps({
      loc_norte: [shift(), shift({ id: "shift_open", status: "open", closedAt: null })],
      loc_sur: [],
    });

    const result = await listHistoryShifts({ locations: LOCATIONS }, d);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("shift_01");
    expect(result[0].locationName).toBe("Norte");
  });

  it("ordena del cierre más nuevo al más viejo", async () => {
    const d = deps({
      loc_norte: [
        shift({ id: "shift_viejo", closedAt: "2026-09-15T22:00:00.000Z" }),
        shift({ id: "shift_nuevo", closedAt: "2026-09-18T22:00:00.000Z" }),
      ],
      loc_sur: [],
    });

    const result = await listHistoryShifts({ locations: LOCATIONS }, d);

    expect(result.map((row) => row.id)).toEqual(["shift_nuevo", "shift_viejo"]);
  });

  it("acota por fecha de cierre", async () => {
    const d = deps({
      loc_norte: [
        shift({ id: "shift_14", closedAt: "2026-09-14T22:00:00.000Z" }),
        shift({ id: "shift_17", closedAt: "2026-09-17T22:00:00.000Z" }),
      ],
      loc_sur: [],
    });

    const result = await listHistoryShifts(
      { locations: LOCATIONS, closedFrom: "2026-09-17T00:00:00.000Z" },
      d,
    );

    expect(result.map((row) => row.id)).toEqual(["shift_17"]);
  });

  it("filtra por cajero", async () => {
    const d = deps({
      loc_norte: [
        shift({ id: "shift_ana", userId: "user_ana" }),
        shift({ id: "shift_luis", userId: "user_luis" }),
      ],
      loc_sur: [],
    });

    const result = await listHistoryShifts(
      { locations: LOCATIONS, cashierUserId: "user_luis" },
      d,
    );

    expect(result.map((row) => row.id)).toEqual(["shift_luis"]);
  });

  it("«solo descuadre» deja únicamente los cierres con diferencia", async () => {
    const d = deps({
      loc_norte: [
        shift({ id: "shift_ok", difference: 0 }),
        shift({ id: "shift_falta", difference: -50 }),
        shift({ id: "shift_sobra", difference: 25 }),
      ],
      loc_sur: [],
    });

    const result = await listHistoryShifts({ locations: LOCATIONS, onlyDifference: true }, d);

    expect(result.map((row) => row.id).sort()).toEqual(["shift_falta", "shift_sobra"]);
    expect(result[0].difference).not.toBe(0);
  });

  it("resuelve el nombre del cajero una sola vez por persona", async () => {
    const d = deps(
      {
        loc_norte: [
          shift({ id: "shift_1", closedAt: "2026-09-17T22:00:00.000Z" }),
          shift({ id: "shift_2", closedAt: "2026-09-16T22:00:00.000Z" }),
        ],
        loc_sur: [],
      },
      { user_ana: "Ana Pérez" },
    );

    const result = await listHistoryShifts({ locations: LOCATIONS }, d);

    expect(result.every((row) => row.cashierName === "Ana Pérez")).toBe(true);
    expect(d.findUserById).toHaveBeenCalledTimes(1);
  });

  it("sin usuario (borrado), el nombre queda vacío en vez de romper la lista", async () => {
    const d = deps({ loc_norte: [shift()], loc_sur: [] });

    const result = await listHistoryShifts({ locations: LOCATIONS }, d);

    expect(result[0].cashierName).toBeNull();
  });
});
