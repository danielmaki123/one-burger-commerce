import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { listAdminCategories } from "./list-admin-categories";

describe("listAdminCategories", () => {
  it("includes every product count for each subcategory", async () => {
    const repository = new InMemoryMenuRepository();
    const category = await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const subcategory = await repository.createSubcategory({
      categoryId: category.id,
      name: "Frías",
      slug: "frias",
      sortOrder: 0,
      isActive: true,
    });
    await repository.createProduct({
      categoryId: category.id,
      subcategoryId: subcategory.id,
      name: "Limonada",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: false,
    });

    const result = await listAdminCategories({ repository });

    expect(result.data[0].subcategories?.[0].productCount).toBe(1);
  });
});
