import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindManyMock = vi.fn();
const reservationFindManyMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    order: {
      findMany: orderFindManyMock,
    },
    reservation: {
      findMany: reservationFindManyMock,
    },
  }),
}));

import { getAdminOverviewPerformance } from "./get-admin-overview-performance";

function decimal(value: number) {
  return { toString: () => value.toString() };
}

describe("getAdminOverviewPerformance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("aggregates first terminal transitions, snapshots and reservations across current and previous ranges", async () => {
    orderFindManyMock.mockResolvedValueOnce([
      {
        id: "current-delivery",
        type: "delivery",
        status: "closed",
        total: decimal(100),
        statusHistory: [
          { status: "delivered", createdAt: new Date("2026-07-20T15:00:00.000Z") },
          { status: "closed", createdAt: new Date("2026-07-20T16:00:00.000Z") },
        ],
        items: [
          { productId: "product-a", productName: "Tostada", quantity: 2, lineTotal: decimal(80) },
          { productId: "product-b", productName: "Café", quantity: 1, lineTotal: decimal(20) },
        ],
      },
      {
        id: "previous-pickup",
        type: "pickup",
        status: "picked_up",
        total: decimal(50),
        statusHistory: [
          { status: "picked_up", createdAt: new Date("2026-07-14T12:00:00.000Z") },
          { status: "closed", createdAt: new Date("2026-07-14T13:00:00.000Z") },
        ],
        items: [
          { productId: "product-a", productName: "Tostada", quantity: 1, lineTotal: decimal(50) },
        ],
      },
      {
        id: "first-completion-outside",
        type: "delivery",
        status: "closed",
        total: decimal(75),
        statusHistory: [
          { status: "delivered", createdAt: new Date("2026-07-08T12:00:00.000Z") },
          { status: "closed", createdAt: new Date("2026-07-10T12:00:00.000Z") },
        ],
        items: [
          { productId: "product-c", productName: "Sopa", quantity: 1, lineTotal: decimal(75) },
        ],
      },
      {
        id: "table-order",
        type: "table",
        status: "served",
        total: decimal(500),
        statusHistory: [
          { status: "served", createdAt: new Date("2026-07-20T17:00:00.000Z") },
        ],
        items: [
          { productId: "product-d", productName: "Mesa", quantity: 10, lineTotal: decimal(500) },
        ],
      },
      {
        id: "cancelled-order",
        type: "delivery",
        status: "cancelled",
        total: decimal(300),
        statusHistory: [
          { status: "delivered", createdAt: new Date("2026-07-21T15:00:00.000Z") },
        ],
        items: [
          { productId: "product-e", productName: "Cancelado", quantity: 5, lineTotal: decimal(300) },
        ],
      },
    ]);
    reservationFindManyMock.mockResolvedValueOnce([
      { status: "requested", date: "2026-07-21", createdAt: new Date("2026-07-18T10:00:00.000Z") },
      { status: "approved", date: "2026-07-22", createdAt: new Date("2026-07-22T11:00:00.000Z") },
      { status: "rejected", date: "2026-07-20", createdAt: new Date("2026-07-19T11:00:00.000Z") },
      { status: "seated", date: "2026-07-14", createdAt: new Date("2026-07-13T11:00:00.000Z") },
    ]);
    const now = new Date("2026-07-22T18:30:00.000Z");

    const result = await getAdminOverviewPerformance("7d", "all", now);

    expect(result.data.metrics).toEqual({
      completedOrderValue: { current: 100, previous: 50, changePercent: 100 },
      completedOrderCount: { current: 1, previous: 1, changePercent: 0 },
      averageTicket: { current: 100, previous: 50, changePercent: 100 },
      activeReservations: { current: 1, previous: 1, changePercent: 0 },
    });
    expect(result.data.series).toHaveLength(7);
    expect(result.data.series.filter((point) => point.completedOrderCount > 0)).toEqual([
      {
        key: "2026-07-20",
        label: "07-20",
        completedOrderValue: 100,
        completedOrderCount: 1,
      },
    ]);
    expect(result.data.series[0]).toEqual({
      key: "2026-07-16",
      label: "07-16",
      completedOrderValue: 0,
      completedOrderCount: 0,
    });
    expect(result.data.reservations).toEqual({
      requestsReceived: 3,
      active: 1,
      byStatus: {
        requested: 1,
        approved: 1,
        rejected: 1,
        seated: 0,
        cancelled: 0,
        no_show: 0,
      },
    });
    expect(result.data.topProducts).toEqual([
      {
        productId: "product-a",
        productName: "Tostada",
        units: 2,
        completedOrderValue: 80,
      },
      {
        productId: "product-b",
        productName: "Café",
        units: 1,
        completedOrderValue: 20,
      },
    ]);
    expect(result.meta).toEqual({
      generatedAt: "2026-07-22T18:30:00.000Z",
      timeZone: "America/Managua",
      period: "7d",
      channel: "all",
      ranges: {
        current: {
          localStartDate: "2026-07-16",
          localEndDate: "2026-07-22",
          utcStart: "2026-07-16T06:00:00.000Z",
          utcEnd: "2026-07-23T06:00:00.000Z",
        },
        previous: {
          localStartDate: "2026-07-09",
          localEndDate: "2026-07-15",
          utcStart: "2026-07-09T06:00:00.000Z",
          utcEnd: "2026-07-16T06:00:00.000Z",
        },
      },
    });
    expect(orderFindManyMock).toHaveBeenCalledWith({
      where: {
        type: { in: ["delivery", "pickup"] },
        status: { in: ["delivered", "picked_up", "served", "closed"] },
        statusHistory: {
          some: {
            status: { in: ["delivered", "picked_up", "served", "closed"] },
            createdAt: {
              gte: new Date("2026-07-09T06:00:00.000Z"),
              lt: new Date("2026-07-23T06:00:00.000Z"),
            },
          },
        },
      },
      select: {
        id: true,
        type: true,
        status: true,
        total: true,
        statusHistory: {
          where: { status: { in: ["delivered", "picked_up", "served", "closed"] } },
          select: { status: true, createdAt: true },
        },
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            lineTotal: true,
          },
        },
      },
    });
    expect(reservationFindManyMock).toHaveBeenCalledWith({
      where: {
        OR: [
          { date: { gte: "2026-07-09", lt: "2026-07-23" } },
          {
            createdAt: {
              gte: new Date("2026-07-16T06:00:00.000Z"),
              lt: new Date("2026-07-23T06:00:00.000Z"),
            },
          },
        ],
      },
      select: { status: true, date: true, createdAt: true },
    });
  });

  it("uses the selected permitted channel without broadening to table", async () => {
    orderFindManyMock.mockResolvedValueOnce([]);
    reservationFindManyMock.mockResolvedValueOnce([]);

    const result = await getAdminOverviewPerformance(
      "today",
      "pickup",
      new Date("2026-07-22T18:30:00.000Z"),
    );

    expect(result.data.metrics.completedOrderCount.current).toBe(0);
    expect(result.data.series).toHaveLength(24);
    expect(orderFindManyMock.mock.calls[0][0].where.type).toBe("pickup");
  });
});
