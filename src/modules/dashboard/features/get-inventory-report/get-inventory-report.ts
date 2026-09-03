import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { InventoryReport } from "@/modules/dashboard/domain/dashboard.types";

export async function getInventoryReport(dateFrom: string, dateTo: string): Promise<{
  data: InventoryReport;
  meta: { dateFrom: string; dateTo: string };
}> {
  const prisma = getPrismaClient();

  const fromDate = new Date(dateFrom);
  const toDate = new Date(dateTo);
  toDate.setHours(23, 59, 59, 999);

  const [counts, receives, wastes, items] = await Promise.all([
    prisma.inventoryCount.findMany({
      where: { countedAt: { gte: fromDate, lte: toDate } },
      select: {
        inventoryItemId: true,
        countedQuantity: true,
        inventoryItem: { select: { name: true } },
      },
    }),
    prisma.inventoryReceiveRecord.findMany({
      where: { receivedAt: { gte: fromDate, lte: toDate } },
      select: {
        inventoryItemId: true,
        receivedQuantity: true,
        inventoryItem: { select: { name: true } },
      },
    }),
    prisma.inventoryWasteRecord.findMany({
      where: { reportedAt: { gte: fromDate, lte: toDate } },
      select: {
        inventoryItemId: true,
        quantity: true,
        inventoryItem: { select: { name: true } },
      },
    }),
    prisma.inventoryItem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }),
  ]);

  const netMap = new Map<string, { name: string; net: number }>();

  for (const count of counts) {
    const entry = netMap.get(count.inventoryItemId) || {
      name: count.inventoryItem.name,
      net: 0,
    };
    // counts set absolute stock; net change not directly additive
    // for simplicity, treat counts as 0 net in this report or skip
    netMap.set(count.inventoryItemId, entry);
  }

  for (const receive of receives) {
    const entry = netMap.get(receive.inventoryItemId) || {
      name: receive.inventoryItem.name,
      net: 0,
    };
    entry.net += Number(receive.receivedQuantity.toString());
    netMap.set(receive.inventoryItemId, entry);
  }

  for (const waste of wastes) {
    const entry = netMap.get(waste.inventoryItemId) || {
      name: waste.inventoryItem.name,
      net: 0,
    };
    entry.net -= Number(waste.quantity.toString());
    netMap.set(waste.inventoryItemId, entry);
  }

  const itemsReport = Array.from(netMap.entries()).map(([itemId, value]) => ({
    itemId,
    itemName: value.name,
    netChange: value.net,
  }));

  // Include items with no movement as zero net change
  for (const item of items) {
    if (!netMap.has(item.id)) {
      itemsReport.push({
        itemId: item.id,
        itemName: item.name,
        netChange: 0,
      });
    }
  }

  itemsReport.sort((a, b) => a.itemName.localeCompare(b.itemName));

  return {
    data: {
      movements: {
        counts: counts.length,
        receives: receives.length,
        wastes: wastes.length,
        total: counts.length + receives.length + wastes.length,
      },
      items: itemsReport,
    },
    meta: { dateFrom, dateTo },
  };
}
