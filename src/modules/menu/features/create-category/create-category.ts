import { normalizeCategoryColor } from "@/modules/menu/domain/category-color";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { CategoryRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type CreateCategoryInput = {
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  color?: string | null;
};

type CreateCategoryDependencies = {
  repository: MenuRepository;
};

export async function createCategory(
  input: CreateCategoryInput,
  { repository }: CreateCategoryDependencies,
): Promise<{ data: CategoryRecord; meta: { updatedAt: string } }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (!input.slug || input.slug.trim().length === 0) {
    throw new MenuError(400, "BAD_REQUEST", "Invalid payload", { slug: "Required" });
  }

  const existing = await repository.findCategoryBySlug(input.slug);
  if (existing) {
    throw new MenuError(409, "CONFLICT", "Slug already exists");
  }

  const category = await repository.createCategory({
    name: input.name.trim(),
    slug: input.slug.trim(),
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    color: normalizeCategoryColor(input.color),
  });

  return {
    data: category,
    meta: { updatedAt: new Date().toISOString() },
  };
}
