import { describe, expect, it } from "vitest";

import { readDeviceOrders, upsertDeviceOrder } from "./device-orders";
import { syncTrackedOrderToDeviceOrders } from "./order-tracking-sync";

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

describe("order-tracking sync", () => {
  it("updates existing device order with tracked status and preserves createdAt", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(
      {
        orderNumber: "P-MPOW7W8C",
        type: "pickup",
        status: "new",
        statusLabel: "Recibida",
        updatedAt: "2026-05-27T09:00:00.000Z",
        createdAt: "2026-05-27T08:30:00.000Z",
        total: 614,
      },
      storage,
    );

    syncTrackedOrderToDeviceOrders(
      {
        orderNumber: "P-MPOW7W8C",
        type: "pickup",
        status: "confirmed",
        statusLabel: "Confirmada",
        updatedAt: "2026-05-27T10:00:00.000Z",
        total: 614,
      },
      { storage, checkedAt: "2026-05-27T10:01:00.000Z" },
    );

    const stored = readDeviceOrders(storage).orders[0] as Record<string, unknown>;
    expect(stored.status).toBe("confirmed");
    expect(stored.statusLabel).toBe("Confirmada");
    expect(stored.createdAt).toBe("2026-05-27T08:30:00.000Z");
    expect(stored.lastCheckedAt).toBe("2026-05-27T10:01:00.000Z");
    expect(stored.stale).toBe(false);
    expect(stored.customerWhatsapp).toBeUndefined();
    expect(stored.customerName).toBeUndefined();
    expect(stored.orderId).toBeUndefined();
    expect(stored.tableId).toBeUndefined();
    expect(stored.qrToken).toBeUndefined();
  });

  it("inserts tracked order when it does not exist", () => {
    const storage = new MemoryStorage();
    syncTrackedOrderToDeviceOrders(
      {
        orderNumber: "D-NEW001",
        type: "delivery",
        status: "preparing",
        statusLabel: "En preparación",
        updatedAt: "2026-05-27T12:00:00.000Z",
        total: 320,
      },
      { storage, checkedAt: "2026-05-27T12:01:00.000Z" },
    );

    const stored = readDeviceOrders(storage).orders[0];
    expect(stored.orderNumber).toBe("D-NEW001");
    expect(stored.status).toBe("preparing");
    expect(stored.lastCheckedAt).toBe("2026-05-27T12:01:00.000Z");
  });

  it("preserves existing orderLookupToken on sync", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(
      {
        orderNumber: "D-TOKEN",
        type: "delivery",
        status: "new",
        statusLabel: "Recibida",
        updatedAt: "2026-05-27T09:00:00.000Z",
        total: 320,
        orderLookupToken: "opaque-token-123",
      },
      storage,
    );

    syncTrackedOrderToDeviceOrders(
      {
        orderNumber: "D-TOKEN",
        type: "delivery",
        status: "confirmed",
        statusLabel: "Confirmada",
        updatedAt: "2026-05-27T10:00:00.000Z",
        total: 320,
      },
      { storage, checkedAt: "2026-05-27T10:01:00.000Z" },
    );

    const stored = readDeviceOrders(storage).orders[0];
    expect(stored.orderLookupToken).toBe("opaque-token-123");
  });

  it("stores incoming orderLookupToken when provided explicitly", () => {
    const storage = new MemoryStorage();

    syncTrackedOrderToDeviceOrders(
      {
        orderNumber: "D-TOKEN-NEW",
        type: "delivery",
        status: "confirmed",
        statusLabel: "Confirmada",
        updatedAt: "2026-05-27T10:00:00.000Z",
        total: 320,
      },
      {
        storage,
        checkedAt: "2026-05-27T10:01:00.000Z",
        orderLookupToken: "opaque-token-456",
      },
    );

    const stored = readDeviceOrders(storage).orders[0];
    expect(stored.orderLookupToken).toBe("opaque-token-456");
  });

  /**
   * T8 fase 7 — el sync solo trae estado y montos: lo que el servidor no manda se conserva.
   *
   * El seguimiento devuelve un payload chico (estado, hora, total), así que reconstruir el
   * pedido guardado solo con eso borraba las líneas (T7), el PIN y la hora de retiro (T13) y
   * ahora también el local. Refrescar "Mis pedidos" no puede vaciar el historial.
   */
  it("no borra lo que el seguimiento no manda (lineas, PIN, retiro y local)", () => {
    const storage = new MemoryStorage();
    upsertDeviceOrder(
      {
        orderNumber: "P-KEEP01",
        type: "pickup",
        status: "new",
        statusLabel: "Recibida",
        updatedAt: "2026-05-27T09:00:00.000Z",
        createdAt: "2026-05-27T08:30:00.000Z",
        total: 614,
        pickupTime: "2026-05-27T11:00:00.000Z",
        pickupScheduled: true,
        pickupPin: "4821",
        locationName: "Sucursal Norte",
        locationAddress: "Frente al parque, Managua",
        locationMapsUrl: "https://maps.example.com/norte",
        items: [
          {
            productId: "prod_1",
            productName: "Hamburguesa clásica",
            quantity: 2,
            unitPrice: 300,
            packagingUnitAmount: 7,
            modifierOptionIds: [],
            modifiers: [],
            lineTotal: 614,
          },
        ],
      },
      storage,
    );

    syncTrackedOrderToDeviceOrders(
      {
        orderNumber: "P-KEEP01",
        type: "pickup",
        status: "confirmed",
        statusLabel: "Confirmada",
        updatedAt: "2026-05-27T10:00:00.000Z",
        total: 614,
      },
      { storage, checkedAt: "2026-05-27T10:01:00.000Z" },
    );

    const stored = readDeviceOrders(storage).orders[0];
    expect(stored.status).toBe("confirmed");
    expect(stored.pickupPin).toBe("4821");
    expect(stored.pickupTime).toBe("2026-05-27T11:00:00.000Z");
    expect(stored.pickupScheduled).toBe(true);
    expect(stored.locationName).toBe("Sucursal Norte");
    expect(stored.locationAddress).toBe("Frente al parque, Managua");
    expect(stored.locationMapsUrl).toBe("https://maps.example.com/norte");
    expect(stored.items).toHaveLength(1);
    expect(stored.items?.[0].productName).toBe("Hamburguesa clásica");
  });
});
