import { describe, expect, it } from "vitest";

import { buildOrderTimeline, filterDeviceOrders, formatOrderPickupEstimate, formatTimelineProgress, summarizeOrderItems } from "./activity-page-helpers";

function item(productName: string, quantity = 1) {
  return {
    productId: `prod-${productName}`,
    productName,
    quantity,
    unitPrice: 35,
    packagingUnitAmount: 0,
    modifierOptionIds: [],
    modifiers: [],
    lineTotal: 35 * quantity,
  };
}

function order(orderNumber: string, items?: string[]) {
  return {
    orderNumber,
    items: items?.map((name) => item(name)),
  };
}

describe("historial: resumen de líneas (T7)", () => {
  it("resume las líneas guardadas en vez de inventar un plato", () => {
    // Antes había un plato escrito a mano acá ("Sangría · ½ Litro").
    expect(summarizeOrderItems([item("Taco de Birria", 2), item("Agua de Jamaica")])).toBe(
      "2 × Taco de Birria · 1 × Agua de Jamaica",
    );
  });

  it("sin líneas guardadas no inventa un resumen", () => {
    expect(summarizeOrderItems(undefined)).toBeNull();
    expect(summarizeOrderItems([])).toBeNull();
  });
});

describe("historial: estimado de retiro (T7)", () => {
  it("muestra la hora y la marca como aproximada si no se programó", () => {
    const pickupTime = "2026-09-12T02:35:00.000Z";

    expect(
      formatOrderPickupEstimate({ pickupTime, pickupScheduled: false }, "America/Managua"),
    ).toBe("Listo ~8:35 p. m.");
    expect(
      formatOrderPickupEstimate({ pickupTime, pickupScheduled: true }, "America/Managua"),
    ).toBe("Listo 8:35 p. m.");
  });

  it("sin hora de retiro no promete nada", () => {
    expect(formatOrderPickupEstimate({ pickupTime: null }, "America/Managua")).toBeNull();
    expect(formatOrderPickupEstimate({}, "America/Managua")).toBeNull();
  });
});

describe("historial: buscador (T7)", () => {
  const orders = [order("P-AAA111", ["Taco de Birria"]), order("P-BBB222", ["Agua de Jamaica"])];

  it("filtra por número de pedido y por plato", () => {
    // El buscador del mock no hace nada: 4 bloques antes y después de buscar.
    expect(filterDeviceOrders(orders, "bbb").map((o) => o.orderNumber)).toEqual(["P-BBB222"]);
    expect(filterDeviceOrders(orders, "BIRRIA").map((o) => o.orderNumber)).toEqual(["P-AAA111"]);
    expect(filterDeviceOrders(orders, "jamaica").map((o) => o.orderNumber)).toEqual(["P-BBB222"]);
  });

  it("sin búsqueda devuelve todo y sin coincidencias devuelve nada", () => {
    expect(filterDeviceOrders(orders, "   ")).toHaveLength(2);
    expect(filterDeviceOrders(orders, "sushi")).toHaveLength(0);
  });

  it("un pedido viejo sin líneas se encuentra por su número", () => {
    expect(filterDeviceOrders([order("P-CCC333")], "ccc").map((o) => o.orderNumber)).toEqual([
      "P-CCC333",
    ]);
  });
});

describe("historial: timeline (T7)", () => {
  it("marca lo hecho, lo actual y lo que falta", () => {
    const steps = buildOrderTimeline("preparing");

    expect(steps.map((step) => step.label)).toEqual([
      "Recibida",
      "Aceptada",
      "En preparación",
      "Lista",
      "Completada",
    ]);
    expect(steps.map((step) => step.isDone)).toEqual([true, true, false, false, false]);
    expect(steps[2].isCurrent).toBe(true);
    expect(steps[3].isPending).toBe(true);
    expect(formatTimelineProgress("preparing")).toBe("Paso 3 de 5");
  });

  it("un pedido recién recibido está en el paso 1", () => {
    expect(formatTimelineProgress("new")).toBe("Paso 1 de 5");
    expect(buildOrderTimeline("new")[0].isCurrent).toBe(true);
  });

  it("un pedido retirado cierra el timeline", () => {
    const steps = buildOrderTimeline("picked_up");

    expect(steps.every((step) => step.isDone)).toBe(true);
    expect(formatTimelineProgress("picked_up")).toBe("Paso 5 de 5");
  });

  it("un pedido cancelado no se dibuja como progreso hacia adelante", () => {
    const steps = buildOrderTimeline("cancelled");

    expect(steps.some((step) => step.isDone)).toBe(false);
    expect(steps[0].isCurrent).toBe(true);
  });
});
