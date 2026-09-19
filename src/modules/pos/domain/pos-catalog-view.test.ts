import { describe, expect, it } from "vitest";

import type { ProductRecord, PublicMenuCategory } from "@/modules/menu/domain/menu.types";

import { projectPosCatalog } from "./pos-catalog-view";

/**
 * La vista del mostrador es una **proyección** del catálogo del menú: no es un segundo catálogo.
 *
 * Lo que fija: que el producto conserve **todos** los campos del `ProductRecord` (el bug que se quiere
 * evitar es el shape paralelo recortado), que `requiresOptions` salga de la regla compartida y que los
 * chips de categoría traigan su contador del mismo lugar que los productos.
 */

function product(over: Partial<ProductRecord> & { id: string; name: string }): ProductRecord {
  return {
    categoryId: "cat_burgers",
    subcategoryId: null,
    description: null,
    basePrice: 305,
    packagingFeeAmount: 35,
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
  return { slug: over.id, sortOrder: 0, color: null, subcategories: [], products: [], ...over };
}

const grupoObligatorio = {
  id: "grupo_extras",
  name: "EXTRAS",
  isRequired: true,
  minSelections: 1,
  maxSelections: 10,
  sortOrder: 0,
  options: [
    { id: "opt_sin", name: "SIN EXTRAS", priceDelta: 0, isActive: true },
    { id: "opt_papas", name: "PAPAS FRITAS", priceDelta: 119, isActive: true },
  ],
};

describe("projectPosCatalog", () => {
  it("aplana las categorías y le pone a cada producto el nombre de la suya", () => {
    const view = projectPosCatalog([
      category({
        id: "cat_burgers",
        name: "ONE BURGER",
        products: [product({ id: "prod_doble", name: "DOBLE" })],
      }),
      category({
        id: "cat_bebidas",
        name: "BEBIDAS",
        products: [product({ id: "prod_cola", name: "COCA COLA", categoryId: "cat_bebidas" })],
      }),
    ]);

    expect(view.products.map((item) => [item.id, item.categoryName])).toEqual([
      ["prod_doble", "ONE BURGER"],
      ["prod_cola", "BEBIDAS"],
    ]);
  });

  it("los productos que viven en una subcategoría entran con la categoría de arriba", () => {
    const view = projectPosCatalog([
      category({
        id: "cat_burgers",
        name: "ONE BURGER",
        subcategories: [
          {
            id: "sub_especiales",
            name: "Especiales",
            slug: "especiales",
            sortOrder: 0,
            products: [product({ id: "prod_monster", name: "MONSTER FRIES" })],
          },
        ],
      }),
    ]);

    expect(view.products.map((item) => [item.id, item.categoryName])).toEqual([
      ["prod_monster", "ONE BURGER"],
    ]);
  });

  it("conserva todos los campos del producto: fotos, modificadores y descripción", () => {
    const doble = product({
      id: "prod_doble",
      name: "DOBLE",
      description: "Smash con doble torta",
      images: [{ id: "img_1", url: "https://cdn/doble.png", alt: "DOBLE", isPrimary: true }],
      modifierGroups: [grupoObligatorio],
    });

    const view = projectPosCatalog([
      category({ id: "cat_burgers", name: "ONE BURGER", products: [doble] }),
    ]);

    // Es un `extends ProductRecord`: lo que la carta entrega viaja entero, sin recortes.
    expect(view.products[0]).toMatchObject({
      id: "prod_doble",
      basePrice: 305,
      packagingFeeAmount: 35,
      description: "Smash con doble torta",
      availability: { isAvailable: true, isActive: true },
    });
    expect(view.products[0].images).toEqual(doble.images);
    expect(view.products[0].modifierGroups).toEqual([grupoObligatorio]);
    // Y no hay un campo paralelo con el precio.
    expect(view.products[0]).not.toHaveProperty("price");
  });

  it("deriva requiresOptions con la regla compartida del agregado rápido", () => {
    const view = projectPosCatalog([
      category({
        id: "cat_burgers",
        name: "ONE BURGER",
        products: [
          product({ id: "prod_doble", name: "DOBLE", modifierGroups: [grupoObligatorio] }),
          product({
            id: "prod_extra",
            name: "MONSTER",
            modifierGroups: [
              {
                ...grupoObligatorio,
                id: "grupo_opcional",
                isRequired: false,
                minSelections: 0,
                maxSelections: 3,
              },
            ],
          }),
          product({ id: "prod_agua", name: "AGUA", modifierGroups: [] }),
        ],
      }),
    ]);

    expect(view.products.map((item) => [item.id, item.requiresOptions])).toEqual([
      ["prod_doble", true],
      ["prod_extra", false],
      ["prod_agua", false],
    ]);
  });

  it("no repite un producto que aparece en la categoría y en su subcategoría", () => {
    const repetido = product({ id: "prod_repetido", name: "DOBLE" });

    const view = projectPosCatalog([
      category({
        id: "cat_burgers",
        name: "ONE BURGER",
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

    expect(view.products).toHaveLength(1);
    expect(view.categories).toEqual([{ id: "cat_burgers", name: "ONE BURGER", count: 1 }]);
  });

  it("arma los chips de categoría con su contador, en el orden del catálogo", () => {
    const view = projectPosCatalog([
      category({
        id: "cat_burgers",
        name: "ONE BURGER",
        products: [
          product({ id: "prod_doble", name: "DOBLE" }),
          product({ id: "prod_triple", name: "TRIPLE" }),
        ],
      }),
      category({
        id: "cat_bebidas",
        name: "BEBIDAS",
        products: [
          product({ id: "prod_cola", name: "COCA COLA", categoryId: "cat_bebidas" }),
        ],
      }),
      category({ id: "cat_vacia", name: "SIN PRODUCTOS" }),
    ]);

    expect(view.categories).toEqual([
      { id: "cat_burgers", name: "ONE BURGER", count: 2 },
      { id: "cat_bebidas", name: "BEBIDAS", count: 1 },
    ]);
    expect(view.total).toBe(3);
  });

  it("el total y la consulta acompañan a los productos que quedaron", () => {
    const view = projectPosCatalog(
      [
        category({
          id: "cat_burgers",
          name: "ONE BURGER",
          products: [product({ id: "prod_doble", name: "DOBLE" })],
        }),
      ],
      "  doble  ",
    );

    expect(view.total).toBe(1);
    expect(view.query).toBe("doble");
  });
});
