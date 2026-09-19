import { describe, expect, it } from "vitest";

import type { LocationProductRecord } from "@/modules/locations/domain/location.types";
import type { PublicMenuCategory } from "@/modules/menu/domain/menu.types";
import { applyLocationPricing } from "./apply-location-pricing";

/**
 * T8 fase 5 — el menú público con los precios del local.
 *
 * El local guarda excepciones, así que acá se aplican al menú que ya existe: el precio que
 * ve el cliente es el del local, y lo que el local no vende (o tiene agotado) no se muestra.
 * El `basePrice` del menú público pasa a ser **el precio que se cobra en ese local**: es lo
 * que el sitio necesita, y el admin sigue viendo el precio del negocio aparte.
 */
function product(id: string, basePrice: number, overrides: Partial<{ isAvailable: boolean }> = {}) {
  return {
    id,
    name: `Producto ${id}`,
    description: null,
    basePrice,
    packagingFeeAmount: null,
    availability: { isAvailable: overrides.isAvailable ?? true, isActive: true },
    images: [],
    modifierGroups: [],
    bundleRules: [],
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function category(products: ReturnType<typeof product>[]): PublicMenuCategory {
  return {
    id: "cat_1",
    name: "Tacos",
    slug: "tacos",
    color: null,
    products,
    subcategories: [],
  } as unknown as PublicMenuCategory;
}

function row(overrides: Partial<LocationProductRecord>): LocationProductRecord {
  return {
    id: "lp_1",
    locationId: "loc_norte",
    productId: "prod_1",
    priceOverride: null,
    isAvailable: true,
    isActive: true,
    ...overrides,
  };
}

const base = { locationId: "loc_norte", includeUnavailable: false };

describe("applyLocationPricing", () => {
  it("sin excepciones deja el menú como está", () => {
    const result = applyLocationPricing({
      ...base,
      categories: [category([product("prod_1", 35)])],
      rows: [],
    });

    expect(result[0].products[0].basePrice).toBe(35);
  });

  it("con precio propio, el menú público muestra el precio del local", () => {
    const result = applyLocationPricing({
      ...base,
      categories: [category([product("prod_1", 35)])],
      rows: [row({ priceOverride: 42 })],
    });

    expect(result[0].products[0].basePrice).toBe(42);
  });

  it("un plato que este local no vende no se muestra", () => {
    const result = applyLocationPricing({
      ...base,
      categories: [category([product("prod_1", 35), product("prod_2", 20)])],
      rows: [row({ productId: "prod_2", isActive: false })],
    });

    expect(result[0].products.map((entry) => entry.id)).toEqual(["prod_1"]);
  });

  it("un plato agotado en este local no se muestra, salvo que se pidan los no disponibles", () => {
    const categories = [category([product("prod_1", 35), product("prod_2", 20)])];
    const rows = [row({ productId: "prod_2", isAvailable: false })];

    expect(
      applyLocationPricing({ ...base, categories, rows })[0].products.map((entry) => entry.id),
    ).toEqual(["prod_1"]);

    expect(
      applyLocationPricing({ ...base, categories, rows, includeUnavailable: true })[0].products.map(
        (entry) => entry.id,
      ),
    ).toEqual(["prod_1", "prod_2"]);
  });

  it("una subcategoría que se queda sin productos no se dibuja", () => {
    const withSubcategory = {
      ...category([product("prod_1", 35)]),
      subcategories: [
        { id: "sub_1", name: "Especiales", slug: "especiales", color: null, products: [product("prod_2", 20)] },
      ],
    } as unknown as PublicMenuCategory;

    const result = applyLocationPricing({
      ...base,
      categories: [withSubcategory],
      rows: [row({ productId: "prod_2", isActive: false })],
    });

    expect(result[0].subcategories).toEqual([]);
  });

  it("una excepción de otro local no cambia este menú", () => {
    const result = applyLocationPricing({
      ...base,
      categories: [category([product("prod_1", 35)])],
      rows: [row({ locationId: "loc_sur", priceOverride: 99, isActive: false })],
    });

    expect(result[0].products[0].basePrice).toBe(35);
  });
});
