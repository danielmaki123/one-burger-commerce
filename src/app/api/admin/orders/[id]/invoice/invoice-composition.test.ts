import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";

const findOrderByIdMock = vi.fn();

vi.mock("@/modules/orders/adapters/prisma-order-repository", () => ({
  PrismaOrderRepository: vi.fn(function () {
    return { findOrderById: findOrderByIdMock };
  }),
}));

vi.mock("@/modules/invoices/adapters/production-invoice", () => ({
  createProductionInvoiceDependencies: async () => ({
    invoiceRepository: {
      findByOrderId: async () => null,
      findLatestNumber: async () => null,
      create: async () => {
        throw new Error("no se emite en este test");
      },
      createNextForOrder: async () => {
        throw new Error("no se emite en este test");
      },
      findById: async () => null,
      list: async () => [],
      void: async () => {
        throw new Error("no aplica");
      },
    },
    /**
     * `A-70` — el pedido tiene que existir para que el caso de uso de la factura llegue a mirarlo. El
     * alcance se comprueba **antes**, así que un pedido ajeno se rechaza sin pasar por acá.
     */
    findOrder: async (orderId: string) => ({
      id: orderId,
      status: "picked_up",
      customerName: "Ana",
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      total: 100,
    }),
    getOrderPaymentStatus: async () => ({ status: "pending" }),
    business: { name: "One Burger", currencyCode: "NIO" },
  }),
}));

/**
 * `TASK-ORDERS-RUNTIME-5B` — **la fuga lateral de la factura (`A-70`)**.
 *
 * La auditoría de fundaciones la midió así: el `GET` sólo exigía sesión, el `POST` usaba `canUsePOS` (la
 * puerta **gruesa**) y **ninguno** aplicaba el alcance por sucursal. Consecuencia real: `kitchen` leía e
 * imprimía el documento de un pedido, y cualquier rol con sesión leía la factura de una sucursal ajena.
 *
 * Lo que estos casos fijan: la lectura exige `canViewOrderFinancials` —el documento **es** plata—, la
 * emisión exige `canCollectPayment` —la capacidad nominal del cobro—, y las dos comprueban el alcance
 * **antes** de tocar el documento. El orden importa: un pedido ajeno se rechaza sin leer su factura.
 */
describe("loadOrderInvoiceState · A-70", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findOrderByIdMock.mockResolvedValue({ id: "ord_1", locationId: "loc_norte" });
  });

  async function load(role: string, assignedLocationIds: string[] = []) {
    const { loadOrderInvoiceState } = await import("./invoice-composition");

    return loadOrderInvoiceState({
      orderId: "ord_1",
      role: role as never,
      assignedLocationIds,
    });
  }

  it("cocina no lee la factura: 403 (no maneja plata)", async () => {
    await expect(load("kitchen")).rejects.toBeInstanceOf(AuthError);
  });

  it("el dueño, el manager y el cajero sí la leen", async () => {
    for (const role of ["owner", "manager", "cashier"]) {
      await expect(load(role)).resolves.toMatchObject({ invoice: null });
    }
  });

  it("un rol acotado no lee la factura de otra sucursal, ni sabiendo el id", async () => {
    await expect(load("manager", ["loc_sur"])).rejects.toMatchObject({ status: 403 });
  });

  it("un rol acotado sí lee la de su sucursal", async () => {
    await expect(load("manager", ["loc_norte", "loc_sur"])).resolves.toMatchObject({ invoice: null });
  });

  it("un pedido que no existe responde 404", async () => {
    findOrderByIdMock.mockResolvedValue(null);

    await expect(load("owner")).rejects.toMatchObject({ status: 404 });
  });

  it("`canEmit` sigue la capacidad del cobro: el cajero puede, cocina no llega ni a leer", async () => {
    await expect(load("cashier")).resolves.toMatchObject({ canEmit: true });
  });
});

describe("emitOrderInvoice · A-70", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findOrderByIdMock.mockResolvedValue({ id: "ord_1", locationId: "loc_norte" });
  });

  async function emit(role: string, assignedLocationIds: string[] = []) {
    const { emitOrderInvoice } = await import("./invoice-composition");

    return emitOrderInvoice({
      orderId: "ord_1",
      role: role as never,
      assignedLocationIds,
      actorUserId: "admin_1",
      body: {},
    });
  }

  it("cocina no emite: 403 antes de tocar nada", async () => {
    await expect(emit("kitchen")).rejects.toMatchObject({ status: 403 });
  });

  it("un rol acotado no emite la factura de otra sucursal", async () => {
    await expect(emit("cashier", ["loc_sur"])).rejects.toMatchObject({ status: 403 });
  });

  it("la puerta no es `canUsePOS`: la decisión se toma con la capacidad del cobro", async () => {
    // Si la emisión se hubiera quedado con la puerta gruesa, un rol que hoy no cobra podría emitir. El
    // contrato de la capacidad nominal está en `admin-permissions.test.ts`; acá se fija que esta ruta la use:
    // cocina recibe `403` —la puerta— y el cajero pasa la puerta (y después choca con la regla del negocio,
    // que exige el pedido cobrado).
    await expect(emit("kitchen")).rejects.toMatchObject({ status: 403 });

    const cashier = await emit("cashier", ["loc_norte"]).catch((error: unknown) => error);
    expect(cashier).not.toMatchObject({ status: 403 });
  });
});
