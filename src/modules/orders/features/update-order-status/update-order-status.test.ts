import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";


import { updateOrderStatus } from "./update-order-status";

function createRepository(): InMemoryOrderRepository {
  return new InMemoryOrderRepository();
}

describe("updateOrderStatus", () => {
  it("allows valid delivery transition new -> confirmed", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      locationId: "loc_principal",
      type: "delivery",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await updateOrderStatus("ord_01", { status: "confirmed", note: "ok" }, { repository });
    expect(result.data.status).toBe("confirmed");
    expect(result.meta.note).toBe("ok");
  });

  /**
   * B5 — cada cambio de estado queda firmado.
   *
   * Con una cuenta compartida en la cocina, el historial es lo único que puede responder quién aceptó
   * o rechazó un pedido; sin esto, la pregunta queda sin respuesta para siempre.
   */
  it("deja asentado quién hizo el cambio", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      locationId: "loc_principal",
      type: "delivery",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await updateOrderStatus(
      "ord_01",
      { status: "confirmed", changedByUserId: "admin_7" },
      { repository },
    );

    const history = await repository.getOrderStatusHistory("ord_01");
    expect(history[history.length - 1]).toMatchObject({
      status: "confirmed",
      changedByUserId: "admin_7",
    });
  });

  it("rejects invalid transition new -> closed for delivery", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "D-1",
      locationId: "loc_principal",
      type: "delivery",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      updateOrderStatus("ord_01", { status: "closed" }, { repository }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("rejects invalid transition for table new -> served", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_01",
      orderNumber: "T-1",
      locationId: "loc_principal",
      type: "table",
      status: "new",
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      updateOrderStatus("ord_01", { status: "served" }, { repository }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("returns 404 for missing order", async () => {
    const repository = createRepository();
    await expect(
      updateOrderStatus("ord_missing", { status: "confirmed" }, { repository }),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("allows cancelling from preparing with required note", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_02",
      orderNumber: "D-2",
      locationId: "loc_principal",
      type: "delivery",
      status: "preparing",
      customerName: "Ana",
      customerWhatsapp: "+50588889999",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await updateOrderStatus("ord_02", { status: "cancelled", note: "Cliente cancelo" }, { repository });
    expect(result.data.status).toBe("cancelled");
  });

  it("rejects cancelled transition without note", async () => {
    const repository = createRepository();
    repository.orders.push({
      id: "ord_03",
      orderNumber: "D-3",
      locationId: "loc_principal",
      type: "delivery",
      status: "new",
      customerName: "Pedro",
      customerWhatsapp: "+50588880000",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      updateOrderStatus("ord_03", { status: "cancelled" }, { repository }),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});

/**
 * Bloque 3.5 del roadmap del POS (Fase 2) — cancelar un pedido **ya cobrado** avisa al admin.
 *
 * Es el agujero de plata que quedaba (A-15 del backlog de UI): el cobro de un pedido cancelado seguía
 * contando en el arqueo y nadie se enteraba de que había que devolver la plata. Ahora la cancelación
 * deja una **devolución pendiente** por cada cobro y publica el aviso; el admin la ve en
 * `/admin/approvals` y decide. El esperado del turno **no** cambia hasta que se apruebe: la plata
 * todavía está en el cajón.
 */
describe("cancelar un pedido cobrado", () => {
  function orderPaid(id: string) {
    return {
      id,
      orderNumber: "P-1",
      locationId: "loc_principal",
      type: "pickup" as const,
      status: "preparing" as const,
      customerName: "Juan",
      customerWhatsapp: "+50588887777",
      items: [],
      subtotal: 100,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const payment = {
    id: "pay_01",
    orderId: "ord_01",
    method: "cash" as const,
    amount: 100,
    currency: "NIO",
    changeAmount: 0,
    tip: 0,
    reference: null,
    createdAt: new Date().toISOString(),
  };

  function deps(payments: (typeof payment)[]) {
    const repository = createRepository();
    repository.orders.push(orderPaid("ord_01"));

    const created: { paymentId: string; amount: number; reason: string }[] = [];

    return {
      created,
      repository,
      deps: {
        repository,
        paymentRepository: {
          async listPaymentsByOrder() {
            return payments;
          },
        },
        refundRepository: {
          async create(input: {
            paymentId: string;
            amount: number;
            reason: string;
            status: string;
          }) {
            created.push(input);
            return { id: "ref_1", ...input };
          },
          async listByPayment() {
            return [];
          },
        },
      },
    };
  }

  it("deja una devolución pendiente por el cobro y avisa al admin", async () => {
    const { created, deps: dependencies } = deps([payment]);

    await updateOrderStatus(
      "ord_01",
      { status: "cancelled", note: "Cliente canceló" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dependencies as any,
    );

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      paymentId: "pay_01",
      amount: 100,
      status: "pending",
    });
    expect(created[0].reason).toContain("Cliente canceló");
  });

  it("un pedido sin cobros se cancela igual, sin devolución pendiente", async () => {
    const { created, deps: dependencies } = deps([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateOrderStatus("ord_01", { status: "cancelled", note: "Sin cobro" }, dependencies as any);

    expect(created).toEqual([]);
  });

  it("cancelar sin el puerto de cobros sigue funcionando (no es obligatorio)", async () => {
    const repository = createRepository();
    repository.orders.push(orderPaid("ord_01"));

    const result = await updateOrderStatus(
      "ord_01",
      { status: "cancelled", note: "Cliente canceló" },
      { repository },
    );

    expect(result.data.status).toBe("cancelled");
  });

  it("un cambio que no es cancelación no toca las devoluciones", async () => {
    const { created, repository, deps: dependencies } = deps([payment]);
    repository.orders[0].status = "new";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await updateOrderStatus("ord_01", { status: "confirmed" }, dependencies as any);

    expect(created).toEqual([]);
  });
});
