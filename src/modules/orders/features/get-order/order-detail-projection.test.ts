import { describe, expect, it } from "vitest";

import { projectOrderDetail } from "@/modules/orders/features/get-order/order-detail-projection";
import type { OrderRecord, PaymentRecord } from "@/modules/orders/domain/order.types";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **`OrderDetailProjection`**: el detalle completo del pedido, con el recorte
 * financiero aplicado **en el servidor**.
 *
 * Lo que estos casos fijan:
 *
 * 1. **Con capacidad financiera** (`canViewOrderFinancials`) el detalle trae todo: montos, cobros, PIN de
 *    retiro y el documento.
 * 2. **Sin capacidad** los campos financieros **no existen en la respuesta**: no se devuelven en `null`
 *    para que React los esconda —no mandarlos es la única forma de que no se filtren—. Cocina opera
 *    `/admin/kitchen` y no maneja plata (`A-60`).
 * 3. **El historial es el real**: cada fila de `OrderStatusHistory` con su hora y su **actor**, y los sellos
 *    por etapa derivados con `resolveOrderStageTimes` (una sola vez, en el dominio).
 * 4. **El recorrido sale del historial**, no de un mapa paralelo: si el pedido nunca pasó por `preparing`,
 *    esa etapa no tiene sello.
 */

const ORDER: OrderRecord = {
  id: "ord_1",
  orderNumber: "P-1059",
  type: "pickup",
  status: "ready_for_pickup",
  locationId: "loc_camino",
  source: "pos",
  currencyCode: "NIO",
  customerName: "Mostrador",
  customerWhatsapp: "+50588887777",
  items: [
    {
      id: "item_1",
      productId: "prod_1",
      productName: "Doble Bacon",
      quantity: 2,
      unitPrice: 250,
      packagingUnitAmount: 10,
      packagingQuantity: 2,
      packagingTotalAmount: 20,
      lineTotal: 500,
      notes: "Extra salsa",
      modifiers: [
        { id: "mod_1", modifierOptionId: "opt_1", name: "Queso extra", priceDelta: 20 },
      ],
    },
  ],
  subtotal: 320,
  discount: 0,
  packagingAmount: 20,
  deliveryFeeAmount: 0,
  tipAmount: 10,
  tipRate: null,
  total: 350,
  createdAt: "2026-09-30T17:10:00.000Z",
  updatedAt: "2026-09-30T17:25:00.000Z",
  pickupTime: "2026-09-30T17:45:00.000Z",
  pickupScheduled: false,
  pickupPin: "4821",
  paymentMethod: "cash",
  paidWithAmount: 400,
  // Campos que el detalle **no** debe proyectar nunca: ni el hash del token con el que el cliente
  // consulta su pedido, ni el GPS (delivery está fuera del MVP).
  orderLookupTokenHash: "hash-de-consulta",
  customerLat: 12.13,
  customerLng: -86.25,
  geoAccuracy: 5,
  geoCapturedAt: "2026-09-30T17:09:00.000Z",
};

const HISTORY = [
  {
    id: "hist_1",
    orderId: "ord_1",
    status: "new" as const,
    note: null,
    changedByUserId: null,
    createdAt: "2026-09-30T17:10:00.000Z",
  },
  {
    id: "hist_2",
    orderId: "ord_1",
    status: "confirmed" as const,
    note: null,
    changedByUserId: "admin_ana",
    createdAt: "2026-09-30T17:11:00.000Z",
  },
  {
    id: "hist_3",
    orderId: "ord_1",
    status: "preparing" as const,
    note: "sin cebolla",
    changedByUserId: "admin_luis",
    createdAt: "2026-09-30T17:12:00.000Z",
  },
  {
    id: "hist_4",
    orderId: "ord_1",
    status: "ready_for_pickup" as const,
    note: null,
    changedByUserId: "admin_luis",
    createdAt: "2026-09-30T17:25:00.000Z",
  },
];

const PAYMENTS: PaymentRecord[] = [
  {
    id: "pay_1",
    orderId: "ord_1",
    method: "cash",
    amount: 350,
    currency: "NIO",
    changeAmount: 50,
    tip: 0,
    reference: null,
    createdAt: "2026-09-30T17:10:30.000Z",
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    baseCurrencyCode: "NIO",
    exchangeRate: null,
    baseAmount: 350,
  },
];

const FINANCIAL = {
  status: "paid" as const,
  paidAmount: 350,
  outstandingAmount: 0,
  unresolvedAmount: 0,
};

const INTERNAL_BASE = "http://localhost/admin";

function project(options: { canViewFinancials: boolean }) {
  const result = projectOrderDetail(
    {
      order: ORDER,
      pickupLocation: null,
      payments: PAYMENTS,
      history: HISTORY,
      actorNames: new Map([
        ["admin_ana", "Ana Pérez"],
        ["admin_luis", "Luis Gómez"],
      ]),
      financial: options.canViewFinancials ? FINANCIAL : null,
      invoice: options.canViewFinancials
        ? {
            id: "inv_1",
            number: "F-001284",
            issuedAt: "2026-09-30T17:11:00.000Z",
            currencyCode: "NIO",
            total: 350,
            voidedAt: null,
          }
        : null,
    },
    { canViewFinancials: options.canViewFinancials, internalBaseUrl: INTERNAL_BASE },
  );

  return result;
}

