import type { LocationRepository } from "@/modules/locations/ports/location-repository";

import { PosError } from "../../domain/pos-errors";

/**
 * TASK-308 — el punto de venta tiene que estar prendido en ese local.
 *
 * El flag es del local, no del rol: un cajero puede tener dos sucursales asignadas y una sola con
 * mostrador. Por eso la pregunta se hace **después** de resolver el local y antes de tocar cualquier
 * dato de la venta: con el POS apagado no se lee el catálogo, no se cobra y no se abre ni se cierra
 * caja.
 *
 * Un local que no existe tampoco habilita nada: la respuesta es la misma (403) para no contar qué
 * locales hay de más.
 */
export async function ensurePosEnabled(
  { locationId }: { locationId: string },
  { repository }: { repository: LocationRepository },
): Promise<void> {
  const location = await repository.findLocationById(locationId);

  if (!location || !location.posEnabled) {
    throw new PosError(403, "FORBIDDEN", "El punto de venta está apagado en este local.", {
      locationId: "El punto de venta está apagado en este local.",
    });
  }
}
