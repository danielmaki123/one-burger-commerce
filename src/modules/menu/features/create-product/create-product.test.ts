import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import { createProduct } from "./create-product";

function createRepository(): InMemoryMenuRepository {
  return new InMemoryMenuRepository();
}

describe("createProduct", () => {
  it("creates a product with valid input", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });

    const result = await createProduct(
      {
        categoryId: "cat_1",
        name: "Cafe americano",
        basePrice: 85,
        availability: { isAvailable: true, isActive: true },
      },
      { repository },
    );

    expect(result.data.name).toBe("Cafe americano");
    expect(result.data.basePrice).toBe(85);
    expect(result.data.availability.isAvailable).toBe(true);
  });

  it("persists packagingFeeAmount when provided", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });

    const result = await createProduct(
      {
        categoryId: "cat_1",
        name: "Cafe americano",
        basePrice: 85,
        packagingFeeAmount: 12,
        availability: { isAvailable: true, isActive: true },
      },
      { repository },
    );

    expect(result.data.packagingFeeAmount).toBe(12);
  });

  it("rejects negative basePrice", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });

    await expect(
      createProduct(
        {
          categoryId: "cat_1",
          name: "Cafe americano",
          basePrice: -10,
          availability: { isAvailable: true, isActive: true },
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("rejects product in nonexistent category", async () => {
    const repository = createRepository();

    await expect(
      createProduct(
        {
          categoryId: "cat_missing",
          name: "Cafe americano",
          basePrice: 85,
          availability: { isAvailable: true, isActive: true },
        },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("accepts empty modifierGroups array", async () => {
    const repository = createRepository();
    await repository.createCategory({
      name: "Bebidas",
      slug: "bebidas",
      sortOrder: 0,
      isActive: true,
    });

    const result = await createProduct(
      {
        categoryId: "cat_1",
        name: "Cafe americano",
        basePrice: 85,
        availability: { isAvailable: true, isActive: true },
        modifierGroups: [],
      },
      { repository },
    );

    expect(result.data.modifierGroups).toEqual([]);
  });

  it("accepts valid modifierGroups and persists relations", async () => {
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

    const result = await createProduct(
      {
        categoryId: "cat_1",
        name: "Cafe americano",
        basePrice: 85,
        availability: { isAvailable: true, isActive: true },
        modifierGroups: [{ id: "mg_1" }],
      },
      { repository },
    );

    expect(result.data.modifierGroups).toHaveLength(1);
    expect(result.data.modifierGroups[0].id).toBe("mg_1");
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

    await expect(
      createProduct(
        {
          categoryId: "cat_1",
          name: "Cafe americano",
          basePrice: 85,
          availability: { isAvailable: true, isActive: true },
          modifierGroups: [{ id: "mg_1" }, { id: "mg_1" }],
        },
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

    await expect(
      createProduct(
        {
          categoryId: "cat_1",
          name: "Cafe americano",
          basePrice: 85,
          availability: { isAvailable: true, isActive: true },
          modifierGroups: [{ id: "mg_missing" }],
        },
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

    await expect(
      createProduct(
        {
          categoryId: "cat_1",
          name: "Cafe americano",
          basePrice: 85,
          availability: { isAvailable: true, isActive: true },
          bundleRules: [{ name: "Combo", ruleType: "fixed", config: {} }],
        },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
    });
  });
});
