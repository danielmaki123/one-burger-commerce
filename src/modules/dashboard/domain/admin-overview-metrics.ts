import type { OrderStatus } from "@/modules/orders/domain/order.types";

import type {
  AggregateOverviewInput,
  CompletionHistoryItem,
  OverviewMetricComparison,
  OverviewPerformanceData,
  OverviewRange,
  OverviewTopProduct,
} from "./admin-overview.types";

export const COMPLETED_ORDER_STATUSES: readonly OrderStatus[] = [
  "delivered",
  "picked_up",
  "served",
  "closed",
];

export function calculateChangePercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

export function getFirstCompletionAt(
  history: CompletionHistoryItem[],
): Date | null {
  let firstCompletion: Date | null = null;

  for (const item of history) {
    if (!COMPLETED_ORDER_STATUSES.includes(item.status)) {
      continue;
    }

    const createdAt = new Date(item.createdAt);
    if (!Number.isFinite(createdAt.getTime())) {
      continue;
    }

    if (firstCompletion === null || createdAt < firstCompletion) {
      firstCompletion = createdAt;
    }
  }

  return firstCompletion;
}

function isWithinUtcRange(date: Date, range: OverviewRange): boolean {
  return date >= range.utcStart && date < range.utcEnd;
}

function buildComparison(
  current: number,
  previous: number,
): OverviewMetricComparison {
  return {
    current,
    previous,
    changePercent: calculateChangePercent(current, previous),
  };
}

export function aggregateOverviewPerformance(
  input: AggregateOverviewInput,
): OverviewPerformanceData {
  const currentOrders: Array<{
    order: AggregateOverviewInput["orders"][number];
    completedAt: Date;
  }> = [];
  const previousOrders: typeof currentOrders = [];

  for (const order of input.orders) {
    const channelMatches =
      order.type !== "table" &&
      (input.channel === "all" || order.type === input.channel);
    if (
      !channelMatches ||
      !COMPLETED_ORDER_STATUSES.includes(order.status)
    ) {
      continue;
    }

    const completedAt = getFirstCompletionAt(order.statusHistory);
    if (completedAt === null) {
      continue;
    }

    if (isWithinUtcRange(completedAt, input.ranges.current)) {
      currentOrders.push({ order, completedAt });
    } else if (isWithinUtcRange(completedAt, input.ranges.previous)) {
      previousOrders.push({ order, completedAt });
    }
  }

  const currentValue = currentOrders.reduce(
    (total, { order }) => total + order.total,
    0,
  );
  const previousValue = previousOrders.reduce(
    (total, { order }) => total + order.total,
    0,
  );
  const currentCount = currentOrders.length;
  const previousCount = previousOrders.length;
  const currentAverage = currentCount === 0 ? 0 : currentValue / currentCount;
  const previousAverage =
    previousCount === 0 ? 0 : previousValue / previousCount;

  const series = input.buckets.map((bucket) => {
    const orders = currentOrders.filter(({ completedAt }) =>
      isWithinUtcRange(completedAt, {
        localStartDate: bucket.localDate,
        localEndDate: bucket.localDate,
        utcStart: bucket.utcStart,
        utcEnd: bucket.utcEnd,
      }),
    );

    return {
      key: bucket.key,
      label: bucket.label,
      completedOrderValue: orders.reduce(
        (total, { order }) => total + order.total,
        0,
      ),
      completedOrderCount: orders.length,
    };
  });

  const productTotals = new Map<string, OverviewTopProduct>();
  for (const { order } of currentOrders) {
    for (const item of order.items) {
      const existing = productTotals.get(item.productId);
      if (existing) {
        existing.units += item.quantity;
        existing.completedOrderValue += item.lineTotal;
      } else {
        productTotals.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          units: item.quantity,
          completedOrderValue: item.lineTotal,
        });
      }
    }
  }

  const topProducts = [...productTotals.values()].sort(
    (left, right) =>
      right.units - left.units ||
      left.productName.localeCompare(right.productName, "es", {
        sensitivity: "base",
      }) ||
      left.productId.localeCompare(right.productId),
  );

  return {
    metrics: {
      completedOrderValue: buildComparison(currentValue, previousValue),
      completedOrderCount: buildComparison(currentCount, previousCount),
      averageTicket: buildComparison(currentAverage, previousAverage),
    },
    series,
    topProducts,
  };
}
