import { filterPosProducts } from "../../domain/search-pos-products";
import type { PosCatalogPort, PosCatalogProduct } from "../../ports/pos-catalog";

/**
 * TASK-301 — el cajero busca en el catálogo del local.
 *
 * Lee el catálogo **una sola vez** y filtra en memoria con la regla compartida
 * (`filterPosProducts`, TASK-302): una consulta por tecla sería un viaje a la base por cada letra, y
 * el catálogo de un local entra cómodo en memoria. La pantalla del mostrador usa la misma función
 * sobre lo que ya tiene, así que no hay dos criterios de búsqueda.
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

  const matches = filterPosProducts(products, query);

  return { products: matches, total: matches.length, query };
}
