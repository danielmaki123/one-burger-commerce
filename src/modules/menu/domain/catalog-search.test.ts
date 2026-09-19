import { describe, expect, it } from "vitest";

import { filterCatalogCategories, matchesCatalogQuery } from "./catalog-search";
import type { ProductRecord, PublicMenuCategory } from "./menu.types";

/**
 * La búsqueda del catálogo es **una sola regla** para el servidor y para la pantalla del mostrador.
 *
 * Se prueba acá, en el dominio del menú, porque es del catálogo y no del POS: el mostrador la consume.
 */

function product(over: Partial<ProductRecord> & { id: string; name: string }): ProductRecord {
  return {
    categoryId: "cat_1",
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
  return { slug: over.id, sortOrder: 0, color: null, subcategories: [], products: [], ...over };
}

describe("matchesCatalogQuery", () => {
  it("sin búsqueda coincide con todo", () => {
    expect(matchesCatalogQuery("Taco de birria", "Tacos", "")).toBe(true);
    expect(matchesCatalogQuery("Taco de birria", "Tacos", "   ")).toBe(true);
  });

  it("compara sin mayúsculas y sin acentos", () => {
    expect(matchesCatalogQuery("Café helado", "Bebidas", "CAFE")).toBe(true);
    expect(matchesCatalogQuery("Taco de birria", "Tacos", "  Birria  ")).toBe(true);
  });

  it("también coincide por el nombre de la categoría", () => {
    expect(matchesCatalogQuery("Coca Cola", "Bebidas", "bebidas")).toBe(true);
  });

  it("no coincide cuando el término no está en el producto ni en su categoría", () => {
    expect(matchesCatalogQuery("Taco de birria", "Tacos", "sushi")).toBe(false);
  });
});

describe("filterCatalogCategories", () => {
  const catalogo = [
    category({
      id: "cat_tacos",
      name: "Tacos",
      products: [
        product({ id: "prod_birria", name: "Taco de birria" }),
        product({ id: "prod_cola", name: "Cola" }),
      ],
    }),
    category({
      id: "cat_bebidas",
      name: "Bebidas",
      products: [product({ id: "prod_agua", name: "Agua" })],
      subcategories: [
        {
          id: "sub_frias",
          name: "Frias",
          slug: "frias",
          sortOrder: 0,
          products: [product({ id: "prod_cerveza", name: "Cerveza" })],
        },
      ],
    }),
  ];

  it("sin búsqueda devuelve el catálogo tal cual", () => {
    expect(filterCatalogCategories(catalogo, "")).toEqual(catalogo);
  });

  it("deja solo los productos que coinciden por nombre y conserva el orden del catálogo", () => {
    const result = filterCatalogCategories(catalogo, "birria");

    expect(result.map((item) => item.id)).toEqual(["cat_tacos"]);
    expect(result[0].products.map((item) => item.id)).toEqual(["prod_birria"]);
  });

  it("el término que nombra la categoría se lleva todo lo que hay adentro", () => {
    // Es el comportamiento del mostrador de siempre: escribir "tacos" lista la categoría completa.
    const result = filterCatalogCategories(catalogo, "tacos");

    expect(result.map((item) => item.id)).toEqual(["cat_tacos"]);
    expect(result[0].products.map((item) => item.id)).toEqual(["prod_birria", "prod_cola"]);
  });

  it("encuentra por categoría a los productos que no la nombran", () => {
    const result = filterCatalogCategories(catalogo, "bebidas");

    expect(result.map((item) => item.id)).toEqual(["cat_bebidas"]);
    expect(result[0].products.map((item) => item.id)).toEqual(["prod_agua"]);
  });

  it("saca la categoría y la subcategoría que se quedan sin productos", () => {
    const result = filterCatalogCategories(catalogo, "cerveza");

    expect(result.map((item) => item.id)).toEqual(["cat_bebidas"]);
    expect(result[0].products).toEqual([]);
    expect(result[0].subcategories.map((sub) => sub.id)).toEqual(["sub_frias"]);
  });

  it("sin coincidencias devuelve el catálogo vacío, no categorías vacías", () => {
    expect(filterCatalogCategories(catalogo, "sushi")).toEqual([]);
  });
});
