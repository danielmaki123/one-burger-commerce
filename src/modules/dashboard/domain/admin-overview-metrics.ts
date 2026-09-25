import type { OrderStatus } from "@/modules/orders/domain/order.types";
import { roundCurrency } from "@/shared/lib/order-totals";

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

/**
 * TASK-AUD-015 (`A-58`) — **la única semántica económica del panel**: el valor de un pedido es su **neto**.
 *
 * `total − importe devuelto o invalidado`, nunca negativo (una devolución mayor al total no puede prestarle
 * plata a la métrica). Es el número que usan ventas, ticket promedio, series, comparaciones y cualquier
 * agregado futuro por sucursal, cajero o producto: no se parchea cada KPI por separado.
 *
 * Un pedido con neto 0 **no es una venta**: no entra en el conteo del ticket promedio ni en el ranking.
 * `null` cuando el pedido no cuenta (todo devuelto/invalidado), para que quien consuma no pueda tratarlo
 * como un cero más.
 */
export function netOrderValue(order: {
  total: number;
  refundedAmount?: number;
}): number {
  const refunded = order.refundedAmount ?? 0;

  if (!Number.isFinite(refunded) || refunded <= 0) {
    return roundCurrency(order.total);
  }

  const net = roundCurrency(order.total - refunded);

  return net > 0 ? net : 0;
}

/**
 * TASK-AUD-015 — ¿el pedido cuenta como venta para el ticket promedio?
 *
 * Un pedido **sin** devoluciones siempre cuenta (una venta de C$0 es una venta completada). Uno con
 * devoluciones cuenta solo si le quedó algo: si se devolvió todo, no es una venta y no puede inflar el
 * promedio.
 */
export function countsAsSale(order: { total: number; refundedAmount?: number }): boolean {
  const refunded = order.refundedAmount ?? 0;

  if (!Number.isFinite(refunded) || refunded <= 0) return true;

  return netOrderValue(order) > 0;
}

/** ¿Su desglose por producto es demostrable? Con devoluciones, el modelo no sabe qué ítems se devolvieron. */
function hasDemonstrableItems(order: { refundedAmount?: number }): boolean {
  return !(order.refundedAmount && order.refundedAmount > 0);
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
    /** El valor con el que este pedido entra a la métrica (su neto). */
    netValue: number;
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

    const entry = { order, completedAt, netValue: netOrderValue(order) };

    if (isWithinUtcRange(completedAt, input.ranges.current)) {
      currentOrders.push(entry);
    } else if (isWithinUtcRange(completedAt, input.ranges.previous)) {
      previousOrders.push(entry);
    }
  }

  /**
   * TASK-AUD-015 — solo las ventas **netas** cuentan: un pedido reembolsado del todo no aporta valor ni
   * cuenta como venta para el ticket promedio.
   */
  const soldCurrent = currentOrders.filter(({ order }) => countsAsSale(order));
  const soldPrevious = previousOrders.filter(({ order }) => countsAsSale(order));

  const currentValue = soldCurrent.reduce((total, { netValue }) => total + netValue, 0);
  const previousValue = soldPrevious.reduce((total, { netValue }) => total + netValue, 0);
  const currentCount = soldCurrent.length;
  const previousCount = soldPrevious.length;
  const currentAverage = currentCount === 0 ? 0 : currentValue / currentCount;
  const previousAverage =
    previousCount === 0 ? 0 : previousValue / previousCount;

  const series = input.buckets.map((bucket) => {
    const orders = soldCurrent.filter(({ completedAt }) =>
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
        (total, { netValue }) => total + netValue,
        0,
      ),
      completedOrderCount: orders.length,
    };
  });

  const productTotals = new Map<string, OverviewTopProduct>();
  for (const { order } of soldCurrent) {
    /**
     * TASK-AUD-015 — **limitación declarada**: el modelo no guarda qué ítems se devolvieron, así que un
     * pedido con devoluciones no entra en el desglose por producto. Un número aparentemente preciso pero no
     * demostrable es peor que omitirlo; el neto del pedido ya está en las métricas comerciales.
     */
    if (!hasDemonstrableItems(order)) {
      continue;
    }

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
