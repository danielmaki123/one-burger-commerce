import { describe, expect, it } from "vitest";

import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import type {
  CloseShiftInput,
  OpenShiftInput,
  ShiftRepository,
} from "@/modules/orders/ports/shift-repository";

import { listLocationShifts } from "./list-location-shifts";

function shift(overrides: Partial<ShiftRecord> & { id: string }): ShiftRecord {
  return {
    locationId: "loc_principal",
    userId: "user_1",
    status: "closed",
    openedAt: "2026-09-17T14:00:00.000Z",
    closedAt: "2026-09-17T22:00:00.000Z",
    openingAmount: 500,
    closingAmount: 1500,
    expectedAmount: 1500,
    difference: 0,
    cashCounts: [],
    notes: null,
    createdAt: "2026-09-17T14:00:00.000Z",
    updatedAt: "2026-09-17T22:00:00.000Z",
    ...overrides,
  };
}

type Double = ShiftRepository & { calls: string[] };

function makeRepository(shifts: ShiftRecord[]): Double {
  const calls: string[] = [];
  return {
    calls,
    async openShift(_input: OpenShiftInput) {
      calls.push("open");
      throw new Error("no usado en este test");
    },
    async findOpenShiftByLocation(locationId: string) {
      calls.push(`findOpen:${locationId}`);
      return shifts.find((item) => item.locationId === locationId && item.status === "open") ?? null;
    },
    async findShiftById(id: string) {
      calls.push(`findById:${id}`);
      return shifts.find((item) => item.id === id) ?? null;
    },
    async closeShift(id: string, _input: CloseShiftInput) {
      calls.push(`close:${id}`);
      throw new Error("no usado en este test");
    },
    async listShifts(locationId: string) {
      calls.push(`list:${locationId}`);
      return shifts
        .filter((item) => item.locationId === locationId)
        .sort((a, b) => b.openedAt.localeCompare(a.openedAt));
    },
    async reopenShift() {
      calls.push("reopen");
      throw new Error("no usado en este test");
    },
  };
}

describe("listLocationShifts", () => {
  /**
   * Bloque 1.3/1.4 del roadmap del POS (Fase 2) — el historial de cierres que hoy no existe.
   *
   * El puerto `listShifts` ya existía y **no lo usaba ninguna API ni pantalla** (A-16 del backlog de
   * UI): al cerrar, el arqueo se veía una vez y desaparecía al recargar. Esta lectura es la que le da
   * superficie, sin inventar datos: lo que se guardó al cerrar se lee como se guardó (`expectedAmount`
   * congelado, no recalculado con la tasa de hoy).
   */
  it("devuelve los turnos del local del más nuevo al más viejo y cuenta los abiertos", async () => {
    const repository = makeRepository([
      shift({ id: "shift_viejo", openedAt: "2026-09-15T14:00:00.000Z" }),
      shift({ id: "shift_abierto", status: "open", closedAt: null, closingAmount: null, expectedAmount: null, difference: null, openedAt: "2026-09-18T14:00:00.000Z" }),
      shift({ id: "shift_nuevo", openedAt: "2026-09-17T14:00:00.000Z" }),
      shift({ id: "shift_otro_local", locationId: "loc_masaya" }),
    ]);

    const result = await listLocationShifts(
      { locationId: "loc_principal" },
      { shiftRepository: repository },
    );

    expect(result.data.map((item) => item.id)).toEqual([
      "shift_abierto",
      "shift_nuevo",
      "shift_viejo",
    ]);
    expect(result.meta).toEqual({
      locationId: "loc_principal",
      total: 3,
      openCount: 1,
      closedCount: 2,
    });
    expect(repository.calls).toEqual(["list:loc_principal"]);
  });

  it("corta sin local: la pantalla no puede pedir «los turnos de ningún lado»", async () => {
    const repository = makeRepository([]);

    await expect(
      listLocationShifts({ locationId: "   " }, { shiftRepository: repository }),
    ).rejects.toMatchObject({ status: 422 });
    expect(repository.calls).toEqual([]);
  });

  it("un local sin turnos devuelve una lista vacía, no un error", async () => {
    const repository = makeRepository([]);

    const result = await listLocationShifts(
      { locationId: "loc_principal" },
      { shiftRepository: repository },
    );

    expect(result.data).toEqual([]);
    expect(result.meta.closedCount).toBe(0);
  });
});
