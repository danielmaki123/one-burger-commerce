import { describe, expect, it } from "vitest";

import type { RefundRecord } from "@/modules/orders/domain/order.types";

import { reviewRefund } from "./review-refund";

/**
 * Bloque 3 del roadmap del POS (Fase 2) — aprobar o rechazar una devolución.
 *
 * La devolución la **pide** quien atiende y la **resuelve** quien administra la caja: es el control
 * que evita que la misma persona devuelva plata y la apruebe. El estado tiene que estar **pendiente**
 * (una devolución ya resuelta no se vuelve a resolver: sería cambiar un movimiento de plata que ya
 * pasó) y el motivo del rechazo se guarda en la nota, porque una devolución rechazada sin razón deja
 * al cajero sin saber qué hacer.
 */

const pending: RefundRecord = {
  id: "ref_01",
  paymentId: "pay_01",
  orderId: "ord_01",
  shiftId: "shift_01",
  kind: "partial",
  method: "cash",
  amount: 200,
  currency: "NIO",
  reason: "Faltaba una bebida",
  status: "pending",
  requestedByUserId: "user_cashier",
  approvedByUserId: null,
  approvedAt: null,
  createdAt: "2026-09-17T18:55:00.000Z",
};

function buildDeps(refund: RefundRecord | null = pending) {
  const resolved: { id: string; input: Record<string, unknown> }[] = [];

  return {
    resolved,
    deps: {
      refundRepository: {
        async resolve(id: string, input: Record<string, unknown>) {
          resolved.push({ id, input });
          return { ...pending, ...input, id } as RefundRecord;
        },
        async findById() {
          return refund;
        },
      },
    },
  };
}

const baseInput = {
  refundId: "ref_01",
  decision: "approved" as const,
  reviewedByUserId: "user_manager",
  note: null,
};

describe("reviewRefund", () => {
  it("aprueba una devolución pendiente firmando quién y cuándo", async () => {
    const { resolved, deps } = buildDeps();

    const result = await reviewRefund(baseInput, deps);

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      id: "ref_01",
      input: { status: "approved", approvedByUserId: "user_manager" },
    });
    expect(resolved[0].input.approvedAt).toBeTruthy();
    expect(result.data.status).toBe("approved");
  });

  it("el rechazo guarda el motivo en la nota", async () => {
    const { resolved, deps } = buildDeps();

    await reviewRefund(
      { ...baseInput, decision: "rejected", note: "No corresponde: el pedido se entregó completo." },
      deps,
    );

    expect(resolved[0].input).toMatchObject({
      status: "rejected",
      reason: "No corresponde: el pedido se entregó completo.",
    });
  });

  it("rechazar exige motivo: sin razón, el cajero no sabe qué hacer", async () => {
    const { resolved, deps } = buildDeps();

    await expect(
      reviewRefund({ ...baseInput, decision: "rejected", note: "   " }, deps),
    ).rejects.toMatchObject({ status: 422 });
    expect(resolved).toEqual([]);
  });

  it("una devolución ya resuelta no se vuelve a resolver", async () => {
    const { resolved, deps } = buildDeps({ ...pending, status: "approved" });

    await expect(reviewRefund(baseInput, deps)).rejects.toMatchObject({ status: 409 });
    expect(resolved).toEqual([]);
  });

  it("una devolución que no existe es 404", async () => {
    const { deps } = buildDeps(null);

    await expect(reviewRefund(baseInput, deps)).rejects.toMatchObject({ status: 404 });
  });
});
