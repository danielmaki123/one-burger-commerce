import { describe, expect, it, vi } from "vitest";

import { InMemoryShiftHandoverRepository } from "@/modules/orders/adapters/in-memory-shift-handover-repository";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import type { CashMovementRepository } from "@/modules/orders/ports/cash-movement-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { ShiftHandoverRepository } from "@/modules/orders/ports/shift-handover-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { registerShiftHandover } from "./register-shift-handover";

/**
 * Tarea 7 del brief (2026-09-17) — el **traspaso de caja** (1.13).
 *
 * El caso de uso es el que decide tres cosas: que haya una caja abierta a la que traspasarle el
 * responsable, que el esperado se **congele** (se firma el número del momento, no el de después) y que
 * quien recibe sea una persona distinta de quien entrega.
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

function cashPayment(id: string, amount: number) {
  return {
    id,
    orderId: `ord_${id}`,
    method: "cash" as const,
    amount,
    currency: "NIO",
    changeAmount: 0,
    tip: 0,
    reference: null,
    createdAt: "2026-09-17T15:00:00.000Z",
  };
}

function deps(shift: ShiftRecord | null = openShift) {
  const shiftRepository = {
    findOpenShiftByLocation: vi.fn(async () => shift),
    findShiftById: vi.fn(async () => shift),
  } as unknown as ShiftRepository;
  const handoverRepository = new InMemoryShiftHandoverRepository();
  const paymentRepository = {
    listPaymentsInRange: vi.fn(async () => [cashPayment("pay_01", 500)]),
    // Fase 6 del rediseño de Caja: este doble representa un turno **sin** cobros atribuidos, así que el
    // arqueo lee por ventana de tiempo (que es el camino de los turnos de antes de la fase).
    listPaymentsByShift: vi.fn(async () => []),
  } as unknown as PaymentRepository;
  const cashMovementRepository = {
    listByShift: vi.fn(async () => []),
  } as unknown as CashMovementRepository;

  return {
    deps: {
      shiftRepository,
      handoverRepository: handoverRepository as ShiftHandoverRepository,
      paymentRepository,
      cashMovementRepository,
      businessCurrencyCode: "NIO",
      usdExchangeRate: null,
    },
    handoverRepository,
    shiftRepository,
  };
}

const input = {
  locationId: "loc_principal",
  receivedByName: "Carlos Ruiz",
  handedByUserId: "user_cashier",
  handedByName: "María López",
  now: new Date("2026-09-17T18:00:00.000Z"),
};

describe("registerShiftHandover", () => {
  it("firma el traspaso con el corte X del momento", async () => {
    const { deps: dependencies, handoverRepository } = deps();

    const result = await registerShiftHandover(input, dependencies);

    expect(result.data).toMatchObject({
      shiftId: "shift_01",
      locationId: "loc_principal",
      handedByUserId: "user_cashier",
      handedByName: "María López",
      receivedByName: "Carlos Ruiz",
      // 1000 de fondo + 500 de efectivo.
      expectedAmount: 1500,
      expectedByCurrency: { NIO: 1500 },
    });
    expect(handoverRepository.handovers).toHaveLength(1);
  });

  it("congela el esperado: el traspaso guardado no se recalcula después", async () => {
    const { deps: dependencies, handoverRepository } = deps();

    await registerShiftHandover(input, dependencies);

    // Después de firmar entra otro cobro en efectivo al mismo turno.
    const payments = dependencies.paymentRepository as unknown as {
      listPaymentsInRange: ReturnType<typeof vi.fn>;
    };
    payments.listPaymentsInRange.mockResolvedValue([
      cashPayment("pay_01", 500),
      cashPayment("pay_02", 900),
    ]);

    const listed = await handoverRepository.listByShift("shift_01");
    expect(listed[0]?.expectedAmount).toBe(1500);

    // El corte X de ahora sí dice otro número; el que se firmó no se movió.
    const { previewShiftArqueo } = await import("./preview-shift-arqueo");
    const fresh = await previewShiftArqueo({ shiftId: "shift_01", now: input.now }, dependencies);

    expect(fresh.data?.expectedAmount).toBe(2400);
  });

  it("sin caja abierta no hay nada que traspasar", async () => {
    const { deps: dependencies } = deps(null);

    await expect(registerShiftHandover(input, dependencies)).rejects.toThrow(OrderError);
    await expect(registerShiftHandover(input, dependencies)).rejects.toThrow(/caja abierta/);
  });

  it("no deja firmar el traspaso a nombre de quien entrega", async () => {
    const { deps: dependencies, handoverRepository } = deps();

    await expect(
      registerShiftHandover({ ...input, receivedByName: "maría lópez" }, dependencies),
    ).rejects.toThrow(/misma persona/);
    expect(handoverRepository.handovers).toHaveLength(0);
  });

  it("un nombre vacío no firma nada", async () => {
    const { deps: dependencies, handoverRepository } = deps();

    await expect(
      registerShiftHandover({ ...input, receivedByName: "  " }, dependencies),
    ).rejects.toThrow(/quién recibe/);
    expect(handoverRepository.handovers).toHaveLength(0);
  });
});
