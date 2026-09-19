import { normalizeSearchText } from "@/shared/lib/normalize-search-text";

import type { PublicMenuCategory } from "./menu.types";

/**
 * La búsqueda del catálogo, en el dominio del menú.
 *
 * Una sola regla para las dos superficies: el caso de uso (`getCatalog`) cuando busca del lado del
 * servidor y la pantalla del mostrador cuando filtra en memoria lo que ya trajo. La comparación usa la
 * normalización compartida (`normalizeSearchText`), la misma del menú público y de la home, así "cafe" y
 * "café" se comportan igual en todo el producto.
 *
 * Se conserva el orden del catálogo (el que definió el local): reordenar por "relevancia" haría que el
 * mostrador viera las cosas en otro orden que la carta.
 */

/** ¿El producto —o la categoría que lo contiene— coincide con lo que se escribió? */
export function matchesCatalogQuery(
  name: string,
  categoryName: string,
  query: string,
): boolean {
  const trimmed = query.trim();

  if (trimmed === "") return true;

  const needle = normalizeSearchText(trimmed);

  return (
    normalizeSearchText(name).includes(needle) ||
    normalizeSearchText(categoryName).includes(needle)
  );
}

/**
 * Filtra el catálogo por la búsqueda y **saca lo que se queda vacío**: una categoría o una subcategoría
 * sin productos se vería como un error de la carta (misma regla que el precio del local).
 */
export function filterCatalogCategories(
  categories: PublicMenuCategory[],
  query: string,
): PublicMenuCategory[] {
  if (query.trim() === "") return categories;

  return categories
    .map((category) => {
      const matches = (product: { name: string }) =>
        matchesCatalogQuery(product.name, category.name, query);

      return {
        ...category,
        products: category.products.filter(matches),
        subcategories: category.subcategories
          .map((subcategory) => ({
            ...subcategory,
            products: subcategory.products.filter(matches),
          }))
          .filter((subcategory) => subcategory.products.length > 0),
      };
    })
    .filter(
      (category) => category.products.length > 0 || category.subcategories.length > 0,
    );
}
