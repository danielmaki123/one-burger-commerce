import { describe, expect, it } from "vitest";

import { InMemoryShiftRepository } from "./in-memory-shift-repository";

/**
 * TASK-104 — reglas del turno de caja.
 *
 * Lo que se fija acá: una sola caja abierta por local a la vez, el historial de cerrados no estorba,
 * el cierre no se puede pisar dos veces y el cierre ciego deja la diferencia sin calcular.
 *
 * La barrera real contra dos turnos abiertos está en la base (índice único parcial); este doble la
 * reproduce para que las dos implementaciones del puerto tengan la misma regla.
 */
function openInput(overrides: Partial<Parameters<InMemoryShiftRepository["openShift"]>[0]> = {}) {
  return {
    locationId: "loc_principal",
    userId: "user_01",
    openingAmount: 500,
    ...overrides,
  };
}

describe("InMemoryShiftRepository", () => {
  it("abre un turno con su fondo y queda como el turno abierto del local", async () => {
    const repository = new InMemoryShiftRepository();

    const shift = await repository.openShift(openInput());

    expect(shift.status).toBe("open");
    expect(shift.openingAmount).toBe(500);
    expect(shift.closedAt).toBeNull();
    expect(shift.closingAmount).toBeNull();
    expect(shift.difference).toBeNull();
    expect(await repository.findOpenShiftByLocation("loc_principal")).toEqual(shift);
  });

  it("sin fondo el fondo es 0", async () => {
    const repository = new InMemoryShiftRepository();

    const shift = await repository.openShift({ locationId: "loc_principal", userId: "user_01" });

    expect(shift.openingAmount).toBe(0);
  });

  it("no deja abrir un segundo turno en el mismo local", async () => {
    const repository = new InMemoryShiftRepository();

    await repository.openShift(openInput());

    await expect(repository.openShift(openInput())).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
    expect(repository.shifts).toHaveLength(1);
  });

  it("sí deja abrir un turno en otro local", async () => {
    const repository = new InMemoryShiftRepository();

    await repository.openShift(openInput({ locationId: "loc_principal" }));
    const other = await repository.openShift(openInput({ locationId: "loc_norte" }));

    expect(other.locationId).toBe("loc_norte");
    expect(repository.shifts).toHaveLength(2);
  });

  it("el historial de turnos cerrados del mismo local no impide abrir uno nuevo", async () => {
    const repository = new InMemoryShiftRepository();

    const first = await repository.openShift(openInput());
    await repository.closeShift(first.id, { closingAmount: 500, expectedAmount: 500 });
    const second = await repository.openShift(openInput());

    expect(second.status).toBe("open");
    expect(repository.shifts).toHaveLength(2);
  });

  it("cierra el turno con el conteo, el esperado y la diferencia", async () => {
    const repository = new InMemoryShiftRepository();
    const shift = await repository.openShift(openInput());

    const closed = await repository.closeShift(shift.id, {
      closingAmount: 480,
      expectedAmount: 500,
      notes: "Faltó plata en el fondo",
    });

    expect(closed?.status).toBe("closed");
    expect(closed?.closingAmount).toBe(480);
    expect(closed?.expectedAmount).toBe(500);
    expect(closed?.difference).toBe(-20);
    expect(closed?.closedAt).toBeTruthy();
    expect(await repository.findOpenShiftByLocation("loc_principal")).toBeNull();
  });

  it("cierre ciego: sin conteo, la diferencia queda sin calcular", async () => {
    const repository = new InMemoryShiftRepository();
    const shift = await repository.openShift(openInput());

    const closed = await repository.closeShift(shift.id, {
      closingAmount: null,
      expectedAmount: 500,
    });

    expect(closed?.status).toBe("closed");
    expect(closed?.closingAmount).toBeNull();
    expect(closed?.expectedAmount).toBe(500);
    expect(closed?.difference).toBeNull();
  });

  it("cerrar dos veces no pisa el arqueo del primero", async () => {
    const repository = new InMemoryShiftRepository();
    const shift = await repository.openShift(openInput());

    const first = await repository.closeShift(shift.id, {
      closingAmount: 480,
      expectedAmount: 500,
    });
    const second = await repository.closeShift(shift.id, {
      closingAmount: 999,
      expectedAmount: 999,
    });

    expect(first?.difference).toBe(-20);
    expect(second).toBeNull();
    expect((await repository.findShiftById(shift.id))?.closingAmount).toBe(480);
  });

  it("cerrar un turno que no existe devuelve null", async () => {
    const repository = new InMemoryShiftRepository();

    expect(
      await repository.closeShift("no-existe", { closingAmount: 1, expectedAmount: 1 }),
    ).toBeNull();
  });

  it("lista los turnos del local, del más nuevo al más viejo", async () => {
    const repository = new InMemoryShiftRepository();

    repository.shifts.push(
      {
        id: "shift_1",
        locationId: "loc_principal",
        userId: "user_01",
        status: "closed",
        openedAt: "2026-09-14T08:00:00.000Z",
        closedAt: "2026-09-14T16:00:00.000Z",
        openingAmount: 500,
        closingAmount: 500,
        expectedAmount: 500,
        difference: 0,
        notes: null,
        createdAt: "2026-09-14T08:00:00.000Z",
        updatedAt: "2026-09-14T16:00:00.000Z",
      },
      {
        id: "shift_2",
        locationId: "loc_principal",
        userId: "user_01",
        status: "open",
        openedAt: "2026-09-14T16:00:00.000Z",
        closedAt: null,
        openingAmount: 500,
        closingAmount: null,
        expectedAmount: null,
        difference: null,
        notes: null,
        createdAt: "2026-09-14T16:00:00.000Z",
        updatedAt: "2026-09-14T16:00:00.000Z",
      },
      {
        id: "shift_3",
        locationId: "loc_norte",
        userId: "user_01",
        status: "open",
        openedAt: "2026-09-14T17:00:00.000Z",
        closedAt: null,
        openingAmount: 0,
        closingAmount: null,
        expectedAmount: null,
        difference: null,
        notes: null,
        createdAt: "2026-09-14T17:00:00.000Z",
        updatedAt: "2026-09-14T17:00:00.000Z",
      },
    );

    const shifts = await repository.listShifts("loc_principal");

    expect(shifts.map((s) => s.id)).toEqual(["shift_2", "shift_1"]);
  });
});
