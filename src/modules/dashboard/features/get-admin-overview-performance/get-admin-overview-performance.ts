import { getPrismaClient } from "@/infrastructure/database/prisma";
import {
  aggregateOverviewPerformance,
  COMPLETED_ORDER_STATUSES,
} from "@/modules/dashboard/domain/admin-overview-metrics";
import {
  buildOverviewBucketKeys,
  buildOverviewRanges,
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

/**
 * Tablero de operación del rango pedido.
 *
 * `timeZone` es la del **negocio** (configuración) y es obligatoria: el día natural, los
 * rangos y los buckets se calculan en esa zona. Antes estaba fija en `America/Managua`.
 */
export async function getAdminOverviewPerformance(
  period: OverviewPeriod,
  channel: OverviewChannel,
  timeZone: string,
  now = new Date(),
): Promise<AdminOverviewPerformanceResponse> {
  const prisma = getPrismaClient();
  const ranges = buildOverviewRanges(period, now, timeZone);
  const buckets = buildOverviewBucketKeys(ranges, timeZone);
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
      /**
       * TASK-AUD-015 (`A-58`) — el importe devuelto de cada pedido, para que la métrica use el **neto**.
       * Solo las devoluciones **aprobadas** son dinero que salio del negocio.
       */
      refunds: {
        where: { status: "approved" },
        select: { amount: true },
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
      refundedAmount: (order.refunds ?? []).reduce(
        (sum, refund) => sum + toNumber(refund.amount),
        0,
      ),
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
      timeZone,
      period,
      channel,
      ranges: {
        current: serializeRange(ranges.current),
        previous: serializeRange(ranges.previous),
      },
    },
  };
}
