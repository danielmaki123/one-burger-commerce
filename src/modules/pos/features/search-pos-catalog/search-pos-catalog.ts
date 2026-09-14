import { normalizeSearchText } from "@/shared/lib/normalize-search-text";

import type { PosCatalogPort, PosCatalogProduct } from "../../ports/pos-catalog";

/**
 * TASK-301 — el cajero busca en el catálogo del local.
 *
 * Filtra **en memoria** sobre el catálogo ya resuelto para el local: una consulta por tecla sería un
 * viaje a la base por cada letra, y el catálogo de un local entra cómodo en memoria. La comparación
 * usa la normalización compartida (`normalizeSearchText`), la misma del menú público y la home, así
 * que "cafe" y "café" dan lo mismo en todas las pantallas.
 */

export interface PosCatalogSearchResult {
  products: PosCatalogProduct[];
  total: number;
  query: string;
}

export async function searchPosCatalog(params: {
  catalog: PosCatalogPort;
  locationId: string;
  query: string;
}): Promise<PosCatalogSearchResult> {
  const products = await params.catalog.listProducts({ locationId: params.locationId });
  const query = params.query.trim();

  if (query === "") {
    return { products, total: products.length, query };
  }

  const needle = normalizeSearchText(query);
  const matches = products.filter(
    (product) =>
      normalizeSearchText(product.name).includes(needle) ||
      normalizeSearchText(product.categoryName).includes(needle),
  );

  // Se conserva el orden del catálogo (el que el local definió): reordenar por "relevancia" acá
  // haría que el mostrador viera las cosas en otro orden que el menú.
  return { products: matches, total: matches.length, query };
}
