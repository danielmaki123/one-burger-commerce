import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import { createCategory } from "./create-category";

function createRepository(): InMemoryMenuRepository {
  return new InMemoryMenuRepository();
}

describe("createCategory", () => {
  it("creates a category with valid input", async () => {
    const repository = createRepository();
    const result = await createCategory(
      { name: "Bebidas", slug: "bebidas", sortOrder: 10, isActive: true },
      { repository },
    );

    expect(result.data.name).toBe("Bebidas");
    expect(result.data.slug).toBe("bebidas");
    expect(result.meta.updatedAt).toBeDefined();
  });

  it("rejects duplicate slug", async () => {
    const repository = createRepository();
    await createCategory(
      { name: "Bebidas", slug: "bebidas", sortOrder: 10, isActive: true },
      { repository },
    );

    await expect(
      createCategory(
        { name: "Bebidas 2", slug: "bebidas", sortOrder: 20, isActive: true },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });

  it("rejects missing name", async () => {
    const repository = createRepository();
    await expect(
      createCategory(
        { name: "", slug: "bebidas", sortOrder: 10, isActive: true },
        { repository },
      ),
    ).rejects.toBeInstanceOf(MenuError);
  });
});
