import { describe, expect, it } from "vitest";

import {
  findCategoryOfProduct,
  getCategoryThumbnailUrl,
  getMenuProductActionCopy,
  getMenuHeaderCountLabel,
  getInitialCategoryId,
  getMenuSearchEmptyState,
  hasActiveMarketingBlocks,
  searchPublicMenuProducts,
  publicMenuDensityClasses,
  shouldShowTopLevelMenuHeading,
  shouldShowSubcategoryHeading,
  shouldShowSubcategoryNav,
} from "./menu-page-helpers";

describe("color por categoría (T3.1)", () => {
  it("encuentra la categoría de un producto, para pintar su tarjeta en los resultados", () => {
    // En los resultados de búsqueda conviven productos de varias categorías: sin
    // esto, la tarjeta perdería el color que sí tiene en su categoría.
    const categories = [
      { id: "c1", name: "Tacos", slug: "tacos", color: "#d32f2f" },
      { id: "c2", name: "Bebidas", slug: "bebidas", color: null },
    ];

    expect(findCategoryOfProduct(categories, { categoryId: "c2" })).toEqual({
      name: "Bebidas",
      color: null,
    });
    expect(findCategoryOfProduct(categories, { categoryId: "c9" })).toBeNull();
  });
});

describe("miniatura de categoría (T3)", () => {
  const available = (url: string) => ({
    images: [{ url }],
    availability: { isAvailable: true, isActive: true },
  });

  it("usa la primera foto de un producto que se puede pedir", () => {
    // El mock muestra una foto por categoría; acá sale del menú, sin campo nuevo.
    expect(
      getCategoryThumbnailUrl({
        products: [{ images: [], availability: { isAvailable: true, isActive: true } }],
        subcategories: [{ products: [available("/taco.jpg")] }],
      }),
    ).toBe("/taco.jpg");
  });

  it("se saltea los productos agotados o inactivos", () => {
    expect(
      getCategoryThumbnailUrl({
        products: [
          { images: [{ url: "/agotado.jpg" }], availability: { isAvailable: false, isActive: true } },
          { images: [{ url: "/inactivo.jpg" }], availability: { isAvailable: true, isActive: false } },
        ],
      }),
    ).toBeNull();
  });

  it("sin fotos devuelve null: la categoría se muestra solo con su nombre", () => {
    expect(getCategoryThumbnailUrl({ products: [available("")] })).toBeNull();
    expect(getCategoryThumbnailUrl({})).toBeNull();
  });
});

