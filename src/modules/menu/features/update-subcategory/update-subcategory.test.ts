import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { updateSubcategory } from "./update-subcategory";

describe("updateSubcategory", () => {
  it("moves the subcategory and all of its products to the destination category", async () => {
    const repository = new InMemoryMenuRepository();
    const beverages = await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const food = await repository.createCategory({
      name: "Comida",
      slug: "comida",
      sortOrder: 1,
      isActive: true,
    });
    const cold = await repository.createSubcategory({
      categoryId: beverages.id,
      name: "Frías",
      slug: "frias",
      sortOrder: 0,
      isActive: true,
    });
    const product = await repository.createProduct({
      categoryId: beverages.id,
      subcategoryId: cold.id,
      name: "Limonada",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const result = await updateSubcategory(
      cold.id,
      { categoryId: food.id },
      { repository },
    );

    expect(result.data.categoryId).toBe(food.id);
    expect((await repository.getProductById(product.id))?.categoryId).toBe(food.id);
    expect(result.meta.movedProducts).toBe(1);
  });

  it("rejects a move when the destination category does not exist", async () => {
    const repository = new InMemoryMenuRepository();
    const beverages = await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const cold = await repository.createSubcategory({
      categoryId: beverages.id,
      name: "Frías",
      slug: "frias",
      sortOrder: 0,
      isActive: true,
    });

    await expect(
      updateSubcategory(cold.id, { categoryId: "cat_missing" }, { repository }),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("rejects a move when the destination already has the same slug", async () => {
    const repository = new InMemoryMenuRepository();
    const beverages = await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const food = await repository.createCategory({
      name: "Comida",
      slug: "comida",
      sortOrder: 1,
      isActive: true,
    });
    const cold = await repository.createSubcategory({
      categoryId: beverages.id,
      name: "Frías",
      slug: "frias",
      sortOrder: 0,
      isActive: true,
    });
    await repository.createSubcategory({
      categoryId: food.id,
      name: "Bebidas frías",
      slug: "frias",
      sortOrder: 0,
      isActive: true,
    });

    await expect(
      updateSubcategory(cold.id, { categoryId: food.id }, { repository }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});
