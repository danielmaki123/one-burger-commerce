import { describe, expect, it } from "vitest";

import type { PaymentRecord, RefundRecord } from "@/modules/orders/domain/order.types";
import type { CreateRefundInput } from "@/modules/orders/ports/refund-repository";

import { requestRefund } from "./request-refund";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — pedir una devolución.
 *
 * Lo que puede salir caro y por eso se fija acá:
 * - **no se devuelve más de lo que se cobró** (sumando lo ya devuelto y sin contar lo rechazado);
 * - el **motivo es obligatorio**;
 * - una devolución **parcial** no puede cubrir todo el cobro (para eso está la total) y una **total**
 *   no puede ser menor que el cobro;
 * - **nadie aprueba su propia devolución**: quien tiene `canManageCash` puede aprobar la de otro (y la
 *   suya queda pendiente para un segundo par de ojos) — es la regla conservadora.
 */

const payment: PaymentRecord = {
  id: "pay_01",
  orderId: "ord_01",
  method: "cash",
  amount: 500,
  currency: "NIO",
  tip: 0,
  changeAmount: 0,
  reference: null,
  createdAt: "2026-09-17T18:00:00.000Z",
};

function refund(over: Partial<RefundRecord> & { id: string }): RefundRecord {
  return {
    paymentId: "pay_01",
    orderId: "ord_01",
    shiftId: "shift_01",
    kind: "partial",
    method: "cash",
    amount: 100,
    currency: "NIO",
    reason: "Faltaba una bebida",
    status: "approved",
    requestedByUserId: "user_cashier",
    approvedByUserId: "user_manager",
    approvedAt: "2026-09-17T18:30:00.000Z",
    createdAt: "2026-09-17T18:20:00.000Z",
    ...over,
  };
}

function buildDeps(options: { refunds?: RefundRecord[]; shiftId?: string | null } = {}) {
  const created: CreateRefundInput[] = [];
  const existing = options.refunds ?? [];

  return {
    created,
    deps: {
      paymentRepository: {
        async findPaymentById() {
          return payment;
        },
      },
      refundRepository: {
        async create(input: CreateRefundInput) {
          created.push(input);
          return refund({ id: `ref_${created.length}`, ...input } as RefundRecord);
        },
        async findById() {
          return null;
        },
        async listByPayment() {
          return existing;
        },
        async listByShift() {
          return existing;
        },
        async listPending() {
          return [];
        },
        async resolve() {
          return null;
        },
      },
      shiftRepository: {
        async findOpenShiftByLocation() {
          if (options.shiftId === null) return null;

          return {
            id: options.shiftId ?? "shift_01",
          } as unknown as import("@/modules/orders/domain/order.types").ShiftRecord;
        },
      },
    },
  };
}

const baseInput = {
  paymentId: "pay_01",
  kind: "partial" as const,
  amount: 100,
  reason: "Faltaba una bebida",
  requestedByUserId: "user_cashier",
  canApprove: false,
  locationId: "loc_principal",
};

describe("requestRefund", () => {
  it("registra una devolución parcial pendiente y toma el medio del cobro", async () => {
    const { created, deps } = buildDeps();

    const result = await requestRefund(baseInput, deps);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      paymentId: "pay_01",
      orderId: "ord_01",
      shiftId: "shift_01",
      kind: "partial",
      method: "cash",
      currency: "NIO",
      amount: 100,
      status: "pending",
      approvedByUserId: null,
    });
    expect(result.data.status).toBe("pending");
  });

  /**
   * Tarea 9 del brief (2026-09-17) — «solo el owner aprueba devoluciones (nadie la propia)».
   *
   * Pedir y firmar son dos actos separados: **siempre** nace pendiente, aunque quien la pida sea el
   * dueño. Antes, quien tenía el permiso de devolver la dejaba aprobada de una; ese atajo se sacó.
   */
  it("nace siempre pendiente, aunque quien la pida pueda aprobarla", async () => {
    const { created, deps } = buildDeps();

    await requestRefund(
      { ...baseInput, requestedByUserId: "user_owner", canApprove: true },
      deps,
    );

    expect(created[0]).toMatchObject({
      status: "pending",
      approvedByUserId: null,
      approvedAt: null,
      requestedByUserId: "user_owner",
    });
  });

  it("una devolución sin cobro no existe: 404", async () => {
    const { deps } = buildDeps();
    const sinCobro = {
      ...deps,
      paymentRepository: { async findPaymentById() { return null; } },
    };

    await expect(requestRefund(baseInput, sinCobro)).rejects.toMatchObject({ status: 404 });
  });

  it("exige motivo: una devolución sin razón no se audita", async () => {
    const { created, deps } = buildDeps();

    await expect(requestRefund({ ...baseInput, reason: "   " }, deps)).rejects.toMatchObject({
      status: 422,
    });
    expect(created).toEqual([]);
  });

  it("exige un monto positivo", async () => {
    const { created, deps } = buildDeps();

    await expect(requestRefund({ ...baseInput, amount: 0 }, deps)).rejects.toMatchObject({
      status: 422,
    });
    expect(created).toEqual([]);
  });

  it("no devuelve más de lo cobrado: suma lo ya devuelto menos lo rechazado", async () => {
    const { deps } = buildDeps({
      refunds: [
        refund({ id: "r1", amount: 300, status: "approved" }),
        refund({ id: "r2", amount: 100, status: "pending" }),
        refund({ id: "r3", amount: 500, status: "rejected" }),
      ],
    });

    // Cobrado 500, devuelto 400 (300 aprobado + 100 pendiente): quedan 100.
    await expect(requestRefund({ ...baseInput, amount: 150 }, deps)).rejects.toMatchObject({
      status: 422,
    });
    expect((await requestRefund({ ...baseInput, amount: 100 }, deps)).data.amount).toBe(100);
  });

  it("la parcial no puede cubrir todo el cobro y la total tiene que cubrirlo", async () => {
    const { deps } = buildDeps();

    await expect(
      requestRefund({ ...baseInput, kind: "partial", amount: 500 }, deps),
    ).rejects.toMatchObject({ status: 422 });

    await expect(
      requestRefund({ ...baseInput, kind: "full", amount: 400 }, deps),
    ).rejects.toMatchObject({ status: 422 });

    expect((await requestRefund({ ...baseInput, kind: "full", amount: 500 }, deps)).data.kind).toBe(
      "full",
    );
  });

  it("sin caja abierta la devolución queda sin turno, no rompe", async () => {
    const { created, deps } = buildDeps({ shiftId: null });

    await requestRefund(baseInput, deps);

    expect(created[0].shiftId).toBeNull();
  });
});
