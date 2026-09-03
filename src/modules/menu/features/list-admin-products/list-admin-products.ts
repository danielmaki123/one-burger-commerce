import type { ProductRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type ListAdminProductsInput = {
  categoryId?: string;
  subcategoryId?: string;
  isActive?: boolean;
  isAvailable?: boolean;
  search?: string;
};

type ListAdminProductsDependencies = {
  repository: MenuRepository;
};

export async function listAdminProducts(
  input: ListAdminProductsInput,
  { repository }: ListAdminProductsDependencies,
): Promise<{ data: ProductRecord[] }> {
  const products = await repository.listProducts({
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    isActive: input.isActive,
    isAvailable: input.isAvailable,
    search: input.search,
  });
  return { data: products };
}
