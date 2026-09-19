import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getCatalog } from "@/modules/menu/features/get-catalog/get-catalog";

import type { PosCatalogPort } from "../ports/pos-catalog";
import { createMenuPosCatalogAdapter } from "./menu-pos-catalog";

/**
 * TASK-302 — el catálogo del POS en producción.
 *
 * Vive en `adapters/` y no en la ruta porque **instancia Prisma**: la ruta solo orquesta (regla de
 * `AGENTS.md`, y hay un contrato que la mide). La fuente es el **mismo** caso de uso que alimenta la
 * carta (`getCatalog`), con `scope: "pos"`: el mostrador no tiene un camino de precios propio y solo se
 * diferencia en qué incluye (los agotados, para poder avisarlos).
 */
export function createProductionPosCatalog(): PosCatalogPort {
  return createMenuPosCatalogAdapter({
    getMenu: (params) =>
      getCatalog(
        { scope: "pos", locationId: params.locationId },
        {
          repository: new PrismaMenuRepository(),
          locationRepository: new PrismaLocationRepository(),
        },
      ),
  });
}
