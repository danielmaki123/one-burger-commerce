import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BusinessSettingsProvider, FALLBACK_BUSINESS_SETTINGS } from "@/shared/lib/business-settings";

import OrderSuccessView from "./order-success-view";

describe("order success view", () => {
  function pickupOrder(overrides: Record<string, unknown> = {}) {
    return {
      orderNumber: "P-MQ71QBQ1",
      type: "pickup" as const,
      status: "new" as const,
      customerName: "Daniel",
      subtotal: 380,
      discount: 0,
      packagingAmount: 0,
      deliveryFeeAmount: 0,
      tipAmount: 0,
      tipRate: null,
      total: 380,
      items: [],
      ...overrides,
    };
  }

  function renderWith(order: Record<string, unknown>) {
    return renderToStaticMarkup(
      createElement(OrderSuccessView, { order: order as never }),
    );
  }

  it("le dice al cliente para cuándo es su retiro programado", () => {
    const html = renderWith(
      pickupOrder({ pickupTime: "2026-09-12T02:30:00.000Z", pickupScheduled: true }),
    );

    expect(html).toContain("Hora de retiro");
    expect(html).toContain("8:30 p. m.");
    expect(html).not.toContain("~8:30 p. m.");
  });

  it("marca el retiro sin programar como lo antes posible", () => {
    const html = renderWith(
      pickupOrder({ pickupTime: "2026-09-12T02:35:00.000Z", pickupScheduled: false }),
    );

    expect(html).toContain("Hora de retiro");
    expect(html).toContain("~8:35 p. m.");
  });

  it("no inventa una hora de retiro si el pedido no la tiene", () => {
    const html = renderWith(pickupOrder({ pickupTime: null }));

    expect(html).not.toContain("Hora de retiro");
  });

  it("ofrece las dos salidas del mock: seguir el pedido y volver a la carta (T6)", () => {
    // `onOrderAgain` estaba declarado y el page lo pasaba, pero la vista no lo
    // usaba: el enlace "Volver a la Carta" del mock no existía.
    const html = renderToStaticMarkup(
      createElement(OrderSuccessView, {
        order: pickupOrder({ orderNumber: "D-MQ71QBQ1" }) as never,
        onViewActivity: () => {},
        onOrderAgain: () => {},
      }),
    );

    expect(html).toContain("Ver mis pedidos");
    expect(html).toContain("Volver a la carta");
    // Y una sola confirmación: el mock repite el mensaje en dos bloques.
    expect(html.match(/¡Pedido confirmado!/g)).toHaveLength(1);
    expect(html).toContain("D-MQ71QBQ1");
  });

  it("no deja enlaces muertos como los del mock (T6)", () => {
    const html = renderWith(pickupOrder({ pickupTime: null }));

    // El mock tiene 4 `<a href="#">` en su confirmación.
    expect(html).not.toContain('href="#"');
  });

  it("dice cómo va a pagar el cliente (T11)", () => {
    // El servidor guarda la forma de pago; el cliente la ve en su resumen.
    expect(renderWith(pickupOrder({ paymentMethod: "cash" }))).toContain("Efectivo");
    expect(renderWith(pickupOrder({ paymentMethod: "card" }))).toContain("Tarjeta");
    expect(renderWith(pickupOrder({}))).toContain("Efectivo");
  });

  it("con vuelto dice con cuánto paga y cuánto le devuelven (T12)", () => {
    const html = renderWith(
      pickupOrder({ paymentMethod: "cash", paidWithAmount: 500, total: 380 }),
    );

    expect(html).toContain("Pagás con");
    expect(html).toContain("C$500.00");
    expect(html).toContain("Cambio");
    expect(html).toContain("C$120.00");

    // Sin monto declarado no se inventa un vuelto.
    const sinMonto = renderWith(pickupOrder({ paymentMethod: "cash" }));
    expect(sinMonto).not.toContain("Pagás con");
    expect(sinMonto).not.toContain("Cambio");
  });

  it("le dice al cliente el PIN que tiene que dictar en caja (T13)", () => {
    const html = renderWith(pickupOrder({ pickupPin: "4821" }));

    expect(html).toContain("PIN de retiro");
    expect(html).toContain("4821");
    expect(html).toContain("Díctalo en caja");

    // Sin PIN guardado no se muestra un hueco.
    expect(renderWith(pickupOrder({}))).not.toContain("PIN de retiro");
  });

  it("con rango configurado le promete una franja, no un instante (T5)", () => {
    // 20:35 con 20 min de preparación y 40 de máximo: la franja es 20:35–20:55.
    const html = renderToStaticMarkup(
      createElement(BusinessSettingsProvider, {
        settings: {
          ...FALLBACK_BUSINESS_SETTINGS,
          pickupLeadMinutes: 20,
          pickupMaxMinutes: 40,
        },
        children: createElement(OrderSuccessView, {
          order: pickupOrder({
            pickupTime: "2026-09-12T02:35:00.000Z",
            pickupScheduled: false,
          }) as never,
        }),
      }),
    );

    expect(html).toContain("Hora de retiro");
    expect(html).toContain("entre 8:35 p. m. y 8:55 p. m.");
  });

  it("renders a minimal success screen instead of a receipt", () => {
    const html = renderToStaticMarkup(
      createElement(OrderSuccessView, {
        order: {
          orderNumber: "D-MQ71QBQ1",
          type: "delivery",
          status: "new",
          customerName: "Daniel",
          subtotal: 585.95,
          discount: 0,
          packagingAmount: 20,
          deliveryFeeAmount: 70,
          tipAmount: 58.6,
          tipRate: 10,
          total: 655.95,
          items: [
            {
              id: "item-1",
              productName: "Sushirrito",
              quantity: 1,
              packagingUnitAmount: 20,
              packagingQuantity: 1,
              packagingTotalAmount: 20,
              lineTotal: 680.95,
              modifiers: [
                {
                  id: "mod-1",
                  modifierOptionId: "opt-1",
                  name: "Agregar camarón tempura",
                  priceDelta: 95,
                },
              ],
            },
          ],
        },
      }),
    );

    expect(html).toContain("One Burger");
    expect(html).toContain("¡Pedido confirmado!");
    expect(html).toContain("Tu orden ya está en One Burger.");
    expect(html).toContain("Recibida");
    expect(html).toContain("<img");
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Ver mis pedidos");
    expect(html).toContain("Resumen del pedido");
    expect(html).toContain("Número de pedido");
    expect(html).toContain("D-MQ71QBQ1");
    expect(html).toContain("Delivery");
    expect(html).toContain("1 producto");
    expect(html).toContain("Total");
    expect(html).toContain("C$655.95");
    expect(html).toContain("Te enviaremos actualizaciones sobre tu pedido.");
    expect(html).toContain("Gracias por elegir One Burger.");
    expect(html).not.toContain("Volver al menú");
    expect(html).not.toContain("overflow-hidden");
    expect(html).not.toContain("Daniel");
    expect(html).not.toContain("Sushirrito");
    expect(html).not.toContain("Agregar camarón tempura");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Empaque");
    expect(html).toContain("Envío");
    expect(html).toContain("Propina");
    expect(html).not.toContain("Cliente");
    expect(html).not.toContain("Mascota de One Burger");

    expect(html.indexOf("<img")).toBeLessThan(
      html.indexOf("Ver mis pedidos"),
    );
  });
});
