import { describe, expect, it } from "vitest";

import type { OrderRecord } from "@/modules/orders/domain/order.types";

import {
  buildOrderCreatedNotificationPayload,
  formatOrderCreatedTelegramMessage,
} from "./order-created-notification";

function createOrder(overrides?: Partial<OrderRecord>): OrderRecord {
  return {
    id: "ord_internal_01",
    orderNumber: "D-TEST100",
    type: "delivery",
    status: "new",
    customerName: "TASK 100 QA",
    customerWhatsapp: "+50588888888",
    items: [
      {
        id: "item_01",
        productId: "prod_01",
        productName: "Prime Rib Steak",
        quantity: 2,
        unitPrice: 740,
        packagingUnitAmount: 35,
        packagingQuantity: 2,
        packagingTotalAmount: 70,
        modifiers: [
          {
            id: "mod_01",
            modifierOptionId: "opt_01",
            name: "Término medio",
            priceDelta: 0,
          },
          {
            id: "mod_02",
            modifierOptionId: "opt_02",
            name: "Papas de la casa",
            priceDelta: 0,
          },
        ],
        notes: null,
        lineTotal: 1480,
      },
      {
        id: "item_02",
        productId: "prod_02",
        productName: "Kushiague",
        quantity: 1,
        unitPrice: 289.95,
        packagingUnitAmount: 35,
        packagingQuantity: 1,
        packagingTotalAmount: 35,
        modifiers: [
          {
            id: "mod_03",
            modifierOptionId: "opt_03",
            name: "MOZZARELLA",
            priceDelta: 0,
          },
        ],
        notes: null,
        lineTotal: 289.95,
      },
    ],
    subtotal: 2194.95,
    discount: 0,
    packagingAmount: 105,
    deliveryFeeAmount: 60,
    tipAmount: 219.5,
    tipRate: 10,
    total: 2579.45,
    createdAt: "2026-06-27T22:53:39.000Z",
    updatedAt: "2026-06-27T22:53:39.000Z",
    address: "One Burger staging 123",
    deliveryNotes: "Validación TASK-100",
    deliveryFeeStatus: "pending_manual_validation",
    pickupTime: null,
    pickupNotes: null,
    tableId: null,
    couponCode: null,
    deliveryZoneId: "zone_01",
    deliveryZoneName: "Jinotepe",
    customerLat: null,
    customerLng: null,
    geoAccuracy: null,
    geoCapturedAt: null,
    orderLookupTokenHash: "hash_01",
    ...overrides,
  };
}

describe("order created notification helpers", () => {
  it("builds an outbox payload with line packaging and totals breakdown", () => {
    const payload = buildOrderCreatedNotificationPayload(createOrder());

    expect(payload.event).toBe("new_order");
    expect(payload.order_id).toBe("D-TEST100");
    expect(payload.internal_id).toBe("ord_internal_01");
    expect(payload.customer.type).toBe("DELIVERY");
    expect(payload.ticket.items).toContain(
      "2 x Prime Rib Steak [Término medio, Papas de la casa]",
    );
    expect(payload.ticket.items).toContain("Empaque: C$35.00 x 2 = C$70.00");
    expect(payload.ticket.items).toContain("1 x Kushiague [MOZZARELLA]");
    expect(payload.ticket.items).toContain("Empaque: C$35.00 x 1 = C$35.00");
    expect(payload.ticket.items).toContain("RESUMEN:");
    expect(payload.ticket.items).toContain("Subtotal: C$2,194.95");
    expect(payload.ticket.items).toContain("Empaque: C$105.00");
    expect(payload.ticket.items).toContain("Envío: C$60.00");
    expect(payload.ticket.items).toContain("Propina 10%: C$219.50");
    expect(payload.ticket.total).toBe("C$2,579.45");
  });

  it("formats a Telegram message with breakdown and without losing final total", () => {
    const message = formatOrderCreatedTelegramMessage(
      buildOrderCreatedNotificationPayload(createOrder()),
    );

    expect(message).toContain("🛎️ NUEVA ORDEN - ONE BURGER");
    expect(message).toContain("ORDEN: #D-TEST100");
    expect(message).toContain("ID INTERNO: ord_internal_01");
    expect(message).toContain("RESUMEN:");
    expect(message).toContain("Subtotal: C$2,194.95");
    expect(message).toContain("Empaque: C$105.00");
    expect(message).toContain("Envío: C$60.00");
    expect(message).toContain("Propina 10%: C$219.50");
    expect(message).toContain("TOTAL: C$2,579.45");
    expect(message).toContain("https://wa.me/50588888888");
  });

  it("marks omitted tip clearly when the customer removes it", () => {
    const payload = buildOrderCreatedNotificationPayload(
      createOrder({
        tipAmount: 0,
        tipRate: null,
        total: 2359.95,
      }),
    );

    expect(payload.ticket.items).toContain("Propina: C$0.00");
    expect(payload.ticket.total).toBe("C$2,359.95");
  });

  it("escapes HTML from customer input in the Telegram ticket", () => {
    const payload = buildOrderCreatedNotificationPayload(
      createOrder({
        customerName: "<b>Daniel</b> & <a href='https://evil.example'>link</a>",
        address: "TOTAL: C$1.00 <b>falso</b>",
      }),
    );
    const message = formatOrderCreatedTelegramMessage(payload);

    expect(message).not.toContain("<b>");
    expect(message).not.toContain("<a href");
    expect(message).toContain("&lt;b&gt;Daniel&lt;/b&gt; &amp;");
    expect(message).toContain("TOTAL: C$2,579.45");
  });

  it("keeps raw customer text in the JSON payload for non-Telegram channels", () => {
    const payload = buildOrderCreatedNotificationPayload(
      createOrder({ customerName: "Ana & <Luis>" }),
    );

    expect(payload.customer.name).toBe("Ana & <Luis>");
  });
});
