import { beforeEach, describe, expect, it, vi } from "vitest";

const orderFindManyMock = vi.fn();

vi.mock("@/infrastructure/database/prisma", () => ({
  getPrismaClient: () => ({
    order: {
      findMany: orderFindManyMock,
    },
  }),
}));

/**
 * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-83`) — la moneda en la que está expresado el neto la
 * declara **`money`**, no la configuración de branding. El dashboard **no convierte**: sólo consume el
 * equivalente ya congelado de cada devolución y necesita saber contra qué base está expresado.
 */
vi.mock("@/modules/money/adapters/production-money-context", () => ({
  readProductionMoney: async () => ({
    context: {
      baseCurrencyCode: "NIO",
      locale: "es-NI",
      rates: { USD: 36.5 },
      knownCurrencyCodes: ["NIO", "USD"],
    },
    currencies: [
      { code: "NIO", name: "Córdoba", symbol: "C$", decimals: 2, isBase: true },
      { code: "USD", name: "Dólar", symbol: "US$", decimals: 2, isBase: false },
    ],
  }),
}));

import { getAdminOverviewPerformance } from "./get-admin-overview-performance";

function decimal(value: number) {
  return { toString: () => value.toString() };
}

describe("getAdminOverviewPerformance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("aggregates first terminal transitions and product snapshots across current and previous ranges", async () => {
    orderFindManyMock.mockResolvedValueOnce([
      {
        id: "current-delivery",
        type: "delivery",
        status: "closed",
        total: decimal(100),
        statusHistory: [
          { status: "delivered", createdAt: new Date("2026-07-20T15:00:00.000Z") },
          { status: "closed", createdAt: new Date("2026-07-20T16:00:00.000Z") },
        ],
        items: [
          { productId: "product-a", productName: "Tostada", quantity: 2, lineTotal: decimal(80) },
          { productId: "product-b", productName: "Café", quantity: 1, lineTotal: decimal(20) },
        ],
      },
      {
        id: "previous-pickup",
        type: "pickup",
        status: "picked_up",
        total: decimal(50),
        statusHistory: [
          { status: "picked_up", createdAt: new Date("2026-07-14T12:00:00.000Z") },
          { status: "closed", createdAt: new Date("2026-07-14T13:00:00.000Z") },
        ],
        items: [
          { productId: "product-a", productName: "Tostada", quantity: 1, lineTotal: decimal(50) },
        ],
      },
      {
        id: "first-completion-outside",
        type: "delivery",
        status: "closed",
        total: decimal(75),
        statusHistory: [
          { status: "delivered", createdAt: new Date("2026-07-08T12:00:00.000Z") },
          { status: "closed", createdAt: new Date("2026-07-10T12:00:00.000Z") },
        ],
        items: [
          { productId: "product-c", productName: "Sopa", quantity: 1, lineTotal: decimal(75) },
        ],
      },
      {
        id: "table-order",
        type: "table",
        status: "served",
        total: decimal(500),
        statusHistory: [
          { status: "served", createdAt: new Date("2026-07-20T17:00:00.000Z") },
        ],
        items: [
          { productId: "product-d", productName: "Mesa", quantity: 10, lineTotal: decimal(500) },
        ],
      },
      {
        id: "cancelled-order",
        type: "delivery",
        status: "cancelled",
        total: decimal(300),
        statusHistory: [
          { status: "delivered", createdAt: new Date("2026-07-21T15:00:00.000Z") },
        ],
        items: [
          { productId: "product-e", productName: "Cancelado", quantity: 5, lineTotal: decimal(300) },
        ],
      },
    ]);
    const now = new Date("2026-07-22T18:30:00.000Z");

    const result = await getAdminOverviewPerformance("7d", "all", "America/Managua", now);

    expect(result.data.metrics).toEqual({
      completedOrderValue: { current: 100, previous: 50, changePercent: 100 },
      completedOrderCount: { current: 1, previous: 1, changePercent: 0 },
      averageTicket: { current: 100, previous: 50, changePercent: 100 },
    });
    expect(result.data.series).toHaveLength(7);
    expect(result.data.series.filter((point) => point.completedOrderCount > 0)).toEqual([
      {
        key: "2026-07-20",
        label: "07-20",
        completedOrderValue: 100,
        completedOrderCount: 1,
      },
    ]);
    expect(result.data.series[0]).toEqual({
      key: "2026-07-16",
      label: "07-16",
      completedOrderValue: 0,
      completedOrderCount: 0,
    });
    expect(result.data.topProducts).toEqual([
      {
        productId: "product-a",
        productName: "Tostada",
        units: 2,
        completedOrderValue: 80,
      },
      {
        productId: "product-b",
        productName: "Café",
        units: 1,
        completedOrderValue: 20,
      },
    ]);
    expect(result.meta).toEqual({
      generatedAt: "2026-07-22T18:30:00.000Z",
      timeZone: "America/Managua",
      period: "7d",
      channel: "all",
      ranges: {
        current: {
          localStartDate: "2026-07-16",
          localEndDate: "2026-07-22",
          utcStart: "2026-07-16T06:00:00.000Z",
          utcEnd: "2026-07-23T06:00:00.000Z",
        },
        previous: {
          localStartDate: "2026-07-09",
          localEndDate: "2026-07-15",
          utcStart: "2026-07-09T06:00:00.000Z",
          utcEnd: "2026-07-16T06:00:00.000Z",
        },
      },
    });
    expect(orderFindManyMock).toHaveBeenCalledWith({
      where: {
        type: { in: ["delivery", "pickup"] },
        status: { in: ["delivered", "picked_up", "served", "closed"] },
        statusHistory: {
          some: {
            status: { in: ["delivered", "picked_up", "served", "closed"] },
            createdAt: {
              gte: new Date("2026-07-09T06:00:00.000Z"),
              lt: new Date("2026-07-23T06:00:00.000Z"),
            },
          },
        },
      },
      select: {
        id: true,
        type: true,
        status: true,
        total: true,
        statusHistory: {
          where: { status: { in: ["delivered", "picked_up", "served", "closed"] } },
          select: { status: true, createdAt: true },
        },
        items: {
          select: {
            productId: true,
            productName: true,
            quantity: true,
            lineTotal: true,
          },
        },
        // TASK-AUD-015 (`A-58`): la consulta también trae el importe devuelto de cada pedido, porque la
        // métrica comercial usa el **neto** (contrato de la consulta que cambió con la TASK).
        //
        // `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-74`): y trae la **moneda y el snapshot** de la devolución.
        // Restar el monto crudo era restar 20 a un neto en córdobas por una devolución de US$20.
        refunds: {
          where: { status: "approved" },
          select: {
            amount: true,
            currency: true,
            baseCurrencyCode: true,
            exchangeRate: true,
            baseAmount: true,
          },
        },
      },
    });
  });

  /**
   * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`A-74`) — **el neto descuenta el equivalente, no el monto crudo**.
   *
   * Una devolución de `US$20` sobre un pedido en córdobas: el neto tiene que bajar 20 × 36.5 = `C$730`, no
   * `20`. El `expected` sale de la regla del negocio (monto × tasa), no del helper bajo prueba.
   */
  it("descuenta la devolución en su equivalente cuando está en otra moneda (A-74)", async () => {
    orderFindManyMock.mockResolvedValueOnce([
      {
        id: "order-refunded",
        type: "pickup",
        status: "picked_up",
        total: decimal(1000),
        statusHistory: [
          { status: "picked_up", createdAt: new Date("2026-07-20T15:00:00.000Z") },
        ],
        items: [
          { productId: "product-a", productName: "Tostada", quantity: 1, lineTotal: decimal(1000) },
        ],
        refunds: [
          {
            amount: decimal(20),
            currency: "USD",
            baseCurrencyCode: "NIO",
            exchangeRate: decimal(36.5),
            baseAmount: decimal(730),
          },
        ],
      },
    ]);

    const result = await getAdminOverviewPerformance(
      "7d",
      "all",
      "America/Managua",
      new Date("2026-07-22T18:30:00.000Z"),
    );

    // 1000 − 730 = 270.
    expect(result.data.metrics.completedOrderValue.current).toBe(270);
  });

  /**
   * `A-74` + `D-020` — una devolución **legacy** cuyo equivalente no se puede demostrar no se resta: el neto
   * no inventa una equivalencia con la tasa de hoy. Queda declarada como no imputable.
   */
  it("no resta una devolución legacy sin snapshot demostrable (D-020)", async () => {
    orderFindManyMock.mockResolvedValueOnce([
      {
        id: "order-legacy-refund",
        type: "pickup",
        status: "picked_up",
        total: decimal(1000),
        statusHistory: [
          { status: "picked_up", createdAt: new Date("2026-07-20T15:00:00.000Z") },
        ],
        items: [
          { productId: "product-a", productName: "Tostada", quantity: 1, lineTotal: decimal(1000) },
        ],
        refunds: [
          {
            amount: decimal(20),
            currency: "USD",
            baseCurrencyCode: null,
            exchangeRate: null,
            baseAmount: null,
          },
        ],
      },
    ]);

    const result = await getAdminOverviewPerformance(
      "7d",
      "all",
      "America/Managua",
      new Date("2026-07-22T18:30:00.000Z"),
    );

    expect(result.data.metrics.completedOrderValue.current).toBe(1000);
  });

  it("uses the selected permitted channel without broadening to table", async () => {
    orderFindManyMock.mockResolvedValueOnce([]);

    const result = await getAdminOverviewPerformance(
      "today",
      "pickup",
      "America/Managua",
      new Date("2026-07-22T18:30:00.000Z"),
    );

    expect(result.data.metrics.completedOrderCount.current).toBe(0);
    expect(result.data.series).toHaveLength(24);
    expect(orderFindManyMock.mock.calls[0][0].where.type).toBe("pickup");
  });
});
