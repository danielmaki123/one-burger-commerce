import type { ProductRecord, PublicMenuCategory } from "@/modules/menu/domain/menu.types";
import { canQuickAddProduct } from "@/shared/lib/product-quick-add";

import type {
  PosCatalogCategoryChip,
  PosCatalogProduct,
  PosCatalogView,
} from "../ports/pos-catalog";

/**
 * La vista del mostrador: el catálogo del menú, **proyectado**.
 *
 * No es un segundo catálogo ni un shape paralelo. Toma el mismo `PublicMenuCategory[]` que alimenta la
 * carta y solo agrega dos cosas derivadas —`categoryName` (contexto de la tarjeta y de la búsqueda) y
 * `requiresOptions` (regla compartida `canQuickAddProduct`)—, además de aplanar y armar los chips de
 * categoría con su contador. El precio y la disponibilidad ya vienen resueltos por el local (T8) desde
 * el caso de uso: acá no se filtra ni se recalcula nada.
 */

export function projectPosCatalog(
  categories: PublicMenuCategory[],
  query = "",
): PosCatalogView {
  const products: PosCatalogProduct[] = [];
  const chips: PosCatalogCategoryChip[] = [];
  const seen = new Set<string>();

  const push = (product: ProductRecord, category: PublicMenuCategory) => {
    // Un producto puede estar listado en la categoría y en una subcategoría: el mostrador no puede
    // verlo dos veces.
    if (seen.has(product.id)) return;

    seen.add(product.id);
    products.push({
      ...product,
      categoryName: category.name,
      requiresOptions: !canQuickAddProduct(product),
    });
  };

  for (const category of categories) {
    const before = products.length;

    for (const product of category.products) push(product, category);
    for (const subcategory of category.subcategories) {
      for (const product of subcategory.products) push(product, category);
    }

    // El chip sale de lo que quedó en la vista: una categoría sin productos no ofrece nada que filtrar.
    const count = products.length - before;
    if (count > 0) {
      chips.push({ id: category.id, name: category.name, count });
    }
  }

  return {
    products,
    categories: chips,
    total: products.length,
    query: query.trim(),
  };
}
