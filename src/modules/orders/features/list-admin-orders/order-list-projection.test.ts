import { describe, expect, it } from "vitest";

import { projectKpi } from "@/modules/orders/features/list-admin-orders/list-admin-orders";
import type { OrderListProjection } from "@/modules/orders/features/list-admin-orders/order-list-projection";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **el contrato de `OrderListProjection`**.
 *
 * Este archivo existe porque la proyección es lo que el listado serializa: es el contrato que dice **qué
 * viaja** y **qué se cuenta**. Sus dos mitades se prueban acá:
 *
 * 1. **La forma**: exactamente los campos aprobados, y ninguno de los prohibidos (`A-61`).
 * 2. **Los agregados**: `projectKpi` cuenta el filtro **completo** y cada número tiene su regla —lo que
 *    todavía es trabajo, lo que no está pago y lo programado—, no una suma de la página visible.
 */

function projection(overrides: Partial<OrderListProjection> = {}): OrderListProjection {
  return {
    id: "ord_1",
    orderNumber: "P-1",
    source: "menu",
    customerName: "Ana",
    customerWhatsapp: "+50588887777",
    locationName: "Camino de Oriente",
    pickupTime: null,
    pickupScheduled: false,
    status: "new",
    stageChangedAt: "2026-09-30T18:00:00.000Z",
    total: 100,
    currencyCode: "NIO",
    financialState: {
      status: "pending",
      paidAmount: 0,
      outstandingAmount: 100,
      unresolvedAmount: 0,
      baseCurrencyCode: "NIO",
    },
    ...overrides,
  };
}

describe("OrderListProjection · la forma", () => {
  it("declara los campos aprobados y ninguno de más", () => {
    const keys = Object.keys(projection()).sort();

    expect(keys).toEqual(
      [
        "currencyCode",
        "customerName",
        "customerWhatsapp",
        "financialState",
        "id",
        "locationName",
        "orderNumber",
        "pickupScheduled",
        "pickupTime",
        "source",
        "stageChangedAt",
        "status",
        "total",
      ].sort(),
    );
  });

  it("el estado financiero declara los cinco campos de la proyección de `payments`", () => {
    expect(Object.keys(projection().financialState).sort()).toEqual(
      ["baseCurrencyCode", "outstandingAmount", "paidAmount", "status", "unresolvedAmount"].sort(),
    );
  });

  it("no declara items, modificadores, historial, GPS ni el token de consulta", () => {
    const serialized = JSON.stringify(projection());

    for (const forbidden of [
      "items",
      "modifiers",
      "statusHistory",
      "orderLookupTokenHash",
      "customerLat",
      "customerLng",
      "geoAccuracy",
      "geoCapturedAt",
      "pickups",
    ]) {
      expect(serialized, `el listado no puede llevar «${forbidden}»`).not.toContain(forbidden);
    }
  });
});

describe("projectKpi · cada número tiene su regla", () => {
  it("«activas» es el trabajo vivo: ni terminado ni cancelado", () => {
    const kpi = projectKpi([
      projection({ id: "a", status: "new" }),
      projection({ id: "b", status: "confirmed" }),
      projection({ id: "c", status: "preparing" }),
      projection({ id: "d", status: "ready_for_pickup" }),
      projection({ id: "e", status: "picked_up" }),
      projection({ id: "f", status: "closed" }),
      projection({ id: "g", status: "cancelled" }),
    ]);

    expect(kpi.total).toBe(7);
    expect(kpi.active).toBe(4);
  });

  it("«pendientes de pago» es el complemento de `paid`: partial también cuenta", () => {
    const kpi = projectKpi([
      projection({ id: "a", financialState: state("pending") }),
      projection({ id: "b", financialState: state("partial") }),
      projection({ id: "c", financialState: state("paid") }),
    ]);

    expect(kpi.pendingPayment).toBe(2);
  });

  it("«programadas» cuenta el retiro programado, no todo el que tiene hora", () => {
    const kpi = projectKpi([
      // La venta de mostrador guarda una hora concreta pero **no** es un programado del cliente.
      projection({ id: "a", pickupTime: "2026-09-30T19:00:00.000Z", pickupScheduled: false }),
      projection({ id: "b", pickupTime: "2026-10-02T18:00:00.000Z", pickupScheduled: true }),
    ]);

    expect(kpi.scheduled).toBe(1);
  });

  it("sobre una lista vacía los cuatro números son cero, no `null`", () => {
    expect(projectKpi([])).toEqual({ total: 0, active: 0, pendingPayment: 0, scheduled: 0 });
  });
});

function state(status: "pending" | "partial" | "paid"): OrderListProjection["financialState"] {
  return {
    status,
    paidAmount: status === "paid" ? 100 : status === "partial" ? 40 : 0,
    outstandingAmount: status === "paid" ? 0 : status === "partial" ? 60 : 100,
    unresolvedAmount: 0,
    baseCurrencyCode: "NIO",
  };
}
