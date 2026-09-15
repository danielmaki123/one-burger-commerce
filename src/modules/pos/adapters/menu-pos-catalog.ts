import type { ProductRecord, PublicMenuCategory } from "@/modules/menu/domain/menu.types";
import { canQuickAddProduct } from "@/shared/lib/product-quick-add";

import type { PosCatalogPort, PosCatalogProduct } from "../ports/pos-catalog";

/**
 * TASK-302 — de dónde sale el catálogo del mostrador.
 *
 * La fuente es el **menú público del local** (`getPublicMenu`), que ya aplica las excepciones de
 * precio y disponibilidad de la sucursal (T8). Este adaptador solo le da la forma que el POS
 * necesita: lista plana, con la categoría de cada producto y con `requiresOptions` decidido por la
 * **misma** regla que el "+" de la home y del menú (`canQuickAddProduct`). Si el POS tuviera su
 * propia regla, el mostrador podría vender de un toque algo que la carta obliga a configurar.
 *
 * Es una función pura (`buildPosCatalog`) más un adaptador fino sobre ella: así el mapeo se prueba
 * sin base de datos y la composición de producción se reduce a pasarle `getPublicMenu`.
 */

function isSellable(product: ProductRecord): boolean {
  return product.availability.isActive && product.availability.isAvailable;
}

export function buildPosCatalog(categories: PublicMenuCategory[]): PosCatalogProduct[] {
  const catalog: PosCatalogProduct[] = [];
  const seen = new Set<string>();

  const push = (product: ProductRecord, category: PublicMenuCategory) => {
    // Un producto puede estar listado en la categoría y en una subcategoría; el mostrador no puede
    // verlo dos veces.
    if (seen.has(product.id) || !isSellable(product)) return;

    seen.add(product.id);
    catalog.push({
      id: product.id,
      name: product.name,
      price: product.basePrice,
      packagingFeeAmount: product.packagingFeeAmount ?? 0,
      categoryId: category.id,
      categoryName: category.name,
      requiresOptions: !canQuickAddProduct(product),
    });
  };

  for (const category of categories) {
    for (const product of category.products) push(product, category);
    for (const subcategory of category.subcategories) {
      for (const product of subcategory.products) push(product, category);
    }
  }

  return catalog;
}

export function createMenuPosCatalogAdapter(deps: {
  getMenu: (params: {
    locationId: string;
  }) => Promise<{ categories: PublicMenuCategory[] }>;
}): PosCatalogPort {
  return {
    async listProducts({ locationId }) {
      const menu = await deps.getMenu({ locationId });

      return buildPosCatalog(menu.categories);
    },
  };
}
