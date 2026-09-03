import { MenuError } from "@/modules/menu/domain/menu-errors";
import type { ProductRecord } from "@/modules/menu/domain/menu.types";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

type GetAdminProductDependencies = {
  repository: MenuRepository;
};

export async function getAdminProduct(
  id: string,
  { repository }: GetAdminProductDependencies,
): Promise<{ data: ProductRecord }> {
  const product = await repository.getProductById(id);
  if (!product) {
    throw new MenuError(404, "NOT_FOUND", "Product not found");
  }
  return { data: product };
}
