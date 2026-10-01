import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const findOrderByIdMock = vi.fn();
const listPaymentsByOrderMock = vi.fn();
const getStatusHistoryMock = vi.fn();
const listLocationsMock = vi.fn();
const findLocationByIdMock = vi.fn();
const listUserNamesMock = vi.fn();
const findByOrderIdInvoiceMock = vi.fn();
const readProductionMoneyMock = vi.fn();
const getOrderPaymentStatusMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () {
    return {
      findOrderById: findOrderByIdMock,
      getOrderStatusHistory: getStatusHistoryMock,
    };
  }),
}));

vi.mock("@/modules/orders/adapters/prisma-payment-repository", () => ({
  PrismaPaymentRepository: vi.fn(function () {
    return { listPaymentsByOrder: listPaymentsByOrderMock };
  }),
}));

vi.mock("@/modules/locations/adapters/prisma-location-repository", () => ({
  PrismaLocationRepository: vi.fn(function () {
    return { listLocations: listLocationsMock, findLocationById: findLocationByIdMock };
  }),
}));

vi.mock("@/modules/auth/adapters/prisma-admin-auth-repository", () => ({
  PrismaAdminAuthRepository: vi.fn(function () {
    return { listUserNames: listUserNamesMock };
  }),
}));

vi.mock("@/modules/invoices/adapters/prisma-invoice-repository", () => ({
  PrismaInvoiceRepository: vi.fn(function () {
    return { findByOrderId: findByOrderIdInvoiceMock };
  }),
}));

vi.mock("@/modules/money/adapters/production-money-context", () => ({
  readProductionMoney: readProductionMoneyMock,
}));

vi.mock("@/modules/payments/features/get-order-payment-status/get-order-payment-status", () => ({
  getOrderPaymentStatus: getOrderPaymentStatusMock,
}));

const ORDER = {
  id: "ord_1",
  orderNumber: "P-1059",
  type: "pickup",
  status: "ready_for_pickup",
  locationId: "loc_camino",
  source: "pos",
  currencyCode: "NIO",
  customerName: "Mostrador",
  customerWhatsapp: "+50588887777",
  items: [],
  subtotal: 320,
  discount: 0,
  packagingAmount: 20,
  deliveryFeeAmount: 0,
  tipAmount: 10,
  total: 350,
  createdAt: "2026-09-30T17:10:00.000Z",
  updatedAt: "2026-09-30T17:25:00.000Z",
  pickupTime: "2026-09-30T17:45:00.000Z",
  pickupScheduled: false,
  pickupPin: "4821",
  paymentMethod: "cash",
};

/**
 * `TASK-ORDERS-RUNTIME-5B` — **la composición del detalle**: sus dos puertas de servidor.
 *
 * Es el camino que el `route.ts` usa, y sus dos reglas son las que la revisión adversarial intenta romper:
 *
 * 1. **El recorte financiero** (`A-60`): sin `canViewOrderFinancials` la proyección **no lleva un solo campo
 *    financiero**, aunque el pedido tenga cobros, PIN y factura. No se devuelven en `null` para que React los
 *    esconda: no se proyectan.
 * 2. **El alcance por sucursal**: un pedido de otra sucursal se rechaza **antes** de resolver el estado
 *    financiero, leer la factura y resolver los nombres del historial.
 * 3. **El estado financiero es el de `payments`**: la composición lo **consume** (`getOrderPaymentStatus`) y
 *    no lo recalcula con lo que tiene a mano.
 */
