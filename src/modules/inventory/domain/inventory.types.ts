export type InventoryItemRecord = {
  id: string;
  name: string;
  unit: string;
  category: string;
  currentEstimatedStock: number;
  lowStockThreshold: number;
  isActive: boolean;
  locationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InventoryCountRecord = {
  id: string;
  inventoryItemId: string;
  countedQuantity: number;
  countedByUserId: string;
  countedAt: Date;
  notes: string | null;
  createdAt: Date;
};

export type InventoryWasteRecord = {
  id: string;
  inventoryItemId: string;
  quantity: number;
  reason: string;
  reportedByUserId: string;
  reportedAt: Date;
  notes: string | null;
  createdAt: Date;
};

export type InventoryReceiveRecord = {
  id: string;
  inventoryItemId: string;
  receivedQuantity: number;
  receivedByUserId: string;
  receivedAt: Date;
  notes: string | null;
  createdAt: Date;
};

export type InventoryAlert = {
  inventoryItemId: string;
  currentEstimatedStock: number;
  lowStockThreshold: number;
  severity: "warning" | "critical";
};

export type InventoryMovementType = "count" | "receive" | "waste";

export type InventoryMovementRecord = {
  id: string;
  type: InventoryMovementType;
  inventoryItemId: string;
  quantity: number;
  actorUserId: string;
  occurredAt: Date;
  notes: string | null;
  reason?: string | null;
};
