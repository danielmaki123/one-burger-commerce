import { describe, expect, it, vi } from "vitest";

import {
  countActiveProductFilters,
  countProductsByCategory,
  parseProductPriceInput,
  patchAdminProduct,
  type AdminProduct,
} from "./product-list-helpers";

const product: AdminProduct = {
  id: "product_1",
  name: "Gyozas",
  basePrice: 289.95,
  description: "Ravioles al vapor",
  categoryId: "category_1",
  subcategoryId: null,
  availability: { isAvailable: true, isActive: true },
  images: [],
};

describe("product list helpers", () => {
  it("does not count the default product filters", () => {
    expect(
      countActiveProductFilters({
        category: "all",
        status: "active",
        availability: "all",
      }),
    ).toBe(0);
  });

  it("counts each non-default product filter", () => {
    expect(
      countActiveProductFilters({
        category: "cat_1",
        status: "inactive",
        availability: "unavailable",
      }),
    ).toBe(3);
  });

  it.each([
    ["289.95", 289.95],
    ["0", 0],
    ["12.345", 12.35],
    ["", null],
    ["-1", null],
    ["abc", null],
  ])("parses product price %s as %s", (value, expected) => {
    expect(parseProductPriceInput(value)).toBe(expected);
  });

  it("patches only the requested quick product fields", async () => {
    const request = vi.fn(async (_input: string, _init: RequestInit) =>
      new Response(JSON.stringify({ data: { ...product, basePrice: 300 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const updated = await patchAdminProduct(
      product.id,
      { basePrice: 300 },
      request,
    );

    expect(updated.basePrice).toBe(300);
    expect(request).toHaveBeenCalledWith(
      "/api/admin/menu/products/product_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ basePrice: 300 }),
      }),
    );
  });

  it("surfaces the API error message when a quick update fails", async () => {
    const request = vi.fn(async (_input: string, _init: RequestInit) =>
      new Response(
        JSON.stringify({ error: { message: "Insufficient permissions" } }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      patchAdminProduct(product.id, { basePrice: 300 }, request),
    ).rejects.toThrow("Tu rol no permite modificar productos.");
  });

  it("counts products per category for the filter chips", () => {
    const catalog: AdminProduct[] = [
      product,
      { ...product, id: "product_2", categoryId: "category_1" },
      { ...product, id: "product_3", categoryId: "category_2" },
      { ...product, id: "product_4", categoryId: null },
      { ...product, id: "product_5", categoryId: "category_deleted" },
    ];

    const counts = countProductsByCategory(catalog, new Set(["category_1", "category_2"]));

    expect(counts.total).toBe(5);
    expect(counts.byCategory.get("category_1")).toBe(2);
    expect(counts.byCategory.get("category_2")).toBe(1);
    expect(counts.byCategory.has("category_deleted")).toBe(false);
    expect(counts.uncategorized).toBe(2);
  });
});
