import { normalizeSearchText } from "@/shared/lib/normalize-search-text";

import type { PosCatalogProduct } from "../ports/pos-catalog";

/**
 * TASK-302 — el filtro del catálogo, en dominio puro.
 *
 * Vive acá y no dentro del caso de uso porque lo usan los dos: el servidor (la ruta del catálogo,
 * por si mañana se busca del lado del servidor) y la pantalla del mostrador, que filtra en memoria
 * lo que ya trajo. Con una regla sola, el mismo término da el mismo resultado en los dos lados.
 *
 * La comparación usa la normalización compartida (`normalizeSearchText`): la misma del menú público
 * y de la home, así "cafe" y "café" se comportan igual en todo el producto.
 */
export function filterPosProducts(
  products: PosCatalogProduct[],
  query: string,
): PosCatalogProduct[] {
  const trimmed = query.trim();

  if (trimmed === "") return products;

  const needle = normalizeSearchText(trimmed);

  // Se conserva el orden del catálogo (el que definió el local): reordenar por "relevancia" acá
  // haría que el mostrador viera las cosas en otro orden que la carta.
  return products.filter(
    (product) =>
      normalizeSearchText(product.name).includes(needle) ||
      normalizeSearchText(product.categoryName).includes(needle),
  );
}