describe("projectOrderDetail · con capacidad financiera", () => {
  it("trae los items, sus modificadores y las notas", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.items).toHaveLength(1);
    expect(detail.items[0].productName).toBe("Doble Bacon");
    expect(detail.items[0].quantity).toBe(2);
    expect(detail.items[0].notes).toBe("Extra salsa");
    expect(detail.items[0].modifiers[0]).toMatchObject({
      id: "mod_1",
      name: "Queso extra",
      priceDelta: 20,
    });
  });

  it("trae el estado financiero de `payments` y los cobros con su detalle", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.financial).toEqual({
      status: "paid",
      paidAmount: 350,
      outstandingAmount: 0,
      unresolvedAmount: 0,
      baseCurrencyCode: "NIO",
    });
    expect(detail.payments).toHaveLength(1);
    expect(detail.payments[0]).toMatchObject({ method: "cash", amount: 350, currency: "NIO" });
  });

  it("trae el PIN de retiro y el documento", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.pickupPin).toBe("4821");
    expect(detail.invoice?.number).toBe("F-001284");
    expect(detail.canViewFinancials).toBe(true);
  });

  it("trae los montos del pedido y el vuelto declarado", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.totals).toEqual({
      subtotal: 320,
      discount: 0,
      packagingAmount: 20,
      deliveryFeeAmount: 0,
      tipAmount: 10,
      total: 350,
      paidWithAmount: 400,
    });
  });

  it("la factura viaja con su URL de impresión ya armada, no la compone la pantalla", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.invoice?.printUrl).toBe(
      `${INTERNAL_BASE}/orders/ord_1/invoice/print`,
    );
  });
});

describe("projectOrderDetail · sin capacidad financiera (A-60)", () => {
  it("no expone NINGÚN campo financiero", () => {
    const detail = project({ canViewFinancials: false });

    expect(detail.financial).toBeNull();
    expect(detail.payments).toEqual([]);
    expect(detail.invoice).toBeNull();
    expect(detail.pickupPin).toBeNull();
    expect(detail.totals).toBeNull();
    expect(detail.canViewFinancials).toBe(false);
  });

  it("los campos prohibidos no aparecen ni siquiera en el JSON serializado", () => {
    const projection = project({ canViewFinancials: false });
    const serialized = JSON.stringify(projection);

    // Las claves siguen existiendo (con `null`) para que el tipo sea uno solo —la pantalla necesita saber
    // que **no** hay plata, y `canViewFinancials: false` lo dice—, pero **ningún valor** financiero viaja.
    expect(projection.financial).toBeNull();
    expect(projection.payments).toEqual([]);
    expect(projection.invoice).toBeNull();
    expect(projection.pickupPin).toBeNull();
    expect(projection.totals).toBeNull();

    for (const forbidden of [
      "paidAmount",
      "outstandingAmount",
      "unresolvedAmount",
      "4821",
      "F-001284",
      "printUrl",
      "voidReason",
    ]) {
      expect(serialized, `no puede viajar «${forbidden}»`).not.toContain(forbidden);
    }
  });

  /**
   * El detalle **sí** sirve para operar: cocina no, pero un rol sin capacidad financiera tendría que poder
   * ver los items, el retiro y el historial. Eso es lo que queda cuando la plata se recorta.
   */
  it("conserva lo operativo: items, cliente, retiro e historial con actor", () => {
    const detail = project({ canViewFinancials: false });

    expect(detail.items).toHaveLength(1);
    expect(detail.customer.name).toBe("Mostrador");
    expect(detail.pickup.mode).toBeDefined();
    expect(detail.history).toHaveLength(4);
    expect(detail.history[1].actor).toBe("Ana Pérez");
  });
});

describe("projectOrderDetail · el historial real y los sellos", () => {
  it("cada evento trae su hora y su actor resuelto", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.history.map((event) => event.status)).toEqual([
      "new",
      "confirmed",
      "preparing",
      "ready_for_pickup",
    ]);
    expect(detail.history[0].actor).toBeNull();
    expect(detail.history[1].actor).toBe("Ana Pérez");
    expect(detail.history[2].actor).toBe("Luis Gómez");
    expect(detail.history[2].note).toBe("sin cebolla");
  });

  it("un actor borrado no rompe: el evento queda sin nombre", () => {
    const result = projectOrderDetail(
      {
        order: ORDER,
        pickupLocation: null,
        payments: [],
        history: HISTORY,
        actorNames: new Map(),
        financial: null,
        invoice: null,
      },
      { canViewFinancials: false, internalBaseUrl: INTERNAL_BASE },
    );

    expect(result.history[1].actor).toBeNull();
  });

  it("los sellos por etapa salen del historial, con la regla del dominio", () => {
    const detail = project({ canViewFinancials: true });

    expect(detail.stageTimes).toEqual({
      confirmedAt: "2026-09-30T17:11:00.000Z",
      preparingAt: "2026-09-30T17:12:00.000Z",
      readyAt: "2026-09-30T17:25:00.000Z",
      pickedUpAt: null,
      closedAt: null,
    });
  });

  it("lo que nunca pasó no tiene sello (no se inventa la etapa)", () => {
    const detail = projectOrderDetail(
      {
        order: { ...ORDER, status: "new" },
        pickupLocation: null,
        payments: [],
        history: [HISTORY[0]],
        actorNames: new Map(),
        financial: null,
        invoice: null,
      },
      { canViewFinancials: false, internalBaseUrl: INTERNAL_BASE },
    );

    expect(detail.stageTimes).toEqual({
      confirmedAt: null,
      preparingAt: null,
      readyAt: null,
      pickedUpAt: null,
      closedAt: null,
    });
  });
});

describe("projectOrderDetail · lo que nunca sale", () => {
  it("ni el token de consulta del cliente ni el GPS", () => {
    const serialized = JSON.stringify(project({ canViewFinancials: true }));

    for (const forbidden of [
      "orderLookupTokenHash",
      "hash-de-consulta",
      "customerLat",
      "customerLng",
      "geoAccuracy",
      "geoCapturedAt",
    ]) {
      expect(serialized, `no puede viajar «${forbidden}»`).not.toContain(forbidden);
    }
  });
});