describe("menu-page-helpers", () => {
  const categories = [
    { id: "cat_1", slug: "maki-maki", name: "Maki Maki" },
    { id: "cat_2", slug: "bebidas", name: "Bebidas" },
  ];

  it("selects the category id from the query slug when it exists", () => {
    expect(getInitialCategoryId(categories, "bebidas")).toBe("cat_2");
  });

  it("falls back to the first category when the query slug does not exist", () => {
    expect(getInitialCategoryId(categories, "inexistente")).toBe("cat_1");
  });

  it("detects when there are no active marketing blocks", () => {
    expect(hasActiveMarketingBlocks([])).toBe(false);
    expect(
      hasActiveMarketingBlocks([
        { id: "mkt_1" },
      ]),
    ).toBe(true);
  });

  it("uses the same detail CTA for products without visible options", () => {
    expect(
      getMenuProductActionCopy({ name: "Sangría", modifierGroups: [] }),
    ).toEqual({
      symbol: "+",
      ariaLabel: "Ver Sangría",
    });
  });

  it("uses the same detail CTA for products with modifier options", () => {
    expect(
      getMenuProductActionCopy({
        name: "Aperol Spritz",
        modifierGroups: [
          {
            options: [{ id: "opt_1" }],
          },
        ],
      }),
    ).toEqual({
      symbol: "+",
      ariaLabel: "Ver Aperol Spritz",
    });
  });

  it("keeps the detail CTA when modifier groups are empty", () => {
    expect(
      getMenuProductActionCopy({
        name: "Piña colada",
        modifierGroups: [
          {
            options: [],
          },
        ],
      }),
    ).toEqual({
      symbol: "+",
      ariaLabel: "Ver Piña colada",
    });
  });

  it("shows total categories in the header when browsing the menu", () => {
    expect(
      getMenuHeaderCountLabel({
        categoryCount: 10,
        isSearching: false,
        searchResultCount: 0,
      }),
    ).toBe("10 categorías");
  });

  it("switches the header count to search results while filtering", () => {
    expect(
      getMenuHeaderCountLabel({
        categoryCount: 10,
        isSearching: true,
        searchResultCount: 1,
      }),
    ).toBe("1 resultado");

    expect(
      getMenuHeaderCountLabel({
        categoryCount: 10,
        isSearching: true,
        searchResultCount: 3,
      }),
    ).toBe("3 resultados");
  });

  it("keeps the public menu density compact above the fold", () => {
    expect(publicMenuDensityClasses.pageShell).toContain("gap-4");
    expect(publicMenuDensityClasses.marketingCard).toContain("min-w-[78%]");
    expect(publicMenuDensityClasses.marketingCardBody).toContain("min-h-[9.5rem]");
    expect(publicMenuDensityClasses.marketingTitle).toContain("line-clamp-2");
    expect(publicMenuDensityClasses.marketingDescription).toContain("line-clamp-1");
    expect(publicMenuDensityClasses.stickyCategories).toContain("top-12");
    expect(publicMenuDensityClasses.categoryRail).toContain("pr-4");
    expect(publicMenuDensityClasses.categoryRail).toContain("snap-x");
    expect(publicMenuDensityClasses.categoryChip).toContain("whitespace-nowrap");
    expect(publicMenuDensityClasses.categoryChip).toContain("h-11");
    expect(publicMenuDensityClasses.productRailItem).toContain("min-w-0");
    expect(publicMenuDensityClasses.productGrid).toContain("grid-cols-2");
    expect(publicMenuDensityClasses.productGrid).not.toContain("overflow-x-auto");

    expect(publicMenuDensityClasses.marketingCardBody).not.toContain("min-h-[18rem]");
    expect(publicMenuDensityClasses.stickyCategories).not.toContain("top-[68px]");
  });

  it("does not repeat the active category as a heading under category chips", () => {
    expect(shouldShowTopLevelMenuHeading({ hasSubcategories: false })).toBe(false);
  });

  it("keeps a top-level heading only when it separates products from subcategories", () => {
    expect(shouldShowTopLevelMenuHeading({ hasSubcategories: true })).toBe(true);
  });

  it("does not render a second horizontal nav for subcategories", () => {
    expect(shouldShowSubcategoryNav({ subcategoryCount: 0 })).toBe(false);
    expect(shouldShowSubcategoryNav({ subcategoryCount: 4 })).toBe(false);
  });

  it("shows subcategory headings as content sections", () => {
    expect(shouldShowSubcategoryHeading()).toBe(true);
  });

  it("searches all menu products by name and description without accent sensitivity", () => {
    const products = searchPublicMenuProducts(
      [
        {
          products: [{ id: "p_1", name: "Sangría de la casa", description: "Vino y frutas" }],
          subcategories: [
            {
              products: [{ id: "p_2", name: "Aperol Spritz", description: "Cítrico y espumoso" }],
            },
          ],
        },
      ],
      "citrico",
    );

    expect(products.map((product) => product.id)).toEqual(["p_2"]);
  });

  it("returns an empty result for a blank search rather than duplicating the active category", () => {
    expect(
      searchPublicMenuProducts(
        [{ products: [{ id: "p_1", name: "Sangría", description: null }] }],
        "   ",
      ),
    ).toEqual([]);
  });

  it("gives an empty search a clear recovery action", () => {
    expect(getMenuSearchEmptyState("ramen")).toEqual({
      title: "No encontramos productos para “ramen”.",
      description: "Probá con otro nombre o explorá una categoría.",
      actionLabel: "Ver todas las categorías",
    });
  });
});
