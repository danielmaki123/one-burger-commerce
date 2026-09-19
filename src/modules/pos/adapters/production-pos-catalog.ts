import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getCatalog } from "@/modules/menu/features/get-catalog/get-catalog";

import { projectPosCatalog } from "../domain/pos-catalog-view";
import type { PosCatalogPort } from "../ports/pos-catalog";

/**
 * TASK-302 — el catálogo del POS en producción.
 *
 * Vive en `adapters/` y no en la ruta porque **instancia Prisma**: la ruta solo orquesta (regla de
 * `AGENTS.md`, y hay un contrato que la mide).
 *
 * La fuente es el **mismo** caso de uso que alimenta la carta (`getCatalog`), con `scope: "pos"`: el
 * mostrador no tiene un camino de precios propio y solo se diferencia en qué incluye (los agotados,
 * para poder avisarlos). Lo único propio del POS es la proyección de la vista
 * (`projectPosCatalog`): aplanar, derivar `requiresOptions` y armar los chips de categoría.
 */
export function createProductionPosCatalog(): PosCatalogPort {
  return {
    async listCatalog({ locationId, query }) {
      const catalog = await getCatalog(
        { scope: "pos", locationId, query },
        {
          repository: new PrismaMenuRepository(),
          locationRepository: new PrismaLocationRepository(),
        },
      );

      return projectPosCatalog(catalog.categories, query);
    },
  };
}
