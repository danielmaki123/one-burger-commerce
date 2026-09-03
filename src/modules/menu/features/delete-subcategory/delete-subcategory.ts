import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type DeleteSubcategoryDependencies = {
  repository: MenuRepository;
};

export async function deleteSubcategory(
  id: string,
  { repository }: DeleteSubcategoryDependencies,
): Promise<void> {
  const existing = await repository.findSubcategoryById(id);
  if (!existing) {
    throw new MenuError(404, "NOT_FOUND", "Subcategory not found");
  }

  const productCount = await repository.countProductsBySubcategory(id);
  if (productCount > 0) {
    throw new MenuError(
      409,
      "CONFLICT",
      "Subcategory cannot be deleted because it has active products",
    );
  }

  await repository.deleteSubcategory(id);
}
