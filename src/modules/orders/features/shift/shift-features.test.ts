import { describe, expect, it } from "vitest";

import {
  createInMemoryLocation,
  InMemoryLocationRepository,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";
import { InMemoryShiftRepository } from "@/modules/orders/adapters/in-memory-shift-repository";

import { closeShift } from "./close-shift";
import { getCurrentShift } from "./get-current-shift";
import { openShift } from "./open-shift";

/**
 * TASK-104 — los tres casos de uso del turno.
 *
 * `closeShift` es el que importa: el esperado sale de los **cobros** del pedido dentro de la ventana
 * del turno, no de un número que mande el cliente. Si el mostrador pudiera declarar su propio
 * esperado, el arqueo no serviría para nada.
 */
function buildDeps() {
  const shiftRepository = new InMemoryShiftRepository();
  const paymentRepository = new InMemoryPaymentRepository();
  const locationRepository = new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
  ]);

  return { shiftRepository, paymentRepository, locationRepository };
}

/**
 * Un cobro dentro de la ventana del turno.
 *
 * El turno se abre y se cierra en el mismo milisegundo (los dos son "ahora" en el test), así que
 * para que la ventana contenga al cobro se retrocede `openedAt` un minuto: es lo que hace un turno
 * real, que dura horas.
 */
function seedPayment(
  paymentRepository: InMemoryPaymentRepository,
  amount: number,
  tip: number,
  createdAt: string,
) {
  const orderId = `ord_${paymentRepository.payments.length + 1}`;
  paymentRepository.seedOrderLocation(orderId, "loc_principal");
  paymentRepository.payments.push({
    id: `pay_${paymentRepository.payments.length + 1}`,
    orderId,
    method: "cash",
    amount,
    currency: null,
    tip,
    reference: null,
    createdAt,
  });
}

/** Retrocede la apertura del turno para que los cobros "de ahora" caigan dentro de la ventana. */
/**
 * Abre el turno en el pasado y devuelve su `openedAt` en milisegundos.
 *
 * Los cobros se siembran **relativos a este instante**, no a `Date.now()`: el turno se abre y se
 * cierra dentro del mismo test, así que la ventana es de milisegundos y cualquier offset calculado
 * contra el reloj de pared puede caer del lado equivocado.
 */
function backdateOpen(shiftId: string, minutes: number, shiftRepository: InMemoryShiftRepository) {
  const shift = shiftRepository.shifts.find((s) => s.id === shiftId);
  if (!shift) throw new Error("shift not found");
  const openedAtMs = Date.parse(shift.openedAt) - minutes * 60_000;
  shift.openedAt = new Date(openedAtMs).toISOString();

  return openedAtMs;
}

describe("openShift", () => {
  it("abre la caja del local con su fondo", async () => {
    const deps = buildDeps();

    const result = await openShift(
      { locationId: "loc_principal", userId: "user_01", openingAmount: 500 },
      deps,
    );

    expect(result.data.status).toBe("open");
    expect(result.data.openingAmount).toBe(500);
    expect(result.data.userId).toBe("user_01");
  });

  it("rechaza abrir una segunda caja en el mismo local", async () => {
    const deps = buildDeps();
    await openShift({ locationId: "loc_principal", userId: "user_01" }, deps);

    await expect(
      openShift({ locationId: "loc_principal", userId: "user_02" }, deps),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("rechaza un local que no existe", async () => {
    const deps = buildDeps();

    await expect(
      openShift({ locationId: "loc_fantasma", userId: "user_01" }, deps),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("rechaza un fondo negativo", async () => {
    const deps = buildDeps();

    await expect(
      openShift({ locationId: "loc_principal", userId: "user_01", openingAmount: -1 }, deps),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });
});

describe("getCurrentShift", () => {
  it("devuelve el turno abierto del local", async () => {
    const deps = buildDeps();
    const opened = await openShift({ locationId: "loc_principal", userId: "user_01" }, deps);

    const result = await getCurrentShift({ locationId: "loc_principal" }, deps);

    expect(result.data?.id).toBe(opened.data.id);
  });

  it("sin caja abierta devuelve null", async () => {
    const deps = buildDeps();

    const result = await getCurrentShift({ locationId: "loc_principal" }, deps);

    expect(result.data).toBeNull();
  });
});

describe("closeShift", () => {
  it("calcula el esperado con los cobros del turno y la diferencia con el conteo", async () => {
    const deps = buildDeps();
    const opened = await openShift(
      { locationId: "loc_principal", userId: "user_01", openingAmount: 500 },
      deps,
    );
    const openedAtMs = backdateOpen(opened.data.id, 60, deps.shiftRepository);
    // Cobros dentro de la ventana del turno (después de la apertura, antes del cierre).
    seedPayment(deps.paymentRepository, 100, 10, new Date(openedAtMs + 10_000).toISOString());
    seedPayment(deps.paymentRepository, 50, 5, new Date(openedAtMs + 20_000).toISOString());

    const result = await closeShift(
      { shiftId: opened.data.id, closingAmount: 640 },
      deps,
    );

    // Esperado = fondo 500 + cobros 150 + propina 15 = 665. Diferencia = 640 - 665 = -25.
    expect(result.data?.expectedAmount).toBe(665);
    expect(result.data?.closingAmount).toBe(640);
    expect(result.data?.difference).toBe(-25);
    expect(result.data?.status).toBe("closed");
  });

  it("ignora los cobros de antes del turno", async () => {
    const deps = buildDeps();
    const opened = await openShift({ locationId: "loc_principal", userId: "user_01" }, deps);
    const openedAtMs = backdateOpen(opened.data.id, 60, deps.shiftRepository);
    // Un cobro anterior al turno: no entra en el arqueo de esta caja.
    seedPayment(deps.paymentRepository, 999, 0, new Date(openedAtMs - 60_000).toISOString());
    seedPayment(deps.paymentRepository, 20, 0, new Date(openedAtMs + 10_000).toISOString());

    const result = await closeShift(
      { shiftId: opened.data.id, closingAmount: 20 },
      deps,
    );

    expect(result.data?.expectedAmount).toBe(20);
    expect(result.data?.difference).toBe(0);
  });

  it("no deja cerrar un turno que ya está cerrado", async () => {
    const deps = buildDeps();
    const opened = await openShift({ locationId: "loc_principal", userId: "user_01" }, deps);
    await closeShift({ shiftId: opened.data.id, closingAmount: 0 }, deps);

    const result = await closeShift({ shiftId: opened.data.id, closingAmount: 999 }, deps);

    expect(result.data).toBeNull();
  });

  it("un turno que no existe devuelve null", async () => {
    const deps = buildDeps();

    expect((await closeShift({ shiftId: "no-existe", closingAmount: 0 }, deps)).data).toBeNull();
  });

  it("rechaza un conteo negativo", async () => {
    const deps = buildDeps();
    const opened = await openShift({ locationId: "loc_principal", userId: "user_01" }, deps);

    await expect(
      closeShift({ shiftId: opened.data.id, closingAmount: -5 }, deps),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 422 });
  });
});
