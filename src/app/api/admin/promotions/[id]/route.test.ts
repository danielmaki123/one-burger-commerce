import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import { OrderError } from "@/modules/orders/domain/order-errors";

const requireAdminSessionMock = vi.fn();
const canManagePromotionsMock = vi.fn();
const updatePromotionMock = vi.fn();
const deletePromotionMock = vi.fn();
const loadBusinessSettingsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManagePromotions: canManagePromotionsMock,
}));

vi.mock("@/modules/orders/features/update-promotion/update-promotion", () => ({
  updatePromotion: updatePromotionMock,
}));

vi.mock("@/modules/orders/features/delete-promotion/delete-promotion", () => ({
  deletePromotion: deletePromotionMock,
}));

vi.mock(
  "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings",
  () => ({
    loadBusinessSettings: loadBusinessSettingsMock,
  }),
);

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: class {},
}));

vi.mock("@/modules/business-settings/adapters/prisma-business-settings-repository", () => ({
  PrismaBusinessSettingsRepository: class {},
}));

const payload = {
  code: "B2G1",
  type: "bogo",
  value: 0,
  isActive: true,
  usageLimit: 0,
  expiresAt: null,
  buyQuantity: 2,
  freeQuantity: 1,
  scopeType: "all",
  scopeId: null,
};

const params = Promise.resolve({ id: "coupon_1" });

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/promotions/coupon_1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin promotion detail route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("PATCH returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(401);
  });

  it("PATCH returns 403 when the role cannot manage promotions", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "kitchen" } });
    canManagePromotionsMock.mockReturnValueOnce(false);

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(403);
    expect(updatePromotionMock).not.toHaveBeenCalled();
  });

  it("PATCH returns 200 and uses the business timezone", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);
    loadBusinessSettingsMock.mockResolvedValueOnce({ timezone: "America/Managua" });
    updatePromotionMock.mockResolvedValueOnce({
      data: { id: "coupon_1", code: "B2G1" },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(200);
    expect(updatePromotionMock).toHaveBeenCalledWith("coupon_1", payload, {
      repository: expect.anything(),
      timeZone: "America/Managua",
    });
  });

  it("PATCH returns 404 when the promotion does not exist", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);
    loadBusinessSettingsMock.mockResolvedValueOnce({ timezone: "America/Managua" });
    updatePromotionMock.mockRejectedValueOnce(new OrderError(404, "NOT_FOUND", "Coupon not found"));

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest(payload), { params });

    expect(response.status).toBe(404);
  });

  it("PATCH returns 400 when the payload is not a promotion", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);

    const { PATCH } = await import("./route");
    const response = await PATCH(patchRequest({ code: "" }), { params });

    expect(response.status).toBe(400);
    expect(updatePromotionMock).not.toHaveBeenCalled();
  });

  it("DELETE returns 200 and confirms the deleted id", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);
    deletePromotionMock.mockResolvedValueOnce({
      data: { id: "coupon_1" },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params,
    });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.id).toBe("coupon_1");
  });

  it("DELETE returns 403 when the role cannot manage promotions", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "manager" } });
    canManagePromotionsMock.mockReturnValueOnce(false);

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost", { method: "DELETE" }), {
      params,
    });

    expect(response.status).toBe(403);
    expect(deletePromotionMock).not.toHaveBeenCalled();
  });
});
