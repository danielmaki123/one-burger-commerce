import { describe, expect, it, vi } from "vitest";

import { InMemoryShiftHandoverRepository } from "@/modules/orders/adapters/in-memory-shift-handover-repository";
import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { listShiftHandovers } from "./list-shift-handovers";

/**
 * Tarea 7 del brief (2026-09-17) — **leer los traspasos** de un turno (1.13).
 *
 * Sin caja abierta la respuesta es una lista vacía y no un error: la pantalla de caja pregunta siempre y
 * «todavía no hubo traspasos» es un estado normal, no una falla.
 */

const openShift: ShiftRecord = {
  id: "shift_01",
  locationId: "loc_principal",
  userId: "user_cashier",
  status: "open",
  openedAt: "2026-09-17T14:00:00.000Z",
  closedAt: null,
  openingAmount: 1000,
  closingAmount: null,
  expectedAmount: null,
  difference: null,
  cashCounts: [],
  notes: null,
  createdAt: "2026-09-17T14:00:00.000Z",
  updatedAt: "2026-09-17T14:00:00.000Z",
};

async function seed(handoverRepository: InMemoryShiftHandoverRepository, shiftId: string) {
  await handoverRepository.create({
    shiftId,
    locationId: "loc_principal",
    handedByUserId: "user_cashier",
    handedByName: "María López",
    receivedByName: "Carlos Ruiz",
    expectedAmount: 1500,
    expectedByCurrency: { NIO: 1500 },
  });
}

describe("listShiftHandovers", () => {
  it("devuelve los traspasos del turno abierto del local", async () => {
    const handoverRepository = new InMemoryShiftHandoverRepository();
    await seed(handoverRepository, "shift_01");
    const shiftRepository = {
      findOpenShiftByLocation: vi.fn(async () => openShift),
    } as unknown as ShiftRepository;

    const result = await listShiftHandovers(
      { locationId: "loc_principal" },
      { shiftRepository, handoverRepository },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ receivedByName: "Carlos Ruiz", expectedAmount: 1500 });
  });

  it("lee los de un turno puntual cuando se lo piden por id", async () => {
    const handoverRepository = new InMemoryShiftHandoverRepository();
    await seed(handoverRepository, "shift_01");
    await seed(handoverRepository, "shift_02");
    const shiftRepository = {
      findOpenShiftByLocation: vi.fn(async () => null),
    } as unknown as ShiftRepository;

    const result = await listShiftHandovers(
      { locationId: "loc_principal", shiftId: "shift_02" },
      { shiftRepository, handoverRepository },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.shiftId).toBe("shift_02");
  });

  it("sin caja abierta y sin id no hay nada que listar (y no es un error)", async () => {
    const handoverRepository = new InMemoryShiftHandoverRepository();
    const shiftRepository = {
      findOpenShiftByLocation: vi.fn(async () => null),
    } as unknown as ShiftRepository;

    const result = await listShiftHandovers(
      { locationId: "loc_principal" },
      { shiftRepository, handoverRepository },
    );

    expect(result.data).toEqual([]);
  });
});
