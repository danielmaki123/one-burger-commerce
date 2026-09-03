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

export class InMemoryInventoryRepository implements InventoryRepository {
  items: InventoryItemRecord[] = [];
  counts: InventoryCountRecord[] = [];
  wasteRecords: InventoryWasteRecord[] = [];
  receiveRecords: InventoryReceiveRecord[] = [];

  private nextId(prefix: string, collection: { id: string }[]) {
    return `${prefix}_${collection.length + 1}`;
  }

  async listItems(filter: ListInventoryItemsFilter): Promise<InventoryItemRecord[]> {
    let result = this.items;

    if (typeof filter.isActive === "boolean") {
      result = result.filter((i) => i.isActive === filter.isActive);
    }

    if (filter.search) {
      const search = filter.search.toLowerCase();
      result = result.filter((i) => i.name.toLowerCase().includes(search));
    }

    if (filter.lowStockOnly) {
      result = result.filter(
        (i) => i.currentEstimatedStock <= i.lowStockThreshold,
      );
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async createItem(input: CreateInventoryItemInput): Promise<InventoryItemRecord> {
    const now = new Date();
    const item: InventoryItemRecord = {
      id: this.nextId("item", this.items),
      name: input.name,
      unit: input.unit,
      category: input.category,
      currentEstimatedStock: input.currentEstimatedStock,
      lowStockThreshold: input.lowStockThreshold,
      isActive: input.isActive,
      locationId: "main",
      createdAt: now,
      updatedAt: now,
    };
    this.items.push(item);
    return item;
  }

  async findItemById(id: string): Promise<InventoryItemRecord | null> {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async updateItemStock(id: string, newStock: number): Promise<InventoryItemRecord> {
    const item = this.items.find((i) => i.id === id);
    if (!item) throw new Error("Item not found");
    item.currentEstimatedStock = newStock;
    item.updatedAt = new Date();
    return item;
  }

  async createCount(input: CreateInventoryCountInput): Promise<InventoryCountRecord> {
    const now = new Date();
    const count: InventoryCountRecord = {
      id: this.nextId("count", this.counts),
      inventoryItemId: input.inventoryItemId,
      countedQuantity: input.countedQuantity,
      countedByUserId: input.countedByUserId,
      countedAt: now,
      notes: input.notes ?? null,
      createdAt: now,
    };
    this.counts.push(count);
    return count;
  }

  async createWaste(input: CreateInventoryWasteInput): Promise<InventoryWasteRecord> {
    const now = new Date();
    const waste: InventoryWasteRecord = {
      id: this.nextId("waste", this.wasteRecords),
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity,
      reason: input.reason,
      reportedByUserId: input.reportedByUserId,
      reportedAt: now,
      notes: input.notes ?? null,
      createdAt: now,
    };
    this.wasteRecords.push(waste);
    return waste;
  }

  async createReceive(
    input: CreateInventoryReceiveInput,
  ): Promise<InventoryReceiveRecord> {
    const now = new Date();
    const receive: InventoryReceiveRecord = {
      id: this.nextId("recv", this.receiveRecords),
      inventoryItemId: input.inventoryItemId,
      receivedQuantity: input.receivedQuantity,
      receivedByUserId: input.receivedByUserId,
      receivedAt: now,
      notes: input.notes ?? null,
      createdAt: now,
    };
    this.receiveRecords.push(receive);
    return receive;
  }

  async applyCount(input: CreateInventoryCountInput): Promise<InventoryCountRecord> {
    const count = await this.createCount(input);
    await this.updateItemStock(input.inventoryItemId, input.countedQuantity);
    return count;
  }

  async applyReceive(input: CreateInventoryReceiveInput): Promise<InventoryReceiveRecord> {
    const item = await this.findItemById(input.inventoryItemId);
    if (!item) {
      throw new Error("Item not found");
    }
    const receive = await this.createReceive(input);
    await this.updateItemStock(input.inventoryItemId, item.currentEstimatedStock + input.receivedQuantity);
    return receive;
  }

  async applyWaste(input: CreateInventoryWasteInput): Promise<InventoryWasteRecord> {
    const item = await this.findItemById(input.inventoryItemId);
    if (!item) {
      throw new Error("Item not found");
    }
    const waste = await this.createWaste(input);
    await this.updateItemStock(
      input.inventoryItemId,
      Math.max(0, item.currentEstimatedStock - input.quantity),
    );
    return waste;
  }

  async listAlerts(): Promise<InventoryAlert[]> {
    const alerts: InventoryAlert[] = [];

    for (const item of this.items) {
      if (!item.isActive) continue;

      if (item.currentEstimatedStock <= item.lowStockThreshold) {
        alerts.push({
          inventoryItemId: item.id,
          currentEstimatedStock: item.currentEstimatedStock,
          lowStockThreshold: item.lowStockThreshold,
          severity: item.currentEstimatedStock === 0 ? "critical" : "warning",
        });
      }
    }

    return alerts;
  }

  async listMovements(
    filter: ListInventoryMovementsFilter,
  ): Promise<InventoryMovementRecord[]> {
    const countMovements: InventoryMovementRecord[] = this.counts.map((count) => ({
      id: count.id,
      type: "count",
      inventoryItemId: count.inventoryItemId,
      quantity: count.countedQuantity,
      actorUserId: count.countedByUserId,
      occurredAt: count.countedAt,
      notes: count.notes,
      reason: null,
    }));

    const receiveMovements: InventoryMovementRecord[] = this.receiveRecords.map((receive) => ({
      id: receive.id,
      type: "receive",
      inventoryItemId: receive.inventoryItemId,
      quantity: receive.receivedQuantity,
      actorUserId: receive.receivedByUserId,
      occurredAt: receive.receivedAt,
      notes: receive.notes,
      reason: null,
    }));

    const wasteMovements: InventoryMovementRecord[] = this.wasteRecords.map((waste) => ({
      id: waste.id,
      type: "waste",
      inventoryItemId: waste.inventoryItemId,
      quantity: waste.quantity,
      actorUserId: waste.reportedByUserId,
      occurredAt: waste.reportedAt,
      notes: waste.notes,
      reason: waste.reason,
    }));

    let movements = [...countMovements, ...receiveMovements, ...wasteMovements].sort(
      (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
    );

    if (filter.inventoryItemId) {
      movements = movements.filter((m) => m.inventoryItemId === filter.inventoryItemId);
    }

    if (filter.type) {
      movements = movements.filter((m) => m.type === filter.type);
    }

    const limit = typeof filter.limit === "number" ? filter.limit : 50;
    return movements.slice(0, limit);
  }
}
