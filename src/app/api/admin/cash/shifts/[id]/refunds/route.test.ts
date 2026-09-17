import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * Bloque 3.3 del roadmap del POS (Fase 2) — la ruta que pide una devolución.
 *
 * Fija la orquestación: el permiso de la caja (por el turno), que quien administra la caja deja la
 * devolución **aprobada** de una y que quien no, la deja **pendiente**, y que un payload inválido no
 * llega al caso de uso.
 */

const requireAdminSessionMock = vi.fn();
const requireCashShiftIdMock = vi.fn();
const requestRefundMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/app/api/admin/cash/cash-route-helpers", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/admin/cash/cash-route-helpers")>(
    "@/app/api/admin/cash/cash-route-helpers",
  );

  return { ...actual, requireCashShiftId: (params: unknown) => requireCashShiftIdMock(params) };
});

vi.mock("@/modules/orders/features/refund/request-refund/request-refund", () => ({
  requestRefund: (input: unknown, deps: unknown) => requestRefundMock(input, deps),
}));

vi.mock("@/modules/orders/adapters/prisma-refund-repository", () => ({
  PrismaRefundRepository: class {},
}));
vi.mock("@/modules/orders/adapters/prisma-payment-repository", () => ({
  PrismaPaymentRepository: class {},
}));
vi.mock("@/modules/orders/adapters/prisma-shift-repository", () => ({
  PrismaShiftRepository: class {},
}));

const refundRequestAuditMock = vi.fn();

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  refundRequestAudit: (input: unknown) => refundRequestAuditMock(input),
}));

const params = Promise.resolve({ id: "shift_01" });

function post(body: unknown) {
  return new Request("http://localhost/api/admin/cash/shifts/shift_01/refunds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  paymentId: "pay_01",
  kind: "partial",
  amount: 200,
  reason: "Faltaba una bebida",
};

describe("POST /api/admin/cash/shifts/[id]/refunds", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_cashier", role: "cashier", locationIds: [] },
    });
    requireCashShiftIdMock.mockResolvedValue("loc_principal");
    requestRefundMock.mockImplementation(async (input: { amount: number }) => ({
      data: {
        id: "ref_01",
        orderId: "order_01",
        amount: input.amount,
        currency: "NIO",
        status: "pending",
      },
    }));
  });

  it("el cajero pide la devolución y queda pendiente (no puede firmarla)", async () => {
    const { POST } = await import("./route");

    const response = await POST(post(validBody), { params });

    expect(response.status).toBe(201);
    expect(requestRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ canApprove: false, requestedByUserId: "user_cashier" }),
      expect.anything(),
    );
  });

  it("la devolución pedida queda firmada con su monto y el estado con el que nació", async () => {
    const { POST } = await import("./route");

    await POST(post(validBody), { params });

    expect(refundRequestAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_cashier",
      refundId: "ref_01",
      orderId: "order_01",
      amount: 200,
      currency: "NIO",
      status: "pending",
    });
  });

  it("una devolución que no se creó no se firma (el error corta antes)", async () => {
    requestRefundMock.mockRejectedValue(new OrderError(422, "VALIDATION_ERROR", "No alcanza."));

    const { POST } = await import("./route");
    const response = await POST(post(validBody), { params });

    expect(response.status).toBe(422);
    expect(refundRequestAuditMock).not.toHaveBeenCalled();
  });

  it("el manager la deja aprobada de una", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_manager", role: "manager", locationIds: [] },
    });

    const { POST } = await import("./route");
    await POST(post(validBody), { params });

    expect(requestRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ canApprove: true }),
      expect.anything(),
    );
  });

  it("un monto inválido no llega al caso de uso: 422", async () => {
    const { POST } = await import("./route");

    const response = await POST(post({ ...validBody, amount: 0 }), { params });

    expect(response.status).toBe(422);
    expect(requestRefundMock).not.toHaveBeenCalled();
  });

  it("una devolución sobre un cobro inexistente llega como 404", async () => {
    requestRefundMock.mockRejectedValue(new OrderError(404, "NOT_FOUND", "No encontramos ese cobro."));

    const { POST } = await import("./route");
    const response = await POST(post(validBody), { params });

    expect(response.status).toBe(404);
  });
});
