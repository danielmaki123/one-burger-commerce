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
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { refundBaseAmount } from "@/modules/payments/domain/payment-totals";

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
       *
       * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-74`) — y con su **moneda y su snapshot**: `Refund.currency`
       * dice en qué moneda salió la plata y `baseAmount` cuánto valía en la moneda base. Restar el monto
       * crudo era restar 20 a un pedido en córdobas por una devolución de `US$20`.
       */
      refunds: {
        where: { status: "approved" },
        select: {
          amount: true,
          currency: true,
          baseCurrencyCode: true,
          exchangeRate: true,
          baseAmount: true,
        },
      },
    },
  });

  /**
   * `A-74` — la moneda en la que está expresado el neto. Sale de la configuración del negocio: convertir una
   * devolución en dólares contra un neto en córdobas necesita saber cuál es la moneda base, y `money` es su
   * dueño.
   *
   * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — y sale de **`money`**, no de
   * `BusinessSettings.currencyCode`: la autoridad monetaria es una sola, y el dashboard **no** convierte
   * (sólo consume el equivalente ya congelado de cada devolución).
   */
  const money = await readProductionMoney();
  const baseCurrencyCode = money.context.baseCurrencyCode;

  const data = aggregateOverviewPerformance({
    channel,
    ranges,
    buckets,
    orders: orders.map((order) => ({
      id: order.id,
      type: order.type,
      status: order.status,
      total: toNumber(order.total),
      /**
       * La devolución se convierte con **su** snapshot. Una devolución legacy cuyo equivalente no se puede
       * demostrar devuelve `null` y **no** se resta: el neto no inventa una equivalencia (`D-020`). El
       * hallazgo (`A-74`) queda cerrado; que esa devolución legacy no se pueda imputar es una decisión de
       * producto declarada, no un número inventado.
       */
      refundedAmount: (order.refunds ?? []).reduce(
        (sum, refund) =>
          sum +
          (refundBaseAmount({
            refund: {
              amount: toNumber(refund.amount),
              currency: refund.currency,
              baseCurrencyCode: refund.baseCurrencyCode,
              baseAmount: refund.baseAmount === null ? null : toNumber(refund.baseAmount),
            },
            baseCurrencyCode,
          }) ?? 0),
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
