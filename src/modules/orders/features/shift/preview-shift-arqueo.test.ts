import { describe, expect, it, vi } from "vitest";

import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import type { CashMovementRepository } from "@/modules/orders/ports/cash-movement-repository";
import type { PaymentRepository } from "@/modules/orders/ports/payment-repository";
import type { RefundRepository } from "@/modules/orders/ports/refund-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

import { previewShiftArqueo } from "./preview-shift-arqueo";

/**
 * Tarea 7 del brief (2026-09-17) — el **corte X** (1.12): leer el arqueo del turno abierto **sin
 * cerrarlo**, para saber cómo va la caja a mitad del turno (y para el handover entre cajeros).
 *
 * Lo que fija este archivo: el corte usa la **misma** cuenta que el cierre (no una versión parecida), no
 * toca el turno —sigue abierto y sin arqueo guardado— y una caja vacía devuelve `null` en vez de un
 * arqueo inventado.
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
  cashCounts: [{ kind: "opening", currency: "NIO", denomination: 100, quantity: 10 }],
  notes: null,
  createdAt: "2026-09-17T14:00:00.000Z",
  updatedAt: "2026-09-17T14:00:00.000Z",
};

const payment = {
  id: "pay_01",
  orderId: "ord_01",
  method: "cash" as const,
  amount: 500,
  currency: "NIO",
  changeAmount: 0,
  tip: 0,
  reference: null,
  createdAt: "2026-09-17T15:00:00.000Z",
};

function deps(shift: ShiftRecord | null = openShift) {
  const shiftRepository = {
    findShiftById: vi.fn(async () => shift),
  } as unknown as ShiftRepository;
  const paymentRepository = {
    listPaymentsInRange: vi.fn(async () => [payment]),
    // Fase 6 del rediseño de Caja: sin cobros atribuidos al turno, el arqueo lee por ventana de tiempo.
    listPaymentsByShift: vi.fn(async () => []),
  } as unknown as PaymentRepository;
  const cashMovementRepository = {
    listByShift: vi.fn(async () => [
      {
        id: "mov_01",
        shiftId: "shift_01",
        kind: "withdrawal" as const,
        category: "supplier" as const,
        amount: 200,
        currency: "NIO",
        reason: "Proveedor",
        userId: "user_cashier",
        approvedByUserId: null,
        approvedAt: null,
        withdrawalLimitAmount: null,
        createdAt: "2026-09-17T15:30:00.000Z",
      },
    ]),
  } as unknown as CashMovementRepository;
  const refundRepository = {
    listByShift: vi.fn(async () => []),
  } as unknown as Pick<RefundRepository, "listByShift">;

  return {
    deps: {
      shiftRepository,
      paymentRepository,
      cashMovementRepository,
      refundRepository,
      businessCurrencyCode: "NIO",
      usdExchangeRate: null,
    },
    shiftRepository,
    paymentRepository,
  };
}

describe("previewShiftArqueo", () => {
  it("calcula el esperado del turno abierto con la misma cuenta que el cierre", async () => {
    const { deps: dependencies } = deps();

    const result = await previewShiftArqueo(
      { shiftId: "shift_01", now: new Date("2026-09-17T18:00:00.000Z") },
      dependencies,
    );

    expect(result.data).toMatchObject({
      shiftId: "shift_01",
      locationId: "loc_principal",
      openingAmount: 1000,
      cashSalesAmount: 500,
      cashMovementsAmount: -200,
      refundsAmount: 0,
      // 1000 de fondo + 500 de efectivo − 200 del retiro.
      expectedAmount: 1300,
      expectedByCurrency: { NIO: 1300 },
      openedAt: "2026-09-17T14:00:00.000Z",
    });
  });

  it("no toca el turno: no lo cierra ni le guarda un arqueo", async () => {
    const { deps: dependencies } = deps();

    await previewShiftArqueo(
      { shiftId: "shift_01", now: new Date("2026-09-17T18:00:00.000Z") },
      dependencies,
    );

    const repository = dependencies.shiftRepository as unknown as { closeShift?: unknown };
    expect(repository.closeShift).toBeUndefined();
  });

  it("sin turno abierto no hay corte que hacer", async () => {
    const { deps: dependencies } = deps(null);

    const result = await previewShiftArqueo(
      { shiftId: "shift_01", now: new Date("2026-09-17T18:00:00.000Z") },
      dependencies,
    );

    expect(result.data).toBeNull();
  });

  it("un turno ya cerrado no se lee como corte X (su arqueo es el del cierre)", async () => {
    const { deps: dependencies } = deps({ ...openShift, status: "closed", closedAt: "2026-09-17T20:00:00.000Z" });

    const result = await previewShiftArqueo(
      { shiftId: "shift_01", now: new Date("2026-09-17T21:00:00.000Z") },
      dependencies,
    );

    expect(result.data).toBeNull();
  });
});
