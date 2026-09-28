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

async function apply(input: {
  status: string;
  note?: string | null;
  role?: "owner" | "manager" | "kitchen" | "cashier";
  order?: { type: "pickup" | "table" | "delivery"; status: string };
}) {
  const { applyOrderStatusChange } = await import("./order-status-composition");

  return applyOrderStatusChange({
    orderId: "ord_01",
    status: input.status,
    note: input.note ?? null,
    changedByUserId: "user_manager",
    actorRole: input.role ?? "manager",
    order: (input.order ?? { type: "pickup", status: "new" }) as never,
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

  /**
   * `TASK-ORDERS-KITCHEN-RUNTIME-002` — la **capacidad de Cocina** en el servidor.
   *
   * El rol de cocina **termina en Listo**: retirar (`ready_for_pickup → picked_up`) y cerrar son del
   * mostrador. La puerta gruesa `canManageOrderOperations` lo deja entrar a esta ruta, así que el recorte
   * tiene que estar acá. Y no aplica a los otros roles: el dueño y el manager siguen cerrando pedidos.
   */
  it("el rol de cocina no puede retirar ni cerrar un pedido: 403 y no se escribe nada", async () => {
    await expect(
      apply({
        status: "picked_up",
        role: "kitchen",
        order: { type: "pickup", status: "ready_for_pickup" },
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });

    expect(updateOrderStatusMock).not.toHaveBeenCalled();
    expect(paidOrderCancelledAuditMock).not.toHaveBeenCalled();
  });

  it("el rol de cocina sí avanza la comanda: aceptar, empezar y terminar", async () => {
    updateOrderStatusMock.mockResolvedValue({
      data: { id: "ord_01", status: "confirmed" },
      meta: { refundsRequested: 0 },
    });

    await expect(
      apply({ status: "confirmed", role: "kitchen", order: { type: "pickup", status: "new" } }),
    ).resolves.toBeDefined();
    await expect(
      apply({
        status: "preparing",
        role: "kitchen",
        order: { type: "pickup", status: "confirmed" },
      }),
    ).resolves.toBeDefined();
    await expect(
      apply({
        status: "ready_for_pickup",
        role: "kitchen",
        order: { type: "pickup", status: "preparing" },
      }),
    ).resolves.toBeDefined();
  });

  it("el dueño y el manager no se recortan: retirar y cerrar es de Pedidos", async () => {
    updateOrderStatusMock.mockResolvedValue({
      data: { id: "ord_01", status: "picked_up" },
      meta: { refundsRequested: 0 },
    });

    for (const role of ["owner", "manager"] as const) {
      await expect(
        apply({
          status: "picked_up",
          role,
          order: { type: "pickup", status: "ready_for_pickup" },
        }),
      ).resolves.toBeDefined();
    }

    expect(updateOrderStatusMock).toHaveBeenCalledTimes(2);
  });
});
