import { beforeEach, describe, expect, it, vi } from "vitest";

const createOrderMock = vi.fn();

vi.mock("@/modules/notifications/adapters/outbox-subscriber", () => ({
  registerOutboxEventBusHandlers: vi.fn(),
}));

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () {
    return {};
  }),
}));

vi.mock("@/modules/orders/features/create-order/create-order", () => ({
  createOrder: createOrderMock,
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects delivery orders in the One Burger pickup-only MVP", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "delivery",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("rejects table orders in the One Burger pickup-only MVP", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "table",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it("accepts pickup orders and delegates total calculation to the domain feature", async () => {
    createOrderMock.mockResolvedValueOnce({
      data: { id: "order_01", type: "pickup" },
      meta: { sourceOfTruth: "backend" },
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/orders", {
        method: "POST",
        body: JSON.stringify({
          type: "pickup",
          customerName: "Daniel",
          customerWhatsapp: "+50588887777",
          items: [{ productId: "prod_01", quantity: 1 }],
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "pickup" }),
      expect.any(Object),
    );
  });
});
