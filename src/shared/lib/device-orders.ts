export type DeviceOrderType = "delivery" | "pickup" | "table";

export type DeviceOrderRef = {
  orderNumber: string;
  type: DeviceOrderType;
  status: string;
  statusLabel: string;
  updatedAt: string;
  createdAt?: string;
  subtotal?: number;
  discount?: number;
  packagingAmount?: number;
  deliveryFeeAmount?: number;
  tipAmount?: number;
  tipRate?: number | null;
  total: number;
  lastCheckedAt?: string;
  stale?: boolean;
  orderLookupToken?: string;
};

export type DeviceOrdersStore = {
  version: 1;
  orders: DeviceOrderRef[];
  updatedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEVICE_ORDERS_KEY = "ca_device_orders_v1";
const STORE_VERSION = 1;
const MAX_DEVICE_ORDERS = 30;

const ACTIVE_STATUSES = new Set([
  "new",
  "confirmed",
  "accepted",
  "preparing",
  "ready",
  "ready_for_pickup",
  "out_for_delivery",
]);

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function isValidOrderType(value: unknown): value is DeviceOrderType {
  return value === "delivery" || value === "pickup" || value === "table";
}

function isValidDeviceOrderRef(value: unknown): value is DeviceOrderRef {
  if (!value || typeof value !== "object") return false;
  const order = value as Record<string, unknown>;
  if (typeof order.orderNumber !== "string" || order.orderNumber.trim().length === 0) return false;
  if (!isValidOrderType(order.type)) return false;
  if (typeof order.status !== "string") return false;
  if (typeof order.statusLabel !== "string") return false;
  if (typeof order.updatedAt !== "string") return false;
  if (order.subtotal !== undefined && typeof order.subtotal !== "number") return false;
  if (order.discount !== undefined && typeof order.discount !== "number") return false;
  if (order.packagingAmount !== undefined && typeof order.packagingAmount !== "number") return false;
  if (order.deliveryFeeAmount !== undefined && typeof order.deliveryFeeAmount !== "number") return false;
  if (order.tipAmount !== undefined && typeof order.tipAmount !== "number") return false;
  if (order.tipRate !== undefined && order.tipRate !== null && typeof order.tipRate !== "number") return false;
  if (typeof order.total !== "number" || Number.isNaN(order.total)) return false;
  if (order.createdAt !== undefined && typeof order.createdAt !== "string") return false;
  if (order.lastCheckedAt !== undefined && typeof order.lastCheckedAt !== "string") return false;
  if (order.stale !== undefined && typeof order.stale !== "boolean") return false;
  if (order.orderLookupToken !== undefined && typeof order.orderLookupToken !== "string") return false;
  return true;
}

function emptyStore(): DeviceOrdersStore {
  return {
    version: STORE_VERSION,
    orders: [],
    updatedAt: new Date().toISOString(),
  };
}

function rankOrderStatus(status: string): number {
  return ACTIVE_STATUSES.has(status) ? 0 : 1;
}

function sortOrders(orders: DeviceOrderRef[]): DeviceOrderRef[] {
  return [...orders].sort((a, b) => {
    const statusRank = rankOrderStatus(a.status) - rankOrderStatus(b.status);
    if (statusRank !== 0) return statusRank;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function persistStore(store: DeviceOrdersStore, storage?: StorageLike): DeviceOrdersStore {
  const driver = getStorage(storage);
  const normalized: DeviceOrdersStore = {
    version: STORE_VERSION,
    orders: sortOrders(store.orders).slice(0, MAX_DEVICE_ORDERS),
    updatedAt: new Date().toISOString(),
  };
  if (driver) {
    driver.setItem(DEVICE_ORDERS_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function readDeviceOrders(storage?: StorageLike): DeviceOrdersStore {
  const driver = getStorage(storage);
  if (!driver) return emptyStore();

  const raw = driver.getItem(DEVICE_ORDERS_KEY);
  if (!raw) return emptyStore();

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.version !== STORE_VERSION || !Array.isArray(parsed.orders)) {
      return persistStore(emptyStore(), storage);
    }

    const validOrders = parsed.orders.filter(isValidDeviceOrderRef) as DeviceOrderRef[];
    return persistStore(
      {
        version: STORE_VERSION,
        orders: validOrders,
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      },
      storage,
    );
  } catch {
    return persistStore(emptyStore(), storage);
  }
}

export function upsertDeviceOrder(order: DeviceOrderRef, storage?: StorageLike): DeviceOrdersStore {
  const current = readDeviceOrders(storage);
  const rest = current.orders.filter((existing) => existing.orderNumber !== order.orderNumber);
  return persistStore({ ...current, orders: [order, ...rest] }, storage);
}

export function markDeviceOrderStale(orderNumber: string, stale: boolean, storage?: StorageLike): DeviceOrdersStore {
  const current = readDeviceOrders(storage);
  const updated = current.orders.map((order) =>
    order.orderNumber === orderNumber ? { ...order, stale } : order,
  );
  return persistStore({ ...current, orders: updated }, storage);
}

export function removeDeviceOrder(
  orderNumber: string,
  storage?: StorageLike,
): DeviceOrdersStore {
  const current = readDeviceOrders(storage);
  const updated = current.orders.filter(
    (order) => order.orderNumber !== orderNumber,
  );
  return persistStore({ ...current, orders: updated }, storage);
}

export function clearDeviceOrders(storage?: StorageLike): void {
  const driver = getStorage(storage);
  if (!driver) return;
  driver.removeItem(DEVICE_ORDERS_KEY);
}

export function getDeviceOrdersKey(): string {
  return DEVICE_ORDERS_KEY;
}
