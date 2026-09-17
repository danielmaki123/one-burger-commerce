import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderError } from "@/modules/orders/domain/order-errors";

/**
 * Bloque 3.2 del roadmap del POS (Fase 2) — resolver una devolución desde la bandeja.
 *
 * Solo quien administra la caja resuelve (403 para el cajero y para cocina) y un rechazo sin motivo no
 * llega al caso de uso: el motivo del rechazo es lo que le dice al cajero qué hacer con la plata.
 */

const requireAdminSessionMock = vi.fn();
const reviewRefundMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: () => requireAdminSessionMock(),
}));

vi.mock("@/modules/orders/adapters/prisma-refund-repository", () => ({
  PrismaRefundRepository: class {},
}));

vi.mock("@/modules/orders/features/refund/review-refund/review-refund", () => ({
  reviewRefund: (input: unknown, deps: unknown) => reviewRefundMock(input, deps),
}));

const refundReviewAuditMock = vi.fn();

vi.mock("@/app/api/admin/audit-action-helpers", () => ({
  refundReviewAudit: (input: unknown) => refundReviewAuditMock(input),
}));

const params = Promise.resolve({ id: "ref_01" });

function post(body: unknown) {
  return new Request("http://localhost/api/admin/approvals/ref_01", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/approvals/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_owner", role: "owner", locationIds: [] },
    });
    reviewRefundMock.mockResolvedValue({ data: { id: "ref_01", status: "approved" } });
  });

  it("el dueño aprueba y la firma queda con su id", async () => {
    const { POST } = await import("./route");

    const response = await POST(post({ decision: "approved" }), { params });

    expect(response.status).toBe(200);
    expect(reviewRefundMock).toHaveBeenCalledWith(
      expect.objectContaining({ refundId: "ref_01", reviewedByUserId: "user_owner" }),
      expect.anything(),
    );
    expect(refundReviewAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_owner",
      refundId: "ref_01",
      decision: "approved",
      note: null,
    });
  });

  it("el rechazo queda firmado con su motivo", async () => {
    reviewRefundMock.mockResolvedValue({ data: { id: "ref_01", status: "rejected" } });

    const { POST } = await import("./route");
    await POST(post({ decision: "rejected", note: "El cobro estaba bien" }), { params });

    expect(refundReviewAuditMock).toHaveBeenCalledWith({
      actorUserId: "user_owner",
      refundId: "ref_01",
      decision: "rejected",
      note: "El cobro estaba bien",
    });
  });

  it("una resolución que no pasó no se firma", async () => {
    reviewRefundMock.mockRejectedValue(
      new OrderError(409, "CONFLICT", "Esa devolución ya está resuelta."),
    );

    const { POST } = await import("./route");
    const response = await POST(post({ decision: "approved" }), { params });

    expect(response.status).toBe(409);
    expect(refundReviewAuditMock).not.toHaveBeenCalled();
  });

  it.each(["cashier", "kitchen", "manager"] as const)("%s no resuelve devoluciones: 403", async (role) => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "user_x", role, locationIds: [] },
    });

    const { POST } = await import("./route");
    const response = await POST(post({ decision: "approved" }), { params });

    expect(response.status).toBe(403);
    expect(reviewRefundMock).not.toHaveBeenCalled();
  });

  it("un rechazo sin motivo no llega al caso de uso: 422", async () => {
    const { POST } = await import("./route");

    const response = await POST(post({ decision: "rejected", note: "   " }), { params });

    expect(response.status).toBe(422);
    expect(reviewRefundMock).not.toHaveBeenCalled();
  });

  it("una devolución ya resuelta llega como 409", async () => {
    reviewRefundMock.mockRejectedValue(
      new OrderError(409, "CONFLICT", "Esa devolución ya está resuelta."),
    );

    const { POST } = await import("./route");
    const response = await POST(post({ decision: "approved" }), { params });

    expect(response.status).toBe(409);
  });
});