describe("loadOrderDetail · el recorte financiero (A-60)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findOrderByIdMock.mockResolvedValue(ORDER);
    listLocationsMock.mockResolvedValue([]);
    findLocationByIdMock.mockResolvedValue(null);
    getStatusHistoryMock.mockResolvedValue([]);
    listUserNamesMock.mockResolvedValue([]);
    findByOrderIdInvoiceMock.mockResolvedValue(null);
    readProductionMoneyMock.mockResolvedValue({ context: { baseCurrencyCode: "NIO" } });
    listPaymentsByOrderMock.mockResolvedValue([
      {
        id: "pay_1",
        orderId: "ord_1",
        method: "cash",
        amount: 350,
        currency: "NIO",
        changeAmount: 0,
        tip: 0,
        reference: null,
        createdAt: "2026-09-30T17:11:00.000Z",
        voidedAt: null,
        voidedByUserId: null,
        voidReason: null,
        baseCurrencyCode: "NIO",
        exchangeRate: null,
        baseAmount: 350,
      },
    ]);
  });

  async function load(role: string) {
    const { loadOrderDetail } = await import("./order-detail-composition");

    return loadOrderDetail({
      orderId: "ord_1",
      role: role as never,
      origin: "http://localhost",
    });
  }

  it("con capacidad financiera el detalle trae montos, cobros, PIN y factura", async () => {
    getOrderPaymentStatusMock.mockResolvedValue({
      status: "paid",
      paidAmount: 350,
      outstandingAmount: 0,
      unresolvedAmount: 0,
      baseCurrencyCode: "NIO",
    });
    findByOrderIdInvoiceMock.mockResolvedValue({
      id: "inv_1",
      number: "F-000001",
      issuedAt: "2026-09-30T17:12:00.000Z",
      currencyCode: "NIO",
      total: 350,
      voidedAt: null,
    });

    const detail = await load("cashier");

    expect(detail.canViewFinancials).toBe(true);
    expect(detail.financial?.status).toBe("paid");
    expect(detail.payments).toHaveLength(1);
    expect(detail.pickupPin).toBe("4821");
    expect(detail.totals?.total).toBe(350);
    expect(detail.invoice?.number).toBe("F-000001");
  });

  it("sin capacidad financiera no hay un solo campo de plata (A-60)", async () => {
    const detail = await load("kitchen");

    expect(detail.canViewFinancials).toBe(false);
    expect(detail.financial).toBeNull();
    expect(detail.payments).toEqual([]);
    expect(detail.pickupPin).toBeNull();
    expect(detail.totals).toBeNull();
    expect(detail.invoice).toBeNull();

    // Y el estado financiero **no se resuelve**: no hay nada que recortar después.
    expect(getOrderPaymentStatusMock).not.toHaveBeenCalled();
  });

  it("el estado financiero sale de `payments`, con la moneda base de `money`", async () => {
    getOrderPaymentStatusMock.mockResolvedValue({
      status: "partial",
      paidAmount: 100,
      outstandingAmount: 250,
      unresolvedAmount: 40,
      baseCurrencyCode: "NIO",
    });

    const detail = await load("manager");

    expect(getOrderPaymentStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ord_1", total: 350, baseCurrencyCode: "NIO" }),
    );
    /**
     * Y lo que la proyección devolvió **se pasa tal cual**: la composición no recalcula el estado con lo que
     * tiene a mano (contar cobros, comparar contra el total). Si alguien lo recalculara, estos montos
     * cambiarían y el test lo dice.
     */
    expect(detail.financial).toMatchObject({
      status: "partial",
      paidAmount: 100,
      outstandingAmount: 250,
      unresolvedAmount: 40,
    });
  });
});

describe("loadOrderDetailForSession · el alcance por sucursal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findOrderByIdMock.mockResolvedValue(ORDER);
    listLocationsMock.mockResolvedValue([]);
    findLocationByIdMock.mockResolvedValue(null);
    getStatusHistoryMock.mockResolvedValue([]);
    listUserNamesMock.mockResolvedValue([]);
    findByOrderIdInvoiceMock.mockResolvedValue(null);
    readProductionMoneyMock.mockResolvedValue({ context: { baseCurrencyCode: "NIO" } });
    listPaymentsByOrderMock.mockResolvedValue([]);
    getOrderPaymentStatusMock.mockResolvedValue({
      status: "pending",
      paidAmount: 0,
      outstandingAmount: 350,
      unresolvedAmount: 0,
      baseCurrencyCode: "NIO",
    });
  });

  async function load(assignedLocationIds: string[]) {
    const { loadOrderDetailForSession } = await import("./order-detail-composition");

    return loadOrderDetailForSession({
      orderId: "ord_1",
      role: "manager" as never,
      assignedLocationIds,
      origin: "http://localhost",
    });
  }

  it("un pedido de otra sucursal se rechaza con 403", async () => {
    await expect(load(["loc_sur"])).rejects.toMatchObject({ status: 403 });
  });

  /**
   * Y el rechazo es **antes** de tocar nada más: no se resuelve el estado financiero, no se lee la factura y
   * no se resuelven los nombres del historial. Es lo que hace que el 403 no dependa de qué campos se muestren.
   */
  it("el rechazo ocurre antes de resolver la plata, la factura y los actores", async () => {
    await expect(load(["loc_sur"])).rejects.toBeInstanceOf(AuthError);

    expect(getOrderPaymentStatusMock).not.toHaveBeenCalled();
    expect(findByOrderIdInvoiceMock).not.toHaveBeenCalled();
    expect(listUserNamesMock).not.toHaveBeenCalled();
  });

  it("un pedido de su sucursal sí se proyecta", async () => {
    const detail = await load(["loc_camino"]);

    expect(detail.locationId).toBe("loc_camino");
  });

  it("un pedido que no existe responde 404", async () => {
    findOrderByIdMock.mockResolvedValue(null);

    await expect(load(["loc_camino"])).rejects.toMatchObject({ status: 404 });
  });
});
