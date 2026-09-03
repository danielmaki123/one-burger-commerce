import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { DailyReport } from "@/modules/dashboard/domain/dashboard.types";

export async function getDailyReport(dateFrom: string, dateTo: string): Promise<{
  data: DailyReport;
  meta: { dateFrom: string; dateTo: string };
}> {
  const prisma = getPrismaClient();

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  const [orders, reservations] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        status: true,
        total: true,
      },
    }),
    prisma.reservation.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
      },
      select: {
        status: true,
      },
    }),
  ]);

  const ordersByStatus: Record<string, number> = {};
  let totalRevenue = 0;
  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] || 0) + 1;
    totalRevenue += Number(order.total.toString());
  }

  const reservationsByStatus: Record<string, number> = {};
  for (const reservation of reservations) {
    reservationsByStatus[reservation.status] = (reservationsByStatus[reservation.status] || 0) + 1;
  }

  return {
    data: {
      orders: {
        totalCount: orders.length,
        totalRevenue,
        byStatus: ordersByStatus,
      },
      reservations: {
        totalCount: reservations.length,
        byStatus: reservationsByStatus,
      },
    },
    meta: { dateFrom, dateTo },
  };
}
