import { LocationError } from "@/modules/locations/domain/location-errors";
import {
  normalizeLocationSlug,
  validateLocationInput,
  type LocationInput,
} from "@/modules/locations/domain/location-rules";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";

/**
 * T8 fase 2 — editar un local.
 *
 * Guardado completo, como el formulario: no quedan restos de lo anterior. `isActive`
 * apagado significa que el local deja de ofrecerse en el checkout sin perder su
 * configuración.
 */
type UpdateLocationDependencies = {
  repository: LocationRepository;
};

export async function updateLocation(
  id: string,
  input: LocationInput,
  { repository }: UpdateLocationDependencies,
): Promise<{ data: LocationRecord; meta: { updatedAt: string } }> {
  const current = await repository.findLocationById(id);
  if (!current) {
    throw new LocationError(404, "NOT_FOUND", "Location not found");
  }

  const slug = normalizeLocationSlug(input.slug);
  const errors = validateLocationInput({ ...input, slug });

  if (Object.keys(errors).length > 0) {
    throw new LocationError(422, "VALIDATION_ERROR", "Invalid payload", errors);
  }

  const withSameSlug = await repository.findLocationBySlug(slug);
  if (withSameSlug && withSameSlug.id !== id) {
    throw new LocationError(409, "CONFLICT", "Location slug already exists", {
      slug: `Ya hay un local con el identificador ${slug}`,
    });
  }

  // Guarda simétrica del borrado (A): el negocio necesita al menos un local que se pueda elegir.
  // Apagar el último dejaría el checkout sin a dónde mandar el pedido.
  if (current.isActive && !input.isActive) {
    const others = await repository.listLocations();
    const anotherActive = others.some(
      (location) => location.id !== id && location.isActive,
    );

    if (!anotherActive) {
      throw new LocationError(409, "CONFLICT", "Cannot disable the last active location", {
        isActive:
          "Este es el único local activo: activá otro antes de apagar este, o dejalo encendido",
      });
    }
  }

  const location = await repository.updateLocation(id, {
    ...input,
    name: input.name.trim(),
    slug,
    whatsapp: input.whatsapp?.trim() || null,
  });

  return { data: location, meta: { updatedAt: new Date().toISOString() } };
}
