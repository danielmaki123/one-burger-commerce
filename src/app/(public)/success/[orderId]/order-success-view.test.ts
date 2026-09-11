import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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
