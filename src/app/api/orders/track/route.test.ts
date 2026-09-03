import { beforeEach, describe, expect, it, vi } from "vitest";

const trackOrderMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/modules/orders/features/track-order/track-order", () => ({
  trackOrder: trackOrderMock,
}));

describe("POST /api/orders/track", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber: "", customerWhatsapp: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("returns 200 for valid payload", async () => {
    trackOrderMock.mockResolvedValueOnce({
      data: {
        orderNumber: "D-ABC123",
        type: "delivery",
        status: "confirmed",
        statusLabel: "Confirmada",
        updatedAt: "2026-05-26T00:00:00.000Z",
        items: [{ productName: "Yuca", quantity: 1 }],
        total: 120,
      },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNumber: "D-ABC123", customerWhatsapp: "+50588887777" }),
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.orderNumber).toBe("D-ABC123");
    expect(body.data.statusLabel).toBe("Confirmada");
    expect(body.data.id).toBeUndefined();
  });
});
