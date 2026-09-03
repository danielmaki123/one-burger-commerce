import { getPrismaClient } from "@/infrastructure/database/prisma";
import {
  formatManaguaDate,
  OVERVIEW_TIME_ZONE,
} from "@/modules/dashboard/domain/admin-overview-periods";
import type { AdminOverviewOperationsResponse } from "@/modules/dashboard/domain/admin-overview.types";

const CLOSED_ORDER_STATUSES = [
  "delivered",
  "picked_up",
  "served",
  "closed",
  "cancelled",
] as const;

const ORDERS_PENDING_ACTION_STATUSES = [
  "new",
  "confirmed",
  "preparing",
] as const;

export async function getAdminOverviewOperations(
  now = new Date(),
): Promise<AdminOverviewOperationsResponse> {
  const prisma = getPrismaClient();
  const localDate = formatManaguaDate(now);

  const [
    openOrders,
    ordersPendingAction,
    reservationsToday,
    reservationsPendingAction,
  ] = await Promise.all([
    prisma.order.count({
      where: { status: { notIn: [...CLOSED_ORDER_STATUSES] } },
    }),
    prisma.order.count({
      where: { status: { in: [...ORDERS_PENDING_ACTION_STATUSES] } },
    }),
    prisma.reservation.count({
      where: {
        date: localDate,
        status: { notIn: ["rejected", "cancelled"] },
      },
    }),
    prisma.reservation.count({
      where: { date: localDate, status: "requested" },
    }),
  ]);

  return {
    data: {
      openOrders,
      ordersPendingAction,
      reservationsToday,
      reservationsPendingAction,
    },
    meta: {
      generatedAt: now.toISOString(),
      timeZone: OVERVIEW_TIME_ZONE,
      localDate,
    },
  };
}
