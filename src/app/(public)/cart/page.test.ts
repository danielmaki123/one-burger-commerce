import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CartItem } from "@/shared/lib/cart";
import CartPage from "./page";

let mockCart = {
  items: [] as CartItem[],
  subtotal: 0,
  removeItem: vi.fn(),
  updateQuantity: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/shared/lib/cart", () => ({
  useCart: () => mockCart,
}));

describe("public cart page", () => {
  beforeEach(() => {
    mockCart = {
      items: [],
      subtotal: 0,
      removeItem: vi.fn(),
      updateQuantity: vi.fn(),
    };
  });

  it("renders the premium empty cart state", () => {
    const html = renderToStaticMarkup(createElement(CartPage));

    expect(html).toContain("Tu carrito está vacío");
    expect(html).toContain("Agregá productos del menú para armar tu pedido.");
    expect(html).toContain("Ver menú");
  });

  it("renders cart review cards and checkout CTA for cart items", () => {
    mockCart = {
      items: [
        {
          productId: "prod-1",
          productName: "Sangría",
          imageUrl:
            "https://images.casaantiguanic.com/img/13a961be-17f9-491a-afbd-d6af10ca8687.jpg",
          imageAlt: "Sangría",
          quantity: 1,
          unitPrice: 425,
          packagingUnitAmount: 0,
          packagingTotalAmount: 0,
          modifierOptionIds: ["sangria-half-liter"],
          modifiers: [
            {
              groupName: "Sangrias",
              optionName: "Sangria de 1/2 Litro",
              priceDelta: 425,
            },
          ],
          lineTotal: 425,
        },
        {
          productId: "prod-2",
          productName: "Aperol Spritz",
          imageUrl:
            "https://images.casaantiguanic.com/img/c520f029-4f0b-43db-a134-ffa9630abc13.png",
          imageAlt: "Aperol Spritz",
          quantity: 2,
          unitPrice: 290,
          packagingUnitAmount: 0,
          packagingTotalAmount: 0,
          modifierOptionIds: [],
          modifiers: [],
          lineTotal: 580,
        },
      ],
      subtotal: 1005,
      removeItem: vi.fn(),
      updateQuantity: vi.fn(),
    };

    const html = renderToStaticMarkup(createElement(CartPage));

    expect(html).toContain("Tu carrito");
    expect(html).toContain("2 productos");
    expect(html).not.toContain("2 items");
    expect(html).toContain("Sangría");
    expect(html).toContain("Sangria de 1/2 Litro");
    expect(html).toContain("Aperol Spritz");
    expect(html).toContain("Sin modificadores");
    expect(html).not.toContain("(+C$425.00)");
    expect(html).toContain("pb-[calc(11.5rem+env(safe-area-inset-bottom))]");
    expect(html).toContain("overflow-hidden rounded-[18px] border border-border/70 bg-card");
    expect(html).toContain("grid grid-cols-[4rem_minmax(0,1fr)]");
    expect(html).toContain("mx-auto h-14 w-14");
    expect(html).toContain("rounded-none border-0 border-b border-border/70 bg-transparent shadow-none last:border-b-0");
    expect(html).toContain("flex shrink-0 flex-col items-end gap-2");
    expect(html).toContain("rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground");
    expect(html).toContain("Quitar");
    expect(html).toContain("text-[0.8125rem] leading-4 text-muted-foreground");
    expect(html).toContain("text-[0.95rem] font-bold leading-5 text-foreground");
    expect(html).toContain("h-11 w-11");
    expect(html).toContain("min-w-4");
    expect(html).toContain("Subtotal");
    expect(html).toContain("Empaque");
    expect(html).toContain("Total estimado");
    expect(html).toContain("Retirás en el local");
    expect(html).toContain("Al retirar");
    expect(html).not.toContain("Se define en checkout");
    expect(html).not.toContain("Envío");
    expect(html).not.toContain("Propina");
    expect(html).toContain("Continuar");
    expect(html).toContain("Seguir viendo menú");
  });
});
