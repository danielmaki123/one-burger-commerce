import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/modules/auth/domain/auth-errors";

const requireAdminSessionMock = vi.fn();
const canManageCriticalConfigMock = vi.fn();
const listAdminDeliveryZonesMock = vi.fn();
const createDeliveryZoneMock = vi.fn();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageCriticalConfig: canManageCriticalConfigMock,
}));

vi.mock("@/modules/orders/features/list-admin-delivery-zones/list-admin-delivery-zones", () => ({
  listAdminDeliveryZones: listAdminDeliveryZonesMock,
}));

vi.mock("@/modules/orders/features/create-delivery-zone/create-delivery-zone", () => ({
  createDeliveryZone: createDeliveryZoneMock,
}));

vi.mock("@/modules/orders/adapters/prisma-delivery-zone-repository", () => ({
  PrismaDeliveryZoneRepository: class {},
}));

describe("admin delivery zones route", () => {
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

  it("GET returns 200 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    listAdminDeliveryZonesMock.mockResolvedValueOnce({
      data: [
        { id: "dz_1", name: "Centro", description: null, baseFee: 5, isActive: true, sortOrder: 0, createdAt: "2026-06-08T00:00:00.000Z", updatedAt: "2026-06-08T00:00:00.000Z" },
      ],
    });

    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toHaveLength(1);
    expect(json.data[0].name).toBe("Centro");
  });

  it("POST returns 201 on happy path", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);
    createDeliveryZoneMock.mockResolvedValueOnce({
      data: { id: "dz_1", name: "Norte", description: null, baseFee: 10, isActive: true, sortOrder: 1, createdAt: "2026-06-08T00:00:00.000Z", updatedAt: "2026-06-08T00:00:00.000Z" },
      meta: { updatedAt: "2026-06-08T00:00:00.000Z" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Norte",
          baseFee: 10,
          isActive: true,
          sortOrder: 1,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data.id).toBe("dz_1");
  });

  it("POST returns 400 on invalid payload", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "owner" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(true);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "", baseFee: -1 }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("POST returns 403 when role has no permission", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "u_1", role: "manager" },
    });
    canManageCriticalConfigMock.mockReturnValueOnce(false);

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/admin/delivery-zones", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Norte",
          baseFee: 10,
          isActive: true,
          sortOrder: 1,
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
