import { describe, expect, it } from "vitest";

import type {
  OverviewOrderPerformanceInput,
  OverviewOrderItemInput,
} from "./admin-overview.types";
import {
  aggregateOverviewPerformance,
  calculateChangePercent,
  COMPLETED_ORDER_STATUSES,
  getFirstCompletionAt,
} from "./admin-overview-metrics";
import {
  buildOverviewBucketKeys,
  buildOverviewRanges,
} from "./admin-overview-periods";

const NOW = new Date("2026-07-22T18:30:00.000Z");

function item(
  productId: string,
  productName: string,
  quantity: number,
  lineTotal: number,
): OverviewOrderItemInput {
  return { productId, productName, quantity, lineTotal };
}

function order(
  overrides: Partial<OverviewOrderPerformanceInput> &
    Pick<OverviewOrderPerformanceInput, "id">,
): OverviewOrderPerformanceInput {
  return {
    type: "delivery",
    status: "delivered",
    total: 100,
    statusHistory: [
      { status: "delivered", createdAt: "2026-07-22T16:00:00.000Z" },
    ],
    items: [],
    ...overrides,
  };
}

describe("calculateChangePercent", () => {
  it("calcula el cambio porcentual contra una base distinta de cero", () => {
    expect(calculateChangePercent(150, 100)).toBe(50);
  });

  it("devuelve null cuando no existe base de comparación", () => {
    expect(calculateChangePercent(0, 0)).toBeNull();
    expect(calculateChangePercent(10, 0)).toBeNull();
  });
});

describe("getFirstCompletionAt", () => {
  it("conserva la primera transición terminal aunque después aparezca closed", () => {
    expect(
      getFirstCompletionAt([
        { status: "closed", createdAt: "2026-07-22T17:00:00.000Z" },
        { status: "confirmed", createdAt: "2026-07-22T15:00:00.000Z" },
        { status: "delivered", createdAt: "2026-07-22T16:00:00.000Z" },
      ]),
    ).toEqual(new Date("2026-07-22T16:00:00.000Z"));
  });

  it("devuelve null sin transición terminal", () => {
    expect(
      getFirstCompletionAt([
        { status: "confirmed", createdAt: "2026-07-22T15:00:00.000Z" },
        { status: "preparing", createdAt: "2026-07-22T16:00:00.000Z" },
      ]),
    ).toBeNull();
  });
});

describe("aggregateOverviewPerformance", () => {
  it("agrega solo delivery y pickup completados y usa snapshots de líneas", () => {
    const ranges = buildOverviewRanges("7d", NOW);
    const result = aggregateOverviewPerformance({
      channel: "all",
      ranges,
      buckets: buildOverviewBucketKeys(ranges),
      reservations: [],
      orders: [
        order({
          id: "delivery-current",
          total: 100,
          items: [item("coffee", "Café", 3, 30), item("bun", "Bollo", 2, 22)],
          statusHistory: [
            { status: "delivered", createdAt: "2026-07-22T16:00:00.000Z" },
            { status: "closed", createdAt: "2026-07-22T17:00:00.000Z" },
          ],
        }),
        order({
          id: "pickup-current",
          type: "pickup",
          status: "picked_up",
          total: 50,
          items: [item("arepa", "Arepa", 2, 20)],
          statusHistory: [
            { status: "picked_up", createdAt: "2026-07-21T16:00:00.000Z" },
          ],
        }),
        order({
          id: "cancelled",
          status: "cancelled",
          total: 1_000,
          items: [item("excluded", "Cancelado", 99, 990)],
        }),
        order({
          id: "table",
          type: "table",
          status: "served",
          total: 500,
          items: [item("excluded-table", "Mesa", 50, 500)],
          statusHistory: [
            { status: "served", createdAt: "2026-07-22T16:00:00.000Z" },
          ],
        }),
        order({
          id: "no-longer-terminal",
          status: "preparing",
          total: 200,
          items: [item("excluded-open", "Abierta", 20, 200)],
        }),
        order({
          id: "delivery-previous",
          total: 50,
          items: [item("previous", "Anterior", 5, 50)],
          statusHistory: [
            { status: "delivered", createdAt: "2026-07-15T16:00:00.000Z" },
          ],
        }),
      ],
    });

    expect(COMPLETED_ORDER_STATUSES).toEqual([
      "delivered",
      "picked_up",
      "served",
      "closed",
    ]);
    expect(result.metrics.completedOrderValue).toEqual({
      current: 150,
      previous: 50,
      changePercent: 200,
    });
    expect(result.metrics.completedOrderCount).toEqual({
      current: 2,
      previous: 1,
      changePercent: 100,
    });
    expect(result.topProducts).toEqual([
      {
        productId: "coffee",
        productName: "Café",
        units: 3,
        completedOrderValue: 30,
      },
      {
        productId: "arepa",
        productName: "Arepa",
        units: 2,
        completedOrderValue: 20,
      },
      {
        productId: "bun",
        productName: "Bollo",
        units: 2,
        completedOrderValue: 22,
      },
    ]);
    expect(
      result.series.reduce(
        (totals, point) => ({
          value: totals.value + point.completedOrderValue,
          orders: totals.orders + point.completedOrderCount,
        }),
        { value: 0, orders: 0 },
      ),
    ).toEqual({ value: 150, orders: 2 });
  });
});
