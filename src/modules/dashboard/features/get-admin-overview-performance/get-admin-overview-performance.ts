import { getPrismaClient } from "@/infrastructure/database/prisma";
import {
  aggregateOverviewPerformance,
  COMPLETED_ORDER_STATUSES,
} from "@/modules/dashboard/domain/admin-overview-metrics";
import {
  buildOverviewBucketKeys,
  buildOverviewRanges,
  OVERVIEW_TIME_ZONE,
} from "@/modules/dashboard/domain/admin-overview-periods";
import type {
  AdminOverviewPerformanceResponse,
  OverviewChannel,
  OverviewPeriod,
  OverviewRange,
} from "@/modules/dashboard/domain/admin-overview.types";

function serializeRange(range: OverviewRange) {
  return {
    localStartDate: range.localStartDate,
    localEndDate: range.localEndDate,
    utcStart: range.utcStart.toISOString(),
    utcEnd: range.utcEnd.toISOString(),
  };
}

function toNumber(value: { toString(): string }): number {
  return Number(value.toString());
}

export async function getAdminOverviewPerformance(
  period: OverviewPeriod,
  channel: OverviewChannel,
  now = new Date(),
): Promise<AdminOverviewPerformanceResponse> {
  const prisma = getPrismaClient();
  const ranges = buildOverviewRanges(period, now);
  const buckets = buildOverviewBucketKeys(ranges);
  const terminalStatuses = [...COMPLETED_ORDER_STATUSES];

  const orders = await prisma.order.findMany({
    where: {
      type: channel === "all" ? { in: ["delivery", "pickup"] } : channel,
      status: { in: terminalStatuses },
      statusHistory: {
        some: {
          status: { in: terminalStatuses },
          createdAt: {
            gte: ranges.previous.utcStart,
            lt: ranges.current.utcEnd,
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
        where: { status: { in: terminalStatuses } },
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

  const data = aggregateOverviewPerformance({
    channel,
    ranges,
    buckets,
    orders: orders.map((order) => ({
      id: order.id,
      type: order.type,
      status: order.status,
      total: toNumber(order.total),
      statusHistory: order.statusHistory,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        lineTotal: toNumber(item.lineTotal),
      })),
    })),
  });

  return {
    data,
    meta: {
      generatedAt: now.toISOString(),
      timeZone: OVERVIEW_TIME_ZONE,
      period,
      channel,
      ranges: {
        current: serializeRange(ranges.current),
        previous: serializeRange(ranges.previous),
      },
    },
  };
}
