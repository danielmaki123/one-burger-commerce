import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaMenuRepository } from "@/modules/menu/adapters/prisma-menu-repository";
import { getPublicMenu } from "@/modules/menu/features/get-public-menu/get-public-menu";

import type { PosCatalogPort } from "../ports/pos-catalog";
import { createMenuPosCatalogAdapter } from "./menu-pos-catalog";

/**
 * TASK-302 — el catálogo del POS en producción.
 *
 * Vive en `adapters/` y no en la ruta porque **instancia Prisma**: la ruta solo orquesta (regla de
 * `AGENTS.md`, y hay un contrato que la mide). La fuente es el menú público del local, que ya
 * resuelve los precios de esa sucursal: el POS no tiene un camino de precios propio.
 */
export function createProductionPosCatalog(): PosCatalogPort {
  return createMenuPosCatalogAdapter({
    getMenu: (params) =>
      getPublicMenu(params, {
        repository: new PrismaMenuRepository(),
        locationRepository: new PrismaLocationRepository(),
      }),
  });
}
