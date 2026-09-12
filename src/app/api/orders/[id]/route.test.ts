import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrderError } from "@/modules/orders/domain/order-errors";

const getPublicOrderMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () { return {}; }),
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: vi.fn(function () { return {}; }),
}));

vi.mock("@/modules/orders/features/get-order/get-public-order", () => ({
  getPublicOrder: getPublicOrderMock,
}));

describe("GET /api/orders/[id]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when token is missing", async () => {
    getPublicOrderMock.mockRejectedValueOnce(
      new OrderError(401, "UNAUTHORIZED", "Order lookup token required"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/orders/ord_1"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 when token is invalid", async () => {
    getPublicOrderMock.mockRejectedValueOnce(
      new OrderError(404, "NOT_FOUND", "Order not found"),
    );

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/orders/ord_1?token=wrongtoken"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 200 with public-safe payload when token is valid", async () => {
    getPublicOrderMock.mockResolvedValueOnce({
      data: {
        id: "ord_1",
        orderNumber: "D-ABC123",
        type: "delivery",
        status: "preparing",
        customerName: "Daniel",
        items: [],
        subtotal: 200,
        discount: 0,
        deliveryFeeAmount: 30,
        total: 230,
        createdAt: "2026-05-14T00:00:00.000Z",
        updatedAt: "2026-05-14T00:10:00.000Z",
      },
    });

    const route = await import("./route");
    const response = await route.GET(
      new Request("http://localhost/api/orders/ord_1?token=validtoken"),
      { params: Promise.resolve({ id: "ord_1" }) },
    );

    expect(route.dynamic).toBe("force-dynamic");
    expect(route.revalidate).toBe(0);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(getPublicOrderMock).toHaveBeenCalledWith("ord_1", "validtoken", expect.any(Object));
    const body = await response.json();
    expect(body.data.orderNumber).toBe("D-ABC123");
    expect(body.data.customerName).toBe("Daniel");
    expect(body.data.customerWhatsapp).toBeUndefined();
    expect(body.data.address).toBeUndefined();
    expect(body.data.deliveryNotes).toBeUndefined();
    expect(body.data.customerLat).toBeUndefined();
    expect(body.data.customerLng).toBeUndefined();
    expect(body.data.geoAccuracy).toBeUndefined();
    expect(body.data.geoCapturedAt).toBeUndefined();
    expect(body.data.orderLookupTokenHash).toBeUndefined();
  });
});
