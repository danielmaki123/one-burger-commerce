import { describe, expect, it } from "vitest";

import {
  clearDeviceOrders,
  getDeviceOrdersKey,
  markDeviceOrderStale,
  readDeviceOrders,
  removeDeviceOrder,
  upsertDeviceOrder,
  type DeviceOrderRef,
} from "./device-orders";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

function makeOrder(overrides?: Partial<DeviceOrderRef>): DeviceOrderRef {
  return {
    orderNumber: "P-ABC123",
    type: "pickup",
    status: "new",
    statusLabel: "Recibida",
    updatedAt: "2026-05-26T10:00:00.000Z",
    total: 325,
    ...overrides,
  };
}

describe("device-orders storage", () => {
  it("guarda los ítems y la hora de retiro para poder repetir el pedido (T7)", () => {
    const storage = new MemoryStorage();

    const store = upsertDeviceOrder(
      makeOrder({
        pickupTime: "2026-09-12T02:35:00.000Z",
        pickupScheduled: false,
        items: [
          {
            productId: "seed-prod-01",
            productName: "Taco de Birria",
            quantity: 2,
            unitPrice: 35,
            packagingUnitAmount: 0,
            modifierOptionIds: ["opt-1"],
            modifiers: [{ groupName: "Salsa", optionName: "Picante", priceDelta: 5 }],
            lineTotal: 75,
          },
        ],
      }),
      storage,
    );

    const saved = store.orders[0];
    expect(saved.items).toHaveLength(1);
    expect(saved.items![0]).toMatchObject({ productName: "Taco de Birria", quantity: 2 });
    expect(saved.pickupTime).toBe("2026-09-12T02:35:00.000Z");
    expect(saved.pickupScheduled).toBe(false);
  });

  it("un pedido viejo sin ítems sigue leyéndose: se puede ver, no repetir (T7)", () => {
    const storage = new MemoryStorage();
    // Lo guardado antes de T7 no tiene `items`: no se descarta el pedido.
    storage.setItem(
      getDeviceOrdersKey(),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-05-26T10:00:00.000Z",
        orders: [makeOrder()],
      }),
    );

    const store = readDeviceOrders(storage);
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0].items).toBeUndefined();
  });

  it("descarta los ítems corruptos sin perder el pedido (T7)", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      getDeviceOrdersKey(),
      JSON.stringify({
        version: 1,
        updatedAt: "2026-05-26T10:00:00.000Z",
        orders: [{ ...makeOrder(), items: [{ productName: 42 }] }],
      }),
    );

    const store = readDeviceOrders(storage);
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0].items).toBeUndefined();
  });

  it("returns empty store when key does not exist", () => {
    const storage = new MemoryStorage();
    const store = readDeviceOrders(storage);
    expect(store.version).toBe(1);
    expect(store.orders).toEqual([]);
  });

  it("repairs invalid store payload to empty", () => {
    const storage = new MemoryStorage();
    storage.setItem(getDeviceOrdersKey(), "not-json");
    const store = readDeviceOrders(storage);
    expect(store.orders).toEqual([]);
  });

  it("upserts by orderNumber without duplication", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(makeOrder(), storage);
    upsertDeviceOrder(makeOrder({ status: "confirmed", statusLabel: "Confirmada" }), storage);
    const store = readDeviceOrders(storage);
    expect(store.orders).toHaveLength(1);
    expect(store.orders[0].status).toBe("confirmed");
  });

  it("orders active first and then by updatedAt desc", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(makeOrder({ orderNumber: "D-3", status: "closed", updatedAt: "2026-05-26T08:00:00.000Z" }), storage);
    upsertDeviceOrder(makeOrder({ orderNumber: "D-1", status: "preparing", updatedAt: "2026-05-26T07:00:00.000Z" }), storage);
    upsertDeviceOrder(makeOrder({ orderNumber: "D-2", status: "new", updatedAt: "2026-05-26T09:00:00.000Z" }), storage);
    const store = readDeviceOrders(storage);
    expect(store.orders.map((o) => o.orderNumber)).toEqual(["D-2", "D-1", "D-3"]);
  });

  it("limits to 30 records", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 35; i++) {
      upsertDeviceOrder(
        makeOrder({
          orderNumber: `P-${i}`,
          updatedAt: new Date(2026, 4, 1, 0, i, 0).toISOString(),
        }),
        storage,
      );
    }
    const store = readDeviceOrders(storage);
    expect(store.orders).toHaveLength(30);
  });

  it("marks stale state", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(makeOrder({ orderNumber: "D-1" }), storage);
    markDeviceOrderStale("D-1", true, storage);
    const store = readDeviceOrders(storage);
    expect(store.orders[0].stale).toBe(true);
  });

  it("persists optional orderLookupToken for secure refresh", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(
      makeOrder({
        orderNumber: "D-TOKEN",
        orderLookupToken: "opaque-token-123",
      }),
      storage,
    );

    const store = readDeviceOrders(storage);
    expect(store.orders[0].orderLookupToken).toBe("opaque-token-123");
  });

  it("removes a single order without clearing the store", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(makeOrder({ orderNumber: "D-1" }), storage);
    upsertDeviceOrder(makeOrder({ orderNumber: "D-2" }), storage);

    removeDeviceOrder("D-1", storage);

    const store = readDeviceOrders(storage);
    expect(store.orders.map((order) => order.orderNumber)).toEqual(["D-2"]);
  });

  it("clears the store", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(makeOrder(), storage);
    clearDeviceOrders(storage);
    const store = readDeviceOrders(storage);
    expect(store.orders).toHaveLength(0);
  });
});
