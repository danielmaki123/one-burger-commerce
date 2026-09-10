import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  outboxEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => prismaMock,
}));

describe("PrismaOutboxRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("locks newest pending events first", async () => {
    prismaMock.outboxEvent.findMany
      .mockResolvedValueOnce([
        {
          id: "evt_new",
          eventType: "OrderCreated",
          aggregateType: "order",
          aggregateId: "ord_new",
          status: "pending",
          payload: {},
          attemptCount: 0,
          errorMessage: null,
          lockedAt: null,
          processedAt: null,
          createdAt: new Date("2026-06-24T22:17:01.000Z"),
          updatedAt: new Date("2026-06-24T22:17:01.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "evt_new",
          eventType: "OrderCreated",
          aggregateType: "order",
          aggregateId: "ord_new",
          status: "processing",
          payload: {},
          attemptCount: 0,
          errorMessage: null,
          lockedAt: new Date("2026-06-24T22:17:05.000Z"),
          processedAt: null,
          createdAt: new Date("2026-06-24T22:17:01.000Z"),
          updatedAt: new Date("2026-06-24T22:17:05.000Z"),
        },
      ]);
    prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    const { PrismaOutboxRepository } = await import("./prisma-outbox-repository");
    const repository = new PrismaOutboxRepository();

    const result = await repository.lockPendingEvents(1);

    expect(prismaMock.outboxEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    );
    expect(prismaMock.outboxEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: { in: ["evt_new"] } },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(prismaMock.outboxEvent.updateMany).toHaveBeenCalledWith({
      where: { id: "evt_new", status: "pending" },
      data: { status: "processing", lockedAt: expect.any(Date) },
    });
    expect(result[0]?.id).toBe("evt_new");
  });

  it("claims each event atomically and skips the ones another processor already took", async () => {
    const buildEvent = (id: string, status: string) => ({
      id,
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: `ord_${id}`,
      status,
      payload: {},
      attemptCount: 0,
      errorMessage: null,
      lockedAt: null,
      processedAt: null,
      createdAt: new Date("2026-06-24T22:17:01.000Z"),
      updatedAt: new Date("2026-06-24T22:17:01.000Z"),
    });

    prismaMock.outboxEvent.findMany
      .mockResolvedValueOnce([
        buildEvent("evt_won", "pending"),
        buildEvent("evt_lost", "pending"),
      ])
      .mockResolvedValueOnce([buildEvent("evt_won", "processing")]);
    prismaMock.outboxEvent.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const { PrismaOutboxRepository } = await import("./prisma-outbox-repository");
    const repository = new PrismaOutboxRepository();

    const result = await repository.lockPendingEvents(2);

    expect(prismaMock.outboxEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "evt_won", status: "pending" },
      data: { status: "processing", lockedAt: expect.any(Date) },
    });
    expect(prismaMock.outboxEvent.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "evt_lost", status: "pending" },
      data: { status: "processing", lockedAt: expect.any(Date) },
    });
    expect(prismaMock.outboxEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: { in: ["evt_won"] } } }),
    );
    expect(result.map((event) => event.id)).toEqual(["evt_won"]);
  });

  it("applies event type allowlist and minCreatedAt cutoff when locking", async () => {
    prismaMock.outboxEvent.findMany
      .mockResolvedValueOnce([
        {
          id: "evt_allowed",
          eventType: "OrderCreated",
          aggregateType: "order",
          aggregateId: "ord_allowed",
          status: "pending",
          payload: {},
          attemptCount: 0,
          errorMessage: null,
          lockedAt: null,
          processedAt: null,
          createdAt: new Date("2026-06-24T22:17:01.000Z"),
          updatedAt: new Date("2026-06-24T22:17:01.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "evt_allowed",
          eventType: "OrderCreated",
          aggregateType: "order",
          aggregateId: "ord_allowed",
          status: "processing",
          payload: {},
          attemptCount: 0,
          errorMessage: null,
          lockedAt: new Date("2026-06-24T22:17:05.000Z"),
          processedAt: null,
          createdAt: new Date("2026-06-24T22:17:01.000Z"),
          updatedAt: new Date("2026-06-24T22:17:05.000Z"),
        },
      ]);
    prismaMock.outboxEvent.updateMany.mockResolvedValue({ count: 1 });

    const { PrismaOutboxRepository } = await import("./prisma-outbox-repository");
    const repository = new PrismaOutboxRepository();

    await repository.lockPendingEvents(1, {
      eventTypes: ["OrderCreated", "ReservationCreated"],
      minCreatedAt: "2026-06-24T22:00:00.000Z",
    });

    expect(prismaMock.outboxEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: "pending",
          eventType: { in: ["OrderCreated", "ReservationCreated"] },
          createdAt: { gte: new Date("2026-06-24T22:00:00.000Z") },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    );
  });
});
