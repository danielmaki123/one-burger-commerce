import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { SubcategoryRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type CreateSubcategoryInput = {
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
};

type CreateSubcategoryDependencies = {
  repository: MenuRepository;
};

export async function createSubcategory(
  input: CreateSubcategoryInput,
  { repository }: CreateSubcategoryDependencies,
): Promise<{ data: SubcategoryRecord; meta: { updatedAt: string } }> {
  if (!input.categoryId || input.categoryId.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", {
      categoryId: "Required",
    });
  }

  if (!input.name || input.name.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (!input.slug || input.slug.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { slug: "Required" });
  }

  const category = await repository.findCategoryById(input.categoryId);
  if (!category) {
    throw new MenuError(404, "NOT_FOUND", "Category not found");
  }

  const existing = await repository.findSubcategoryBySlugInCategory(
    input.categoryId,
    input.slug,
  );
  if (existing) {
    throw new MenuError(409, "CONFLICT", "Slug already exists in this category");
  }

  const subcategory = await repository.createSubcategory({
    categoryId: input.categoryId,
    name: input.name.trim(),
    slug: input.slug.trim(),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
  });

  return {
    data: subcategory,
    meta: { updatedAt: new Date().toISOString() },
  };
}
