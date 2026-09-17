import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Bloque 3.5 + 13.1 del roadmap del POS (Fase 2) — el cambio de estado y su asiento.
 *
 * Cancelar un pedido **cobrado** deja la devolución pendiente (A-15) y eso es plata que hay que devolver:
 * el asiento tiene que existir **solo** cuando el caso de uso creó devoluciones. Un pedido sin cobros se
 * cancela igual y no se firma nada, porque no hay nada que devolver.
 */

const updateOrderStatusMock = vi.fn();
const paidOrderCancelledAuditMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: class {},
}));
vi.mock("@/modules/orders/adapters/prisma-payment-repository", () => ({
  PrismaPaymentRepository: class {},
}));
vi.mock("@/modules/orders/adapters/prisma-refund-repository", () => ({
  PrismaRefundRepository: class {},
}));

vi.mock("@/modules/orders/features/update-order-status/update-order-status", () => ({
  updateOrderStatus: (id: string, input: unknown, deps: unknown) =>
    updateOrderStatusMock(id, input, deps),
}));

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  paidOrderCancelledAudit: (input: unknown) => paidOrderCancelledAuditMock(input),
}));

async function apply(input: { status: string; note?: string | null }) {
  const { applyOrderStatusChange } = await import("./order-status-composition");

  return applyOrderStatusChange({
    orderId: "ord_01",
    status: input.status,
    note: input.note ?? null,
    changedByUserId: "user_manager",
  });
}

describe("applyOrderStatusChange", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    updateOrderStatusMock.mockResolvedValue({
      data: { id: "ord_01", status: "cancelled" },
      meta: { refundsRequested: 1 },
    });
  });

  it("cancelar un pedido cobrado deja firmado cuánta plata hay que devolver", async () => {
    await apply({ status: "cancelled", note: "Cliente canceló" });

    expect(paidOrderCancelledAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_manager",
      orderId: "ord_01",
      refundsRequested: 1,
    });
  });

  it("cancelar un pedido sin cobros no firma nada (no hay plata que devolver)", async () => {
    updateOrderStatusMock.mockResolvedValue({
      data: { id: "ord_01", status: "cancelled" },
      meta: { refundsRequested: 0 },
    });

    await apply({ status: "cancelled", note: "Sin cobro" });

    expect(paidOrderCancelledAuditMock).not.toHaveBeenCalled();
  });

  it("un cambio que no es cancelación no firma la cancelación", async () => {
    updateOrderStatusMock.mockResolvedValue({
      data: { id: "ord_01", status: "confirmed" },
      meta: { refundsRequested: 0 },
    });

    await apply({ status: "confirmed" });

    expect(paidOrderCancelledAuditMock).not.toHaveBeenCalled();
  });

  it("si el caso de uso falla no se firma nada", async () => {
    updateOrderStatusMock.mockRejectedValue(new Error("no se pudo cambiar"));

    await expect(apply({ status: "cancelled", note: "Cliente canceló" })).rejects.toThrow();

    expect(paidOrderCancelledAuditMock).not.toHaveBeenCalled();
  });
});
