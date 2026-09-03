import { describe, expect, it } from "vitest";

import {
  countCategoryProducts,
  findCategoryAttention,
  pluralEs,
  type AdminCategory,
} from "./category-list-helpers";

function buildCategory(overrides: Partial<AdminCategory> = {}): AdminCategory {
  return {
    id: "cat_1",
    name: "Vinos",
    slug: "vinos",
    isActive: true,
    sortOrder: 0,
    subcategories: [],
    ...overrides,
  };
}

describe("category list helpers", () => {
  it("pluraliza en español sin paréntesis programáticos", () => {
    expect(pluralEs(1, "subcategoría", "subcategorías")).toBe("1 subcategoría");
    expect(pluralEs(3, "subcategoría", "subcategorías")).toBe("3 subcategorías");
    expect(pluralEs(0, "plato", "platos")).toBe("0 platos");
  });

  it("suma los platos de las subcategorías", () => {
    const category = buildCategory({
      subcategories: [
        { id: "s1", categoryId: "cat_1", name: "Tintos", slug: "tintos", isActive: true, sortOrder: 0, productCount: 4 },
        { id: "s2", categoryId: "cat_1", name: "Blancos", slug: "blancos", isActive: true, sortOrder: 1 },
      ],
    });
    expect(countCategoryProducts(category)).toBe(4);
  });

  it("marca categoría activa sin subcategorías", () => {
    const items = findCategoryAttention([buildCategory()]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toContain("no tiene subcategorías");
  });

  it("marca categoría activa con subcategorías pero sin platos", () => {
    const items = findCategoryAttention([
      buildCategory({
        subcategories: [
          { id: "s1", categoryId: "cat_1", name: "Tintos", slug: "tintos", isActive: true, sortOrder: 0, productCount: 0 },
        ],
      }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toContain("se ve vacía");
  });

  it("no marca categorías inactivas ni sanas", () => {
    const items = findCategoryAttention([
      buildCategory({ id: "inactiva", isActive: false }),
      buildCategory({
        id: "sana",
        subcategories: [
          { id: "s1", categoryId: "sana", name: "Tintos", slug: "tintos", isActive: true, sortOrder: 0, productCount: 2 },
        ],
      }),
    ]);
    expect(items).toHaveLength(0);
  });
});
