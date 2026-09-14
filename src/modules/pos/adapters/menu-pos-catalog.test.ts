import { describe, expect, it, vi } from "vitest";

import type { ProductRecord, PublicMenuCategory } from "@/modules/menu/domain/menu.types";

import { buildPosCatalog, createMenuPosCatalogAdapter } from "./menu-pos-catalog";

/**
 * TASK-302 — el catálogo del POS sale del menú público.
 *
 * El POS **no** tiene su propio camino de precios: usa `getPublicMenu`, que ya resuelve las
 * excepciones del local (`apply-location-pricing`, T8). Lo que agrega este adaptador es la forma que
 * el mostrador necesita: una lista plana con la categoría de cada producto y si se puede vender de un
 * toque (`requiresOptions`), que se decide con la **misma** regla que el "+" de la home y el menú
 * (`canQuickAddProduct`), no con una copia.
 */

function product(over: Partial<ProductRecord> & { id: string; name: string }): ProductRecord {
  return {
    categoryId: "cat_tacos",
    subcategoryId: null,
    description: null,
    basePrice: 35,
    packagingFeeAmount: null,
    images: [],
    availability: { isAvailable: true, isActive: true },
    modifierGroups: [],
    bundleRules: [],
    createdAt: new Date("2026-09-14T00:00:00.000Z"),
    updatedAt: new Date("2026-09-14T00:00:00.000Z"),
    ...over,
  };
}

function category(
  over: Partial<PublicMenuCategory> & { id: string; name: string },
): PublicMenuCategory {
  return {
    slug: over.id,
    sortOrder: 0,
    color: null,
    subcategories: [],
    products: [],
    ...over,
  };
}

describe("catálogo del POS desde el menú público", () => {
  it("aplana las categorías y los productos con su precio y su categoría", () => {
    const catalog = buildPosCatalog([
      category({
        id: "cat_tacos",
        name: "Tacos",
        products: [product({ id: "prod_taco", name: "Taco de birria", basePrice: 40 })],
      }),
      category({
        id: "cat_bebidas",
        name: "Bebidas",
        products: [product({ id: "prod_cola", name: "Cola", basePrice: 25 })],
      }),
    ]);

    expect(catalog).toEqual([
      {
        id: "prod_taco",
        name: "Taco de birria",
        price: 40,
        categoryId: "cat_tacos",
        categoryName: "Tacos",
        requiresOptions: false,
      },
      {
        id: "prod_cola",
        name: "Cola",
        price: 25,
        categoryId: "cat_bebidas",
        categoryName: "Bebidas",
        requiresOptions: false,
      },
    ]);
  });

  it("incluye los productos que viven en una subcategoría, con la categoría de arriba", () => {
    const catalog = buildPosCatalog([
      category({
        id: "cat_tacos",
        name: "Tacos",
        subcategories: [
          {
            id: "sub_especiales",
            name: "Especiales",
            slug: "especiales",
            sortOrder: 0,
            products: [product({ id: "prod_especial", name: "Taco especial" })],
          },
        ],
      }),
    ]);

    expect(catalog.map((item) => item.id)).toEqual(["prod_especial"]);
    expect(catalog[0].categoryName).toBe("Tacos");
  });

  it("esconde lo que no se puede vender: inactivo o sin disponibilidad", () => {
    const catalog = buildPosCatalog([
      category({
        id: "cat_tacos",
        name: "Tacos",
        products: [
          product({ id: "prod_ok", name: "Taco" }),
          product({
            id: "prod_agotado",
            name: "Taco agotado",
            availability: { isAvailable: false, isActive: true },
          }),
          product({
            id: "prod_inactivo",
            name: "Taco inactivo",
            availability: { isAvailable: true, isActive: false },
          }),
        ],
      }),
    ]);

    expect(catalog.map((item) => item.id)).toEqual(["prod_ok"]);
  });

  it("marca requiresOptions con la regla compartida del agregado rápido", () => {
    const catalog = buildPosCatalog([
      category({
        id: "cat_tacos",
        name: "Tacos",
        products: [
          product({
            id: "prod_obligatorio",
            name: "Taco con salsa obligatoria",
            modifierGroups: [
              {
                id: "grupo_1",
                name: "Salsa",
                isRequired: true,
                minSelections: 1,
                maxSelections: 1,
                sortOrder: 0,
                options: [{ id: "opt_1", name: "Picante", priceDelta: 0, isActive: true }],
              },
            ],
          }),
          product({
            id: "prod_opcional",
            name: "Taco con extra opcional",
            modifierGroups: [
              {
                id: "grupo_2",
                name: "Extras",
                isRequired: false,
                minSelections: 0,
                maxSelections: 3,
                sortOrder: 0,
                options: [{ id: "opt_2", name: "Queso", priceDelta: 10, isActive: true }],
              },
            ],
          }),
        ],
      }),
    ]);

    expect(catalog.map((item) => [item.id, item.requiresOptions])).toEqual([
      ["prod_obligatorio", true],
      ["prod_opcional", false],
    ]);
  });

  it("no repite un producto que aparece en la categoría y en su subcategoría", () => {
    const repetido = product({ id: "prod_repetido", name: "Taco repetido" });
    const catalog = buildPosCatalog([
      category({
        id: "cat_tacos",
        name: "Tacos",
        products: [repetido],
        subcategories: [
          {
            id: "sub_especiales",
            name: "Especiales",
            slug: "especiales",
            sortOrder: 0,
            products: [repetido],
          },
        ],
      }),
    ]);

    expect(catalog).toHaveLength(1);
  });

  it("el adaptador pide el menú del local exacto que le pasan", async () => {
    const getMenu = vi.fn(async () => ({
      categories: [
        category({ id: "cat_tacos", name: "Tacos", products: [product({ id: "p1", name: "Taco" })] }),
      ],
    }));
    const adapter = createMenuPosCatalogAdapter({ getMenu });

    const result = await adapter.listProducts({ locationId: "loc_playa" });

    expect(getMenu).toHaveBeenCalledTimes(1);
    expect(getMenu).toHaveBeenCalledWith({ locationId: "loc_playa" });
    expect(result.map((item) => item.id)).toEqual(["p1"]);
  });
});
