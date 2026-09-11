import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CartItem } from "@/shared/lib/cart";

import { OrderSummaryCard } from "./order-summary-card";

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-1",
    productName: "Hamburguesa Clásica",
    quantity: 1,
    unitPrice: 200,
    packagingUnitAmount: 10,
    packagingTotalAmount: 10,
    modifierOptionIds: [],
    lineTotal: 210,
    ...overrides,
  };
}

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

const twoLines = [
  item(),
  item({
    productId: "prod-2",
    productName: "Papas Fritas",
    quantity: 2,
    unitPrice: 80,
    packagingTotalAmount: 10,
    lineTotal: 170,
  }),
];

function render(overrides: Partial<Parameters<typeof OrderSummaryCard>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(OrderSummaryCard, {
      itemCount: 3,
      subtotal: 380,
      packagingAmount: 20,
      ...overrides,
    }),
  );
}

describe("OrderSummaryCard", () => {
  it("titula el resumen igual en todas las pantallas", () => {
    const html = render();

    expect(count(html, "Resumen del pedido")).toBe(1);
  });

  it("cuenta unidades, que es lo que ya cuenta el badge del header", () => {
    const html = render({ itemCount: 3 });

    expect(html).toContain("3 productos");
    expect(html).not.toContain("3 items");
  });

  it("muestra cada fila de importes una sola vez", () => {
    const html = render();

    expect(count(html, "Subtotal")).toBe(1);
    expect(count(html, "Empaque")).toBe(1);
    expect(count(html, "Total a pagar")).toBe(1);
  });

  it("suma subtotal, empaque y propina en el total", () => {
    const html = render({
      subtotal: 380,
      packagingAmount: 20,
      tipAmount: 40,
      tipRate: 10,
    });

    // 380 + 20 + 40
    expect(html).toContain("C$440.00");
    expect(html).toContain("Propina (10%)");
  });

  it("no muestra la fila de propina cuando no hay propina", () => {
    const html = render({ tipAmount: 0 });

    expect(html).not.toContain("Propina");
  });

  it("avisa cómo se paga con el texto configurado por el negocio", () => {
    const html = render();

    expect(html).toContain("Pagás en el local al retirar tu pedido.");
  });

  it("lista los productos cuando se los pasa", () => {
    const html = render({ items: twoLines });

    expect(html).toContain("Hamburguesa Clásica");
    expect(html).toContain("Papas Fritas");
    expect(html).toContain("2x");
  });

  it("no lista productos cuando el carrito ya los muestra arriba", () => {
    const html = render();

    expect(html).not.toContain("Hamburguesa Clásica");
  });

  it("deja el CTA adentro de la tarjeta", () => {
    const html = render({
      children: createElement("button", { type: "button" }, "Ir a pagar"),
    });

    expect(html).toContain("Ir a pagar");
  });

  it("usa el formato de moneda configurado", () => {
    const html = render({ subtotal: 100, packagingAmount: 0 });

    expect(html).toContain("C$100.00");
  });
});
