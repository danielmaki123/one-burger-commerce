import type { ProductRecord } from "@/modules/menu/domain/menu.types";

/**
 * TASK-301 — lo que el POS necesita del catálogo.
 *
 * El POS no tiene un camino propio de precios ni de disponibilidad: lee el **mismo** catálogo que la
 * carta (`getCatalog`, alcance `pos`) y su vista agrega solo dos cosas derivadas, no una copia de
 * campos:
 *
 * - `requiresOptions`: si hay que elegir modificadores antes de poder venderlo (regla compartida
 *   `canQuickAddProduct`, la misma del "+" de la home y del menú).
 * - `categoryName`: el contexto de la categoría que lo contiene, que la tarjeta muestra y la búsqueda
 *   usa para encontrar ("bebidas" lista las bebidas).
 *
 * Antes este tipo era un shape paralelo de 7 campos (con `price` en lugar de `basePrice`, sin fotos ni
 * modificadores): dos definiciones del mismo producto que podían divergir.
 */
export interface PosCatalogProduct extends ProductRecord {
  requiresOptions: boolean;
  categoryName: string;
}

/** El chip de categoría del mostrador, con su contador real (nada hardcodeado ni recalculado). */
export type PosCatalogCategoryChip = {
  id: string;
  name: string;
  count: number;
};

/** Lo que devuelve el puerto: los productos del local y los chips para filtrar por categoría. */
export type PosCatalogView = {
  products: PosCatalogProduct[];
  categories: PosCatalogCategoryChip[];
  total: number;
  query: string;
};

export interface PosCatalogPort {
  listCatalog(params: { locationId: string; query: string }): Promise<PosCatalogView>;
}
