import { describe, expect, it, vi } from "vitest";

const createMock = vi.fn(async (args: unknown) => ({
  id: "evt_1",
  eventType: "OrderCreated",
  aggregateType: "order",
  aggregateId: "ord_1",
  status: "pending",
  payload: (args as { data?: { payload?: unknown } })?.data?.payload ?? {},
  attemptCount: 0,
  errorMessage: null,
  lockedAt: null,
  processedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    outboxEvent: {
      create: createMock,
    },
  }),
}));

describe("outbox subscriber orders integration", () => {
  it("persists outbox event for OrderCreated and OrderStatusChanged", async () => {
    const { registerOutboxEventBusHandlers } = await import(
      "@/modules/notifications/adapters/outbox-subscriber"
    );
    const { publish } = await import("@/infrastructure/events/event-bus");

    registerOutboxEventBusHandlers();

    await publish("OrderCreated", {
      order: {
        id: "ord_01",
        type: "delivery",
        status: "new",
        customerName: "Juan",
        customerWhatsapp: "+50588887777",
        items: [
          {
            id: "item_01",
            productId: "prod_01",
            productName: "Prime Rib Steak",
            quantity: 1,
            unitPrice: 100,
            packagingUnitAmount: 0,
            packagingQuantity: 0,
            packagingTotalAmount: 0,
            modifiers: [],
            notes: null,
            lineTotal: 100,
          },
        ],
        subtotal: 100,
        discount: 0,
        packagingAmount: 0,
        deliveryFeeAmount: 50,
        tipAmount: 10,
        tipRate: 10,
        total: 100,
        createdAt: "2026-06-27T22:53:39.000Z",
        updatedAt: "2026-06-27T22:53:39.000Z",
        address: "Barrio Central",
        deliveryNotes: "Portón negro",
      },
    });
    await publish("OrderStatusChanged", {
      orderId: "ord_01",
      status: "confirmed",
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock.mock.calls[0][0]).toMatchObject({
      data: {
        eventType: "OrderCreated",
        aggregateType: "order",
        aggregateId: "ord_01",
      },
    });
    expect(createMock.mock.calls[1][0]).toMatchObject({
      data: {
        eventType: "OrderStatusChanged",
        aggregateType: "order",
        aggregateId: "ord_01",
      },
    });
  });
});

