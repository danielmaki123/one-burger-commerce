import type { SubcategoryRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ListAdminSubcategoriesInput = {
  categoryId?: string;
  isActive?: boolean;
};

type ListAdminSubcategoriesDependencies = {
  repository: MenuRepository;
};

export async function listAdminSubcategories(
  input: ListAdminSubcategoriesInput,
  { repository }: ListAdminSubcategoriesDependencies,
): Promise<{ data: SubcategoryRecord[] }> {
  const subcategories = await repository.listSubcategories({
    categoryId: input.categoryId,
    isActive: input.isActive,
  });
  return { data: subcategories };
}
