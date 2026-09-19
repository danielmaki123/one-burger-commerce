import { matchesCatalogQuery } from "@/modules/menu/domain/catalog-search";

import type { PosCatalogProduct } from "../ports/pos-catalog";

/**
 * TASK-302 — el filtro del catálogo, en dominio puro.
 *
 * Vive acá y no dentro del caso de uso porque lo usan los dos: el servidor (la búsqueda que el caso de
 * uso del catálogo aplica) y la pantalla del mostrador, que filtra en memoria lo que ya trajo (escribir
 * no dispara una consulta por tecla).
 *
 * La regla es **una sola** y vive en el dominio del menú (`matchesCatalogQuery`): antes había una
 * copia acá y el mostrador podía encontrar cosas distintas que la carta. Este archivo solo le da la
 * forma de lista plana.
 */
export function filterPosProducts(
  products: PosCatalogProduct[],
  query: string,
): PosCatalogProduct[] {
  if (query.trim() === "") return products;

  // Se conserva el orden del catálogo (el que definió el local): reordenar por "relevancia" acá
  // haría que el mostrador viera las cosas en otro orden que la carta.
  return products.filter((product) =>
    matchesCatalogQuery(product.name, product.categoryName, query),
  );
}
