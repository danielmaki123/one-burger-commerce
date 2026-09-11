import { describe, expect, it } from "vitest";

import {
  buildQuickAddCartItem,
  canQuickAddProduct,
} from "@/shared/lib/product-quick-add";

/**
 * T3 — el "+" de la grilla del menú.
 *
 * El mock tiene un "+" de 24 px que no hace nada y un aviso de "Platillo
 * agregado" que nunca aparece. Acá el botón agrega de verdad, o no se dibuja.
 */
describe("agregar al carrito sin abrir el producto", () => {
  it("se agrega directo cuando el producto no obliga a elegir nada", () => {
    expect(canQuickAddProduct({ modifierGroups: [] })).toBe(true);
    expect(canQuickAddProduct({})).toBe(true);
    expect(
      canQuickAddProduct({
        modifierGroups: [
          {
            isRequired: false,
            minSelections: 0,
            options: [{ priceDelta: 5, isActive: true }],
          },
        ],
      }),
    ).toBe(true);
  });

  it("no se agrega directo cuando hay que elegir", () => {
    expect(
      canQuickAddProduct({
        modifierGroups: [{ isRequired: true, minSelections: 0, options: [{ isActive: true }] }],
      }),
    ).toBe(false);
    expect(
      canQuickAddProduct({
        modifierGroups: [{ isRequired: false, minSelections: 1, options: [{ isActive: true }] }],
      }),
    ).toBe(false);
  });

  it("un grupo obligatorio sin opciones activas no bloquea: no habría nada que elegir", () => {
    expect(
      canQuickAddProduct({
        modifierGroups: [{ isRequired: true, minSelections: 1, options: [{ isActive: false }] }],
      }),
    ).toBe(true);
  });

  it("arma la línea del carrito con el precio y el empaque del producto", () => {
    expect(
      buildQuickAddCartItem({
        id: "seed-prod-01",
        name: "Taco de Birria",
        basePrice: 35,
        packagingFeeAmount: 5,
        images: [{ url: "/taco.jpg", alt: "Taco", isPrimary: true }],
      }),
    ).toEqual({
      productId: "seed-prod-01",
      productName: "Taco de Birria",
      imageUrl: "/taco.jpg",
      imageAlt: "Taco",
      quantity: 1,
      unitPrice: 35,
      packagingUnitAmount: 5,
      packagingTotalAmount: 5,
      modifierOptionIds: [],
      modifiers: [],
      lineTotal: 40,
    });
  });

  it("sin imagen usa el nombre como texto alternativo, no una imagen vacía", () => {
    expect(
      buildQuickAddCartItem({ id: "p", name: "Flan", basePrice: 30, images: [] }),
    ).toMatchObject({ imageUrl: undefined, imageAlt: "Flan", packagingUnitAmount: 0, lineTotal: 30 });
  });
});
