import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { SubcategoryRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type UpdateSubcategoryInput = {
  categoryId?: string;
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
};

type UpdateSubcategoryDependencies = {
  repository: MenuRepository;
};

export async function updateSubcategory(
  id: string,
  input: UpdateSubcategoryInput,
  { repository }: UpdateSubcategoryDependencies,
): Promise<{ data: SubcategoryRecord; meta: { updatedAt: string; movedProducts?: number } }> {
  const existing = await repository.findSubcategoryById(id);
  if (!existing) {
    throw new MenuError(404, "NOT_FOUND", "Subcategory not found");
  }

  const destinationCategoryId = input.categoryId ?? existing.categoryId;
  if (input.categoryId && input.categoryId !== existing.categoryId) {
    const destination = await repository.findCategoryById(input.categoryId);
    if (!destination) {
      throw new MenuError(404, "NOT_FOUND", "Destination category not found");
    }
  }

  const candidateSlug = input.slug?.trim() ?? existing.slug;
  if (
    candidateSlug.length > 0 &&
    (candidateSlug !== existing.slug || destinationCategoryId !== existing.categoryId)
  ) {
    const slugTaken = await repository.findSubcategoryBySlugInCategory(
      destinationCategoryId,
      candidateSlug,
    );
    if (slugTaken && slugTaken.id !== existing.id) {
      throw new MenuError(409, "CONFLICT", "Slug already exists in this category");
    }
  }

  let movedProducts: number | undefined;
  if (input.categoryId && input.categoryId !== existing.categoryId) {
    const moved = await repository.moveSubcategory(id, input.categoryId);
    movedProducts = moved.movedProducts;
  }

  const subcategory = await repository.updateSubcategory(id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
  });

  return {
    data: subcategory,
    meta: { updatedAt: new Date().toISOString(), ...(movedProducts !== undefined ? { movedProducts } : {}) },
  };
}
