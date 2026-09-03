import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { DashboardSummary } from "@/modules/dashboard/domain/dashboard.types";

function startOfDay(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getDashboardSummary(): Promise<{
  data: DashboardSummary;
  meta: { generatedAt: string };
}> {
  const prisma = getPrismaClient();
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const todayStr = toISODate(now);
  const recentCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    ordersToday,
    ordersPending,
    reservationsToday,
    reservationsPendingAction,
    inventoryItems,
    recentCounts,
    recentReceives,
    recentWastes,
    recentOrders,
    recentReservations,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
    }),
    prisma.order.count({
      where: {
        status: { in: ["new", "confirmed", "preparing"] },
      },
    }),
    prisma.reservation.count({
      where: { date: todayStr },
    }),
    prisma.reservation.count({
      where: { status: "requested" },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        currentEstimatedStock: true,
        lowStockThreshold: true,
      },
    }),
    prisma.inventoryCount.count({
      where: { countedAt: { gte: recentCutoff } },
    }),
    prisma.inventoryReceiveRecord.count({
      where: { receivedAt: { gte: recentCutoff } },
    }),
    prisma.inventoryWasteRecord.count({
      where: { reportedAt: { gte: recentCutoff } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: recentCutoff } },
    }),
    prisma.reservation.count({
      where: { createdAt: { gte: recentCutoff } },
    }),
  ]);

  const inventoryCriticalAlerts = inventoryItems.filter((item: {
    currentEstimatedStock: { toString(): string };
  }) => {
    const current = Number(item.currentEstimatedStock.toString());
    return current === 0;
  }).length;

  const recentActivityCount =
    recentCounts + recentReceives + recentWastes + recentOrders + recentReservations;

  return {
    data: {
      ordersToday,
      ordersPending,
      reservationsToday,
      reservationsPendingAction,
      inventoryCriticalAlerts,
      recentActivityCount,
    },
    meta: {
      generatedAt: now.toISOString(),
    },
  };
}
