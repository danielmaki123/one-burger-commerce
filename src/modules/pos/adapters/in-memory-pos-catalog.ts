import type { PosCatalogPort, PosCatalogView } from "../ports/pos-catalog";

/**
 * TASK-301 — doble del catálogo del POS, para tests.
 *
 * Implementa el **puerto completo** (`AGENTS.md`): si el puerto suma un método, este archivo no
 * compila hasta implementarlo, y ningún test puede quedar midiendo un doble incompleto.
 *
 * Devuelve la **vista** que le cargan por local (la misma forma que el puerto promete). La proyección
 * de verdad (`projectPosCatalog`) tiene su propio test: no se reimplementa acá, que es como un doble
 * empieza a medir otra cosa que la producción.
 */
export function createInMemoryPosCatalog(
  viewsByLocation: Record<string, PosCatalogView>,
  options: { onList?: (params: { locationId: string; query: string }) => void } = {},
): PosCatalogPort {
  // Se copian los arreglos: un test que mutara el original después de crear el doble no debería
  // cambiar lo que el POS ve.
  const catalog = new Map(
    Object.entries(viewsByLocation).map(([locationId, view]) => [
      locationId,
      { ...view, products: [...view.products], categories: [...view.categories] },
    ]),
  );

  return {
    async listCatalog({ locationId, query }) {
      options.onList?.({ locationId, query });

      const view = catalog.get(locationId);
      if (!view) {
        return { products: [], categories: [], total: 0, query: query.trim() };
      }

      return { ...view, products: [...view.products], categories: [...view.categories] };
    },
  };
}
