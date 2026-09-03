import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { ActivityItem } from "@/modules/dashboard/domain/dashboard.types";

export async function getRecentActivity(limit: number): Promise<{
  data: ActivityItem[];
  meta: { limit: number; count: number };
}> {
  const prisma = getPrismaClient();
  const take = Math.min(Math.max(limit, 1), 100);

  const [orders, reservations, counts, receives, wastes] = await Promise.all([
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, orderNumber: true, status: true, createdAt: true, customerName: true },
    }),
    prisma.reservation.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, status: true, createdAt: true, customerName: true, date: true, time: true },
    }),
    prisma.inventoryCount.findMany({
      orderBy: { countedAt: "desc" },
      take,
      select: { id: true, countedAt: true, inventoryItem: { select: { name: true } } },
    }),
    prisma.inventoryReceiveRecord.findMany({
      orderBy: { receivedAt: "desc" },
      take,
      select: { id: true, receivedAt: true, inventoryItem: { select: { name: true } } },
    }),
    prisma.inventoryWasteRecord.findMany({
      orderBy: { reportedAt: "desc" },
      take,
      select: { id: true, reportedAt: true, reason: true, inventoryItem: { select: { name: true } } },
    }),
  ]);

  const activities: ActivityItem[] = [
    ...orders.map((o: {
      id: string;
      orderNumber: string;
      status: string;
      createdAt: Date;
      customerName: string;
    }) => ({
      type: "order" as const,
      id: o.id,
      description: `Orden ${o.orderNumber} - ${o.status} (${o.customerName})`,
      occurredAt: o.createdAt.toISOString(),
    })),
    ...reservations.map((r: {
      id: string;
      status: string;
      createdAt: Date;
      customerName: string;
      date: string;
      time: string;
    }) => ({
      type: "reservation" as const,
      id: r.id,
      description: `Reserva ${r.date} ${r.time} - ${r.status} (${r.customerName})`,
      occurredAt: r.createdAt.toISOString(),
    })),
    ...counts.map((c: {
      id: string;
      countedAt: Date;
      inventoryItem: { name: string };
    }) => ({
      type: "inventory" as const,
      id: c.id,
      description: `Conteo: ${c.inventoryItem.name}`,
      occurredAt: c.countedAt.toISOString(),
    })),
    ...receives.map((r: {
      id: string;
      receivedAt: Date;
      inventoryItem: { name: string };
    }) => ({
      type: "inventory" as const,
      id: r.id,
      description: `Recepcion: ${r.inventoryItem.name}`,
      occurredAt: r.receivedAt.toISOString(),
    })),
    ...wastes.map((w: {
      id: string;
      reportedAt: Date;
      reason: string;
      inventoryItem: { name: string };
    }) => ({
      type: "inventory" as const,
      id: w.id,
      description: `Merma: ${w.inventoryItem.name} - ${w.reason}`,
      occurredAt: w.reportedAt.toISOString(),
    })),
  ];

  activities.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );

  const sliced = activities.slice(0, take);

  return {
    data: sliced,
    meta: { limit: take, count: sliced.length },
  };
}
