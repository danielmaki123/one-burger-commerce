import { describe, expect, it } from "vitest";

import type { OrderRecord } from "@/modules/orders/domain/order.types";

import {
  buildOrderCreatedNotificationPayload,
  formatOrderCreatedTelegramMessage,
} from "./order-created-notification";

describe("el ticket dice para cuándo es el retiro", () => {
  const pickupOrder = (overrides?: Partial<OrderRecord>) =>
    createOrder({ type: "pickup", pickupTime: "2026-09-12T02:00:00.000Z", ...overrides });

  it("marca los pedidos programados con su hora", () => {
    const payload = buildOrderCreatedNotificationPayload(
      pickupOrder({ pickupScheduled: true, pickupNotes: null }),
    );

    expect(payload.customer.pickup).toBe("Programado para las 8:00 p. m.");
    expect(formatOrderCreatedTelegramMessage(payload)).toContain(
      "RETIRO: Programado para las 8:00 p. m.",
    );
  });

  it("marca los pedidos sin programar como lo antes posible, con la hora estimada", () => {
    const payload = buildOrderCreatedNotificationPayload(
      pickupOrder({ pickupScheduled: false }),
    );

    expect(payload.customer.pickup).toBe("Lo antes posible (~8:00 p. m.)");
    expect(formatOrderCreatedTelegramMessage(payload)).toContain(
      "RETIRO: Lo antes posible (~8:00 p. m.)",
    );
  });

  it("usa la zona horaria del negocio, no la del servidor", () => {
    const payload = buildOrderCreatedNotificationPayload(
      pickupOrder({ pickupScheduled: true }),
      { timeZone: "Europe/Madrid" },
    );

    expect(payload.customer.pickup).toBe("Programado para las 4:00 a. m.");
  });

  it("no inventa una línea de retiro en un pedido sin hora", () => {
    const payload = buildOrderCreatedNotificationPayload(
      pickupOrder({ pickupTime: null }),
    );

    expect(payload.customer.pickup).toBeNull();
    expect(formatOrderCreatedTelegramMessage(payload)).not.toContain("RETIRO:");
  });

  it("no agrega la línea de retiro en pedidos que no son de retiro", () => {
    const payload = buildOrderCreatedNotificationPayload(createOrder());

    expect(payload.customer.pickup).toBeNull();
    expect(formatOrderCreatedTelegramMessage(payload)).not.toContain("RETIRO:");
  });

  it("sigue mostrando las notas del cliente", () => {
    const payload = buildOrderCreatedNotificationPayload(
      pickupOrder({ pickupScheduled: true, pickupNotes: "Paso en carro gris" }),
    );

    expect(payload.customer.address).toBe("Paso en carro gris");
    expect(formatOrderCreatedTelegramMessage(payload)).toContain("INFO: Paso en carro gris");
  });
});

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

  it("usa el nombre y la moneda configurados en el negocio", () => {
    const payload = buildOrderCreatedNotificationPayload(createOrder(), {
      businessName: "Burger Nick",
      currency: { symbol: "US$", locale: "en-US" },
    });
    const message = formatOrderCreatedTelegramMessage(payload);

    expect(message).toContain("🛎️ NUEVA ORDEN - BURGER NICK");
    expect(message).toContain("Subtotal: US$2,194.95");
    expect(message).toContain("TOTAL: US$2,579.45");
    expect(message).not.toContain("ONE BURGER");
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
