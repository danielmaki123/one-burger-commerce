import { normalizeCategoryColor } from "@/modules/menu/domain/category-color";
import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { CategoryRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type UpdateCategoryInput = {
  name?: string;
  slug?: string;
  sortOrder?: number;
  isActive?: boolean;
  /** `null` borra el color: la categoría vuelve al diseño del sistema. */
  color?: string | null;
};

type UpdateCategoryDependencies = {
  repository: MenuRepository;
};

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  { repository }: UpdateCategoryDependencies,
): Promise<{ data: CategoryRecord; meta: { updatedAt: string } }> {
  const existing = await repository.findCategoryById(id);
  if (!existing) {
    throw new MenuError(404, "NOT_FOUND", "Category not found");
  }

  if (input.slug && input.slug.trim().length > 0 && input.slug !== existing.slug) {
    const slugTaken = await repository.findCategoryBySlug(input.slug);
    if (slugTaken) {
      throw new MenuError(409, "CONFLICT", "Slug already exists");
    }
  }

  const category = await repository.updateCategory(id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.slug !== undefined ? { slug: input.slug.trim() } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    // Un hex inválido se guarda como "sin color" en vez de romper la carta.
    ...(input.color !== undefined ? { color: normalizeCategoryColor(input.color) } : {}),
  });

  return {
    data: category,
    meta: { updatedAt: new Date().toISOString() },
  };
}
