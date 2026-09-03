import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import { updateProduct } from "./update-product";

function createRepository(): InMemoryMenuRepository {
  return new InMemoryMenuRepository();
}

describe("updateProduct", () => {
  it("updates a product with valid input", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const result = await updateProduct(
      created.id,
      { name: "Cafe doble" },
      { repository },
    );

    expect(result.data.name).toBe("Cafe doble");
  });

  it("updates packagingFeeAmount when provided", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const result = await updateProduct(
      created.id,
      { packagingFeeAmount: 15 },
      { repository },
    );

    expect(result.data.packagingFeeAmount).toBe(15);
  });

  it("accepts empty modifierGroups array", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const result = await updateProduct(
      created.id,
      { modifierGroups: [] },
      { repository },
    );

    expect(result.data.modifierGroups).toEqual([]);
  });

  it("accepts valid modifierGroups and replaces relations", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    repository.modifierGroups.push({
      id: "mg_1",
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [],
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const result = await updateProduct(
      created.id,
      { modifierGroups: [{ id: "mg_1" }] },
      { repository },
    );

    expect(result.data.modifierGroups).toHaveLength(1);
    expect(result.data.modifierGroups[0].id).toBe("mg_1");
  });

  it("replaces existing modifierGroups with new ones", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    repository.modifierGroups.push(
      {
        id: "mg_1",
        name: "Size",
        isRequired: true,
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 0,
        options: [],
      },
      {
        id: "mg_2",
        name: "Milk",
        isRequired: false,
        minSelections: 0,
        maxSelections: 1,
        sortOrder: 0,
        options: [],
      },
    );
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
      modifierGroupIds: ["mg_1"],
    });

    expect(created.modifierGroups).toHaveLength(1);

    const result = await updateProduct(
      created.id,
      { modifierGroups: [{ id: "mg_2" }] },
      { repository },
    );

    expect(result.data.modifierGroups).toHaveLength(1);
    expect(result.data.modifierGroups[0].id).toBe("mg_2");
  });

  it("rejects duplicate modifierGroup IDs with 422", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    repository.modifierGroups.push({
      id: "mg_1",
      name: "Size",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      sortOrder: 0,
      options: [],
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    await expect(
      updateProduct(
        created.id,
        { modifierGroups: [{ id: "mg_1" }, { id: "mg_1" }] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects nonexistent modifierGroup IDs with 422", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    await expect(
      updateProduct(
        created.id,
        { modifierGroups: [{ id: "mg_missing" }] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects non-empty bundleRules with 422", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    await expect(
      updateProduct(
        created.id,
        { bundleRules: [{ name: "Combo", ruleType: "fixed", config: {} }] },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects negative basePrice", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });
    const created = await repository.createProduct({
      categoryId: "cat_1",
      name: "Cafe americano",
      basePrice: 85,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    await expect(
      updateProduct(created.id, { basePrice: -10 }, { repository }),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("rejects update to nonexistent product", async () => {
    const repository = createRepository();

    await expect(
      updateProduct("prod_missing", { name: "Cafe" }, { repository }),
    ).rejects.toBeInstanceOf(MenuError);
  });
});
