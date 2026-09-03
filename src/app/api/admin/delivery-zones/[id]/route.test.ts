import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageCriticalConfigMock = vi.fn();
const getAdminDeliveryZoneMock = vi.fn();
const updateDeliveryZoneMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageCriticalConfig: canManageCriticalConfigMock,
}));

vi.mock("@/modules/orders/features/get-admin-delivery-zone/get-admin-delivery-zone", () => ({
  getAdminDeliveryZone: getAdminDeliveryZoneMock,
}));

vi.mock("@/modules/orders/features/update-delivery-zone/update-delivery-zone", () => ({
  updateDeliveryZone: updateDeliveryZoneMock,
}));

vi.mock("@/modules/orders/adapters/prisma-delivery-zone-repository", () => ({
  PrismaDeliveryZoneRepository: class {},
}));

describe("admin delivery zone by id route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("GET returns 401 when session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Missing session"),
    );
    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "dz_1" }) });
    expect(response.status).toBe(401);
  });

  it("GET returns 200 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    getAdminDeliveryZoneMock.mockResolvedValueOnce({
      data: { id: "dz_1", name: "Centro", description: null, baseFee: 5, isActive: true, sortOrder: 0, createdAt: "2026-06-08T00:00:00.000Z", updatedAt: "2026-06-08T00:00:00.000Z" },
    });

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "dz_1" }) });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.name).toBe("Centro");
  });

  it("PATCH returns 200 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);
    updateDeliveryZoneMock.mockResolvedValueOnce({
      data: { id: "dz_1", name: "Centro Actualizado", description: null, baseFee: 7, isActive: true, sortOrder: 0, createdAt: "2026-06-08T00:00:00.000Z", updatedAt: "2026-06-08T00:00:00.000Z" },
      meta: { updatedAt: "2026-06-08T00:00:00.000Z" },
    });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro Actualizado", baseFee: 7 }),
      }),
      { params: Promise.resolve({ id: "dz_1" }) },
    );
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.name).toBe("Centro Actualizado");
  });

  it("PATCH returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(false);

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro Actualizado", baseFee: 7 }),
      }),
      { params: Promise.resolve({ id: "dz_1" }) },
    );
    expect(response.status).toBe(403);
  });

  it("PATCH returns 404 when zone does not exist", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);
    updateDeliveryZoneMock.mockRejectedValueOnce(
      new (await import("@/modules/orders/domain/order-errors")).OrderError(404, "NOT_FOUND", "Delivery zone not found"),
    );

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Centro Actualizado", baseFee: 7 }),
      }),
      { params: Promise.resolve({ id: "dz_missing" }) },
    );
    expect(response.status).toBe(404);
  });
});
