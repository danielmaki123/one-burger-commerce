import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type {
  InventoryAlert,
  InventoryCountRecord,
  InventoryItemRecord,
  InventoryMovementRecord,
  InventoryReceiveRecord,
  InventoryWasteRecord,
} from "@/modules/inventory/domain/inventory.types";
import type {
  CreateInventoryCountInput,
  CreateInventoryItemInput,
  CreateInventoryReceiveInput,
  CreateInventoryWasteInput,
  InventoryRepository,
  ListInventoryMovementsFilter,
  ListInventoryItemsFilter,
} from "@/modules/inventory/ports/inventory-repository";
import { InventoryError } from "@/modules/inventory/domain/inventory-errors";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function mapItem(item: {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentEstimatedStock: Decimal;
  lowStockThreshold: Decimal;
  isActive: boolean;
  locationId: string;
  createdAt: Date;
  updatedAt: Date;
}): InventoryItemRecord {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    category: item.category,
    currentEstimatedStock: decimalToNumber(item.currentEstimatedStock),
    lowStockThreshold: decimalToNumber(item.lowStockThreshold),
    isActive: item.isActive,
    locationId: item.locationId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapCount(count: {
  id: string;
  inventoryItemId: string;
  countedQuantity: Decimal;
  countedByUserId: string;
  countedAt: Date;
  notes: string | null;
  createdAt: Date;
}): InventoryCountRecord {
  return {
    id: count.id,
    inventoryItemId: count.inventoryItemId,
    countedQuantity: decimalToNumber(count.countedQuantity),
    countedByUserId: count.countedByUserId,
    countedAt: count.countedAt,
    notes: count.notes,
    createdAt: count.createdAt,
  };
}

function mapWaste(waste: {
  id: string;
  inventoryItemId: string;
  quantity: Decimal;
  reason: string;
  reportedByUserId: string;
  reportedAt: Date;
  notes: string | null;
  createdAt: Date;
}): InventoryWasteRecord {
  return {
    id: waste.id,
    inventoryItemId: waste.inventoryItemId,
    quantity: decimalToNumber(waste.quantity),
    reason: waste.reason,
    reportedByUserId: waste.reportedByUserId,
    reportedAt: waste.reportedAt,
    notes: waste.notes,
    createdAt: waste.createdAt,
  };
}

function mapReceive(receive: {
  id: string;
  inventoryItemId: string;
  receivedQuantity: Decimal;
  receivedByUserId: string;
  receivedAt: Date;
  notes: string | null;
  createdAt: Date;
}): InventoryReceiveRecord {
  return {
    id: receive.id,
    inventoryItemId: receive.inventoryItemId,
    receivedQuantity: decimalToNumber(receive.receivedQuantity),
    receivedByUserId: receive.receivedByUserId,
    receivedAt: receive.receivedAt,
    notes: receive.notes,
    createdAt: receive.createdAt,
  };
}

export class PrismaInventoryRepository implements InventoryRepository {
  private async updateStockWithOptimisticLock(
    id: string,
    resolver: (currentStock: number) => number,
  ): Promise<void> {
    const prisma = getPrismaClient();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = await prisma.inventoryItem.findUnique({
        where: { id },
        select: { currentEstimatedStock: true, updatedAt: true },
      });

      if (!current) {
        throw new InventoryError(404, "NOT_FOUND", "Inventory item not found");
      }

      const nextStock = resolver(decimalToNumber(current.currentEstimatedStock));
      const updated = await prisma.inventoryItem.updateMany({
        where: { id, updatedAt: current.updatedAt },
        data: { currentEstimatedStock: nextStock },
      });

      if (updated.count === 1) {
        return;
      }
    }

    throw new InventoryError(
      409,
      "CONFLICT",
      "Inventory item was updated concurrently, retry the operation",
    );
  }

  async listItems(filter: ListInventoryItemsFilter): Promise<InventoryItemRecord[]> {
    const prisma = getPrismaClient();

    const where: {
      isActive?: boolean;
      name?: { contains: string; mode: "insensitive" };
    } = {};

    if (typeof filter.isActive === "boolean") {
      where.isActive = filter.isActive;
    }

    if (filter.search) {
      where.name = { contains: filter.search, mode: "insensitive" };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { name: "asc" },
    });

    const mapped = items.map(mapItem);

    if (filter.lowStockOnly) {
      return mapped.filter(
        (item: InventoryItemRecord) => item.currentEstimatedStock <= item.lowStockThreshold,
      );
    }

    return mapped;
  }

  async createItem(input: CreateInventoryItemInput): Promise<InventoryItemRecord> {
    const prisma = getPrismaClient();
    const item = await prisma.inventoryItem.create({
      data: {
        name: input.name,
        unit: input.unit,
        category: input.category,
        currentEstimatedStock: input.currentEstimatedStock,
        lowStockThreshold: input.lowStockThreshold,
        isActive: input.isActive,
      },
    });
    return mapItem(item);
  }

  async findItemById(id: string): Promise<InventoryItemRecord | null> {
    const prisma = getPrismaClient();
    const item = await prisma.inventoryItem.findUnique({ where: { id } });
    return item ? mapItem(item) : null;
  }

  async updateItemStock(id: string, newStock: number): Promise<InventoryItemRecord> {
    const prisma = getPrismaClient();
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: { currentEstimatedStock: newStock },
    });
    return mapItem(item);
  }

  async createCount(input: CreateInventoryCountInput): Promise<InventoryCountRecord> {
    const prisma = getPrismaClient();
    const count = await prisma.inventoryCount.create({
      data: {
        inventoryItemId: input.inventoryItemId,
        countedQuantity: input.countedQuantity,
        countedByUserId: input.countedByUserId,
        notes: input.notes ?? null,
      },
    });
    return mapCount(count);
  }

  async createWaste(input: CreateInventoryWasteInput): Promise<InventoryWasteRecord> {
    const prisma = getPrismaClient();
    const waste = await prisma.inventoryWasteRecord.create({
      data: {
        inventoryItemId: input.inventoryItemId,
        quantity: input.quantity,
        reason: input.reason,
        reportedByUserId: input.reportedByUserId,
        notes: input.notes ?? null,
      },
    });
    return mapWaste(waste);
  }

  async createReceive(
    input: CreateInventoryReceiveInput,
  ): Promise<InventoryReceiveRecord> {
    const prisma = getPrismaClient();
    const receive = await prisma.inventoryReceiveRecord.create({
      data: {
        inventoryItemId: input.inventoryItemId,
        receivedQuantity: input.receivedQuantity,
        receivedByUserId: input.receivedByUserId,
        notes: input.notes ?? null,
      },
    });
    return mapReceive(receive);
  }

  async listAlerts(): Promise<InventoryAlert[]> {
    const prisma = getPrismaClient();
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
    });

    const alerts: InventoryAlert[] = [];

    for (const item of items) {
      const currentStock = decimalToNumber(item.currentEstimatedStock);
      const threshold = decimalToNumber(item.lowStockThreshold);

      if (currentStock <= threshold) {
        alerts.push({
          inventoryItemId: item.id,
          currentEstimatedStock: currentStock,
          lowStockThreshold: threshold,
          severity: currentStock === 0 ? "critical" : "warning",
        });
      }
    }

    return alerts;
  }

  async applyCount(input: CreateInventoryCountInput): Promise<InventoryCountRecord> {
    const count = await this.createCount(input);
    await this.updateStockWithOptimisticLock(input.inventoryItemId, () => input.countedQuantity);
    return count;
  }

  async applyReceive(input: CreateInventoryReceiveInput): Promise<InventoryReceiveRecord> {
    const receive = await this.createReceive(input);
    await this.updateStockWithOptimisticLock(
      input.inventoryItemId,
      (currentStock) => currentStock + input.receivedQuantity,
    );
    return receive;
  }

  async applyWaste(input: CreateInventoryWasteInput): Promise<InventoryWasteRecord> {
    const waste = await this.createWaste(input);
    await this.updateStockWithOptimisticLock(
      input.inventoryItemId,
      (currentStock) => Math.max(0, currentStock - input.quantity),
    );
    return waste;
  }

  async listMovements(
    filter: ListInventoryMovementsFilter,
  ): Promise<InventoryMovementRecord[]> {
    const prisma = getPrismaClient();
    const take = typeof filter.limit === "number" ? Math.min(Math.max(filter.limit, 1), 200) : 50;

    const inventoryItemId = filter.inventoryItemId;
    const type = filter.type;

    const [counts, receives, wastes] = await Promise.all([
      type && type !== "count"
        ? Promise.resolve([])
        : prisma.inventoryCount.findMany({
            where: inventoryItemId ? { inventoryItemId } : undefined,
            orderBy: { countedAt: "desc" },
            take,
          }),
      type && type !== "receive"
        ? Promise.resolve([])
        : prisma.inventoryReceiveRecord.findMany({
            where: inventoryItemId ? { inventoryItemId } : undefined,
            orderBy: { receivedAt: "desc" },
            take,
          }),
      type && type !== "waste"
        ? Promise.resolve([])
        : prisma.inventoryWasteRecord.findMany({
            where: inventoryItemId ? { inventoryItemId } : undefined,
            orderBy: { reportedAt: "desc" },
            take,
          }),
    ]);

    const movements: InventoryMovementRecord[] = [
      ...counts.map((count: {
        id: string;
        inventoryItemId: string;
        countedQuantity: Decimal;
        countedByUserId: string;
        countedAt: Date;
        notes: string | null;
      }) => ({
        id: count.id,
        type: "count" as const,
        inventoryItemId: count.inventoryItemId,
        quantity: decimalToNumber(count.countedQuantity),
        actorUserId: count.countedByUserId,
        occurredAt: count.countedAt,
        notes: count.notes,
        reason: null,
      })),
      ...receives.map((receive: {
        id: string;
        inventoryItemId: string;
        receivedQuantity: Decimal;
        receivedByUserId: string;
        receivedAt: Date;
        notes: string | null;
      }) => ({
        id: receive.id,
        type: "receive" as const,
        inventoryItemId: receive.inventoryItemId,
        quantity: decimalToNumber(receive.receivedQuantity),
        actorUserId: receive.receivedByUserId,
        occurredAt: receive.receivedAt,
        notes: receive.notes,
        reason: null,
      })),
      ...wastes.map((waste: {
        id: string;
        inventoryItemId: string;
        quantity: Decimal;
        reportedByUserId: string;
        reportedAt: Date;
        notes: string | null;
        reason: string;
      }) => ({
        id: waste.id,
        type: "waste" as const,
        inventoryItemId: waste.inventoryItemId,
        quantity: decimalToNumber(waste.quantity),
        actorUserId: waste.reportedByUserId,
        occurredAt: waste.reportedAt,
        notes: waste.notes,
        reason: waste.reason,
      })),
    ];

    return movements
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, take);
  }
}
