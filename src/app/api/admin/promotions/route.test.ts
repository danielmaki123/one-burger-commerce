import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManagePromotionsMock = vi.fn();
const listPromotionsMock = vi.fn();
const createPromotionMock = vi.fn();
const loadBusinessSettingsMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManagePromotions: canManagePromotionsMock,
}));

vi.mock("@/modules/orders/features/list-promotions/list-promotions", () => ({
  listPromotions: listPromotionsMock,
}));

vi.mock("@/modules/orders/features/create-promotion/create-promotion", () => ({
  createPromotion: createPromotionMock,
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

const validPayload = {
  code: "b2g1",
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

describe("admin promotions route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("GET returns the promotions with their status", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    listPromotionsMock.mockResolvedValueOnce({
      data: [{ id: "coupon_1", code: "B2G1", status: "active" }],
    });

    const { GET } = await import("./route");
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data[0].code).toBe("B2G1");
  });

  it("POST returns 403 when the role cannot manage promotions", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "kitchen" } });
    canManagePromotionsMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(403);
    expect(createPromotionMock).not.toHaveBeenCalled();
  });

  it("POST returns 201 and passes the business timezone", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);
    loadBusinessSettingsMock.mockResolvedValueOnce({ timezone: "America/Managua" });
    createPromotionMock.mockResolvedValueOnce({
      data: { id: "coupon_1", code: "B2G1" },
      meta: { updatedAt: "2026-09-12T00:00:00.000Z" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload),
      }),
    );

    expect(response.status).toBe(201);
    expect(createPromotionMock).toHaveBeenCalledWith(validPayload, {
      repository: expect.anything(),
      timeZone: "America/Managua",
    });
  });

  it("POST returns 400 with field errors when the payload is not a promotion", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "AB", type: "bogo" }),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.fields.code).toBeDefined();
    expect(createPromotionMock).not.toHaveBeenCalled();
  });

  it("POST returns 422 when the promotion rules reject it", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({ user: { id: "u_1", role: "owner" } });
    canManagePromotionsMock.mockReturnValueOnce(true);
    loadBusinessSettingsMock.mockResolvedValueOnce({ timezone: "America/Managua" });
    const { OrderError } = await import("@/modules/orders/domain/order-errors");
    createPromotionMock.mockRejectedValueOnce(
      new OrderError(422, "VALIDATION_ERROR", "Invalid payload", { code: "Ya existe" }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validPayload),
      }),
    );
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error.fields.code).toBe("Ya existe");
  });
});
