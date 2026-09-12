import {
  readDeviceOrders,
  type DeviceOrderType,
  type DeviceOrdersStore,
  upsertDeviceOrder,
} from "./device-orders";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PublicTrackedOrder = {
  orderNumber: string;
  type: DeviceOrderType;
  status: string;
  statusLabel: string;
  updatedAt: string;
  subtotal?: number;
  discount?: number;
  packagingAmount?: number;
  deliveryFeeAmount?: number;
  tipAmount?: number;
  tipRate?: number | null;
  total: number;
};

type SyncTrackedOrderOptions = {
  checkedAt?: string;
  storage?: StorageLike;
  orderLookupToken?: string;
};

export function syncTrackedOrderToDeviceOrders(
  tracked: PublicTrackedOrder,
  options?: SyncTrackedOrderOptions,
): DeviceOrdersStore {
  const storage = options?.storage;
  const existing = readDeviceOrders(storage).orders.find(
    (order) => order.orderNumber === tracked.orderNumber,
  );

  return upsertDeviceOrder(
    {
      // El seguimiento devuelve estado y montos, nada más. Se parte del pedido guardado
      // para **no borrar** lo que este payload no trae: las líneas (T7), el PIN y la hora
      // de retiro (T13) y el local (T8). Reconstruir el pedido desde cero lo vaciaba.
      ...existing,
      orderNumber: tracked.orderNumber,
      type: tracked.type,
      status: tracked.status,
      statusLabel: tracked.statusLabel,
      updatedAt: tracked.updatedAt,
      createdAt: existing?.createdAt,
      subtotal: tracked.subtotal ?? existing?.subtotal,
      discount: tracked.discount ?? existing?.discount,
      packagingAmount: tracked.packagingAmount ?? existing?.packagingAmount,
      deliveryFeeAmount: tracked.deliveryFeeAmount ?? existing?.deliveryFeeAmount,
      tipAmount: tracked.tipAmount ?? existing?.tipAmount,
      tipRate: tracked.tipRate ?? existing?.tipRate,
      total: tracked.total,
      lastCheckedAt: options?.checkedAt ?? new Date().toISOString(),
      stale: false,
      orderLookupToken: options?.orderLookupToken ?? existing?.orderLookupToken,
    },
    storage,
  );
}
