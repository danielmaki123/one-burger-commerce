import { describe, expect, it } from "vitest";

import type { CartItem } from "@/shared/lib/cart";

import {
  buildLocationPriceIndex,
  describeMissingProducts,
  repriceCartForLocation,
} from "./location-pricing";

/**
 * El total del checkout con varios locales.
 *
 * El servidor cobra con el local elegido; el total que ve el cliente se calcula en el
 * navegador con los precios del carrito (los del local por defecto). Acá se re-precian las
 * líneas con el menú que el servidor **ya cotizó para ese local**, y se informan los
 * productos que ese local no vende.
 */
function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: "prod-1",
    productName: "Taco de Birria",
    quantity: 1,
    unitPrice: 35,
    packagingUnitAmount: 5,
    packagingTotalAmount: 5,
    modifierOptionIds: [],
    modifiers: [],
    lineTotal: 35,
    ...overrides,
  };
}

const MENU = [
  {
    products: [{ id: "prod-1", basePrice: 50, modifierGroups: [] }],
    subcategories: [
      {
        products: [
          {
            id: "prod-2",
            basePrice: 80,
            modifierGroups: [
              {
                options: [
                  { id: "opt-queso", priceDelta: 10 },
                  { id: "opt-tocino", priceDelta: 15 },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

describe("buildLocationPriceIndex", () => {
  it("indexa los productos del local, incluidos los de subcategorías", () => {
    const index = buildLocationPriceIndex(MENU);

    expect(index.get("prod-1")?.basePrice).toBe(50);
    expect(index.get("prod-2")?.basePrice).toBe(80);
    expect(index.get("prod-2")?.optionDeltas.get("opt-tocino")).toBe(15);
  });

  it("sin menú queda vacío", () => {
    expect(buildLocationPriceIndex(null).size).toBe(0);
    expect(buildLocationPriceIndex(undefined).size).toBe(0);
  });
});

describe("repriceCartForLocation", () => {
  it("cambia el precio de las líneas al del local elegido", () => {
    const result = repriceCartForLocation(
      [line({ quantity: 2, unitPrice: 35, lineTotal: 70 })],
      buildLocationPriceIndex(MENU),
    );

    expect(result.missing).toEqual([]);
    expect(result.items[0].unitPrice).toBe(50);
    expect(result.items[0].lineTotal).toBe(100);
    // El empaque no depende del local.
    expect(result.items[0].packagingUnitAmount).toBe(5);
  });

  it("suma los modificadores elegidos con los deltas del local", () => {
    const result = repriceCartForLocation(
      [
        line({
          productId: "prod-2",
          productName: "Hamburguesa",
          unitPrice: 85,
          lineTotal: 85,
          modifierOptionIds: ["opt-queso", "opt-tocino"],
        }),
      ],
      buildLocationPriceIndex(MENU),
    );

    expect(result.items[0].unitPrice).toBe(105);
    expect(result.items[0].lineTotal).toBe(105);
  });

  it("informa los productos que ese local no vende y no toca su línea", () => {
    const result = repriceCartForLocation(
      [line(), line({ productId: "prod-fantasma", productName: "Flan" })],
      buildLocationPriceIndex([{ products: [{ id: "prod-1", basePrice: 50 }] }]),
    );

    expect(result.missing).toEqual(["Flan"]);
    // La línea que no se puede pedir queda como estaba: el total no baja en silencio.
    expect(result.items[1].unitPrice).toBe(35);
  });

  it("sin índice (menú sin cargar o negocio sin locales) deja todo igual y no bloquea", () => {
    const items = [line()];
    const result = repriceCartForLocation(items, new Map());

    expect(result.missing).toEqual([]);
    expect(result.items).toEqual(items);
  });
});

describe("describeMissingProducts", () => {
  it("nombra el local y los platos", () => {
    expect(describeMissingProducts("Sucursal Norte", ["Flan", "Taco"])).toBe(
      "En Sucursal Norte no se vende: Flan, Taco. Cambiá de local o quitá esos platos del carrito.",
    );
  });

  it("sin nombre de local no deja la frase colgada", () => {
    expect(describeMissingProducts(null, ["Flan"])).toContain("En ese local no se vende: Flan.");
  });
});
