import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";

/**
 * TASK-308 — el local del POS en producción.
 *
 * Vive en `adapters/` y no en las rutas porque instancia Prisma (`AGENTS.md`: la ruta solo orquesta,
 * y el contrato de rutas lo mide). Es el puerto de locales que ya existe: el flag del mostrador es un
 * dato del local, así que no hay un repositorio nuevo que mantener en dos lugares.
 */
export function createProductionPosLocationDependencies() {
  return { repository: new PrismaLocationRepository() };
}
