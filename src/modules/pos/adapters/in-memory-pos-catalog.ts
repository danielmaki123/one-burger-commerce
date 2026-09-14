import type { PosCatalogPort, PosCatalogProduct } from "../ports/pos-catalog";

/**
 * TASK-301 — doble del catálogo del POS, para tests.
 *
 * Implementa el **puerto completo** (`AGENTS.md`): si el puerto suma un método, este archivo no
 * compila hasta implementarlo, y ningún test puede quedar midiendo un doble incompleto.
 */
export function createInMemoryPosCatalog(
  productsByLocation: Record<string, PosCatalogProduct[]>,
  options: { onList?: (params: { locationId: string }) => void } = {},
): PosCatalogPort {
  // Se copian los arreglos: un test que mutara el original después de crear el doble no debería
  // cambiar lo que el POS ve.
  const catalog = new Map(
    Object.entries(productsByLocation).map(([locationId, products]) => [locationId, [...products]]),
  );

  return {
    async listProducts({ locationId }) {
      options.onList?.({ locationId });

      return [...(catalog.get(locationId) ?? [])];
    },
  };
}
