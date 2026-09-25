import { describe, expect, it } from "vitest";

import { aggregateOverviewPerformance } from "./admin-overview-metrics";
import type { AggregateOverviewInput } from "./admin-overview.types";
import { buildOverviewBucketKeys, buildOverviewRanges } from "./admin-overview-periods";

/**
 * TASK-AUD-015 (`A-58`) — **la semántica económica del panel**.
 *
 * Decisión del owner (2026-09-25): las métricas comerciales **nunca** pueden contar como ingreso plata que
 * fue devuelta (`Refund`) o invalidada (`Void`/`Reversal`). El agregado calculaba el valor con `Order.total`
 * a secas, así que una venta reembolsada seguía inflando ventas, ticket promedio y el ranking de productos.
 *
 * La regla que se fija acá, en un solo lugar (el dominio), es el **valor neto del pedido**:
 * `total − importe devuelto/invalidado`, nunca negativo. Con neto 0 el pedido **no es una venta** (no cuenta
 * ni en el conteo del ticket promedio ni en el ranking); con neto parcial cuenta el neto.
 *
 * **Limitación declarada**: el modelo no guarda qué ítems se devolvieron, así que un pedido con devoluciones
 * **no entra en el desglose por producto** (un número aparentemente preciso pero no demostrable es peor que
 * omitirlo). Los pedidos sin devoluciones siguen aportando sus ítems normalmente.
 */

const NOW = new Date("2026-09-25T18:00:00.000Z");
const TIME_ZONE = "America/Managua";

const ranges = buildOverviewRanges("today", NOW, TIME_ZONE);
const buckets = buildOverviewBucketKeys(ranges, TIME_ZONE);

function order(overrides: Partial<AggregateOverviewInput["orders"][number]> = {}) {
  return {
    id: "ord_01",
    type: "pickup" as const,
    status: "picked_up",
    total: 100,
    statusHistory: [{ status: "picked_up", createdAt: NOW }],
    items: [{ productId: "prod_taco", productName: "Taco", quantity: 1, lineTotal: 100 }],
    refundedAmount: 0,
    ...overrides,
  };
}

function aggregate(orders: Array<ReturnType<typeof order>>) {
  return aggregateOverviewPerformance({
    channel: "all",
    ranges,
    buckets,
    orders,
  } as AggregateOverviewInput);
}

describe("TASK-AUD-015 · el valor comercial es neto (devoluciones e invalidaciones)", () => {
  it("una venta sin devoluciones cuenta entera", () => {
    const data = aggregate([order()]);

    expect(data.metrics.completedOrderValue.current).toBe(100);
    expect(data.metrics.completedOrderCount.current).toBe(1);
    expect(data.metrics.averageTicket.current).toBe(100);
    expect(data.topProducts).toHaveLength(1);
    expect(data.topProducts[0].units).toBe(1);
  });

  it("un pedido reembolsado del todo NO cuenta como ingreso (ni en el ticket ni en el ranking)", () => {
    const data = aggregate([order({ refundedAmount: 100 })]);

    expect(
      data.metrics.completedOrderValue.current,
      "una venta reembolsada seguía contando como ingreso",
    ).toBe(0);
    expect(data.metrics.completedOrderCount.current).toBe(0);
    expect(data.metrics.averageTicket.current).toBe(0);
    expect(data.topProducts).toHaveLength(0);
    expect(data.series[0].completedOrderValue).toBe(0);
  });

  it("un pedido con devolución PARCIAL cuenta el neto realmente conservado, sin inventar producto", () => {
    const data = aggregate([order({ refundedAmount: 40 })]);

    expect(data.metrics.completedOrderValue.current).toBe(60);
    // El pedido fue una venta real (se conserva plata): cuenta para el ticket promedio.
    expect(data.metrics.completedOrderCount.current).toBe(1);
    expect(data.metrics.averageTicket.current).toBe(60);
    // Pero su desglose por producto no es demostrable: el modelo no sabe qué ítems se devolvieron.
    expect(data.topProducts).toHaveLength(0);
  });

  it("un pedido cancelado sin pago no entra (no es un estado terminal)", () => {
    const data = aggregate([
      order({ status: "cancelled", statusHistory: [{ status: "cancelled", createdAt: NOW }], total: 0 }),
    ]);

    expect(data.metrics.completedOrderValue.current).toBe(0);
    expect(data.metrics.completedOrderCount.current).toBe(0);
  });

  it("una devolución mayor al total no puede dejar un valor negativo (ni prestar plata a la métrica)", () => {
    const data = aggregate([order({ refundedAmount: 250 })]);

    expect(data.metrics.completedOrderValue.current).toBe(0);
    expect(data.metrics.completedOrderCount.current).toBe(0);
  });

  it("mezcla: la venta limpia aporta su producto y el reembolsado no aporta nada", () => {
    const data = aggregate([
      order({ id: "ord_limpio" }),
      order({
        id: "ord_reembolsado",
        refundedAmount: 100,
        items: [{ productId: "prod_burger", productName: "Burger", quantity: 2, lineTotal: 200 }],
      }),
    ]);

    expect(data.metrics.completedOrderValue.current).toBe(100);
    expect(data.metrics.completedOrderCount.current).toBe(1);
    expect(data.metrics.averageTicket.current).toBe(100);
    expect(data.topProducts.map((product) => product.productId)).toEqual(["prod_taco"]);
  });
});
