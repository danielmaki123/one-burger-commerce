import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const getOrderMock = vi.fn();
const requireAdminSessionMock = vi.fn();
const canManageOrderOperationsMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () { return {}; }),
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: vi.fn(function () { return {}; }),
}));

vi.mock("@/modules/orders/features/get-order/get-order", () => ({
  getOrder: getOrderMock,
}));

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canManageOrderOperations: canManageOrderOperationsMock,
}));

describe("GET /api/admin/orders/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 with full order detail when admin is authenticated", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_1", role: "owner" },
    });
    canManageOrderOperationsMock.mockReturnValueOnce(true);
    getOrderMock.mockResolvedValueOnce({
      data: {
        id: "ord_1",
        orderNumber: "D-ABC123",
        type: "delivery",
        status: "preparing",
        customerName: "Daniel",
        customerWhatsapp: "+50588887777",
        address: "Barrio Central, casa 12",
        deliveryNotes: "tocar porton",
        customerLat: 12.345,
        customerLng: -86.789,
        geoAccuracy: 10.5,
        geoCapturedAt: "2026-05-14T00:00:00.000Z",
        items: [],
        subtotal: 200,
        discount: 0,
        deliveryFeeAmount: 30,
        total: 230,
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:10:00.000Z",
      },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/orders/ord_1"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.orderNumber).toBe("D-ABC123");
    expect(body.data.customerWhatsapp).toBe("+50588887777");
    expect(body.data.address).toBe("Barrio Central, casa 12");
    expect(body.data.customerLat).toBe(12.345);
    expect(body.data.geoAccuracy).toBe(10.5);
  });

  it("returns 401 when admin session is missing", async () => {
    requireAdminSessionMock.mockRejectedValueOnce(
      new AuthError(401, "UNAUTHORIZED", "Unauthorized"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/orders/ord_1"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when admin lacks order management permissions", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "viewer" },
    });
    canManageOrderOperationsMock.mockReturnValueOnce(false);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/orders/ord_1"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );

    expect(response.status).toBe(403);
  });

  it("un usuario acotado no puede abrir un pedido de otra sucursal (A)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    canManageOrderOperationsMock.mockReturnValueOnce(true);
    getOrderMock.mockResolvedValueOnce({
      data: { id: "ord_1", orderNumber: "P-1", locationId: "loc_sur", items: [] },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/orders/ord_1"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toContain("sucursal");
  });

  it("un usuario acotado sí abre un pedido de su sucursal (A)", async () => {
    requireAdminSessionMock.mockResolvedValueOnce({
      user: { id: "admin_2", role: "kitchen", locationIds: ["loc_norte"] },
    });
    canManageOrderOperationsMock.mockReturnValueOnce(true);
    getOrderMock.mockResolvedValueOnce({
      data: { id: "ord_2", orderNumber: "P-2", locationId: "loc_norte", items: [] },
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/admin/orders/ord_2"),
      { params: Promise.resolve({ id: "ord_2" }) },
    );

    expect(response.status).toBe(200);
  });
});
