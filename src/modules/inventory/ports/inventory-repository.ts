import type {
  InventoryAlert,
  InventoryCountRecord,
  InventoryItemRecord,
  InventoryMovementRecord,
  InventoryMovementType,
  InventoryReceiveRecord,
  InventoryWasteRecord,
} from "@/modules/inventory/domain/inventory.types";

export type CreateInventoryItemInput = {
  name: string;
  unit: string;
  category: string;
  currentEstimatedStock: number;
  lowStockThreshold: number;
  isActive: boolean;
};

export type CreateInventoryCountInput = {
  inventoryItemId: string;
  countedQuantity: number;
  countedByUserId: string;
  notes?: string | null;
};

export type CreateInventoryWasteInput = {
  inventoryItemId: string;
  quantity: number;
  reason: string;
  reportedByUserId: string;
  notes?: string | null;
};

export type CreateInventoryReceiveInput = {
  inventoryItemId: string;
  receivedQuantity: number;
  receivedByUserId: string;
  notes?: string | null;
};

export type ListInventoryItemsFilter = {
  isActive?: boolean;
  lowStockOnly?: boolean;
  search?: string;
};

export type ListInventoryMovementsFilter = {
  inventoryItemId?: string;
  type?: InventoryMovementType;
  limit?: number;
};

export interface InventoryRepository {
  listItems(filter: ListInventoryItemsFilter): Promise<InventoryItemRecord[]>;

  createItem(input: CreateInventoryItemInput): Promise<InventoryItemRecord>;

  findItemById(id: string): Promise<InventoryItemRecord | null>;

  updateItemStock(id: string, newStock: number): Promise<InventoryItemRecord>;

  createCount(input: CreateInventoryCountInput): Promise<InventoryCountRecord>;

  createWaste(input: CreateInventoryWasteInput): Promise<InventoryWasteRecord>;

  createReceive(input: CreateInventoryReceiveInput): Promise<InventoryReceiveRecord>;

  applyCount(input: CreateInventoryCountInput): Promise<InventoryCountRecord>;

  applyReceive(input: CreateInventoryReceiveInput): Promise<InventoryReceiveRecord>;

  applyWaste(input: CreateInventoryWasteInput): Promise<InventoryWasteRecord>;

  listAlerts(): Promise<InventoryAlert[]>;

  listMovements(filter: ListInventoryMovementsFilter): Promise<InventoryMovementRecord[]>;
}
