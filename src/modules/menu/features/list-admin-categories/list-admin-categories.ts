import type { CategoryRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ListAdminCategoriesDependencies = {
  repository: MenuRepository;
};

export async function listAdminCategories({
  repository,
}: ListAdminCategoriesDependencies): Promise<{ data: CategoryRecord[] }> {
  const categories = await repository.listCategories();
  return { data: categories };
}
