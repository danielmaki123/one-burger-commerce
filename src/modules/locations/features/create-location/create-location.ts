import { LocationError } from "@/modules/locations/domain/location-errors";
import {
  normalizeLocationSlug,
  validateLocationInput,
  type LocationInput,
} from "@/modules/locations/domain/location-rules";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";

/**
 * T8 fase 2 — crear un local.
 *
 * El slug se normaliza antes de validar y antes de buscar duplicados: "Sucursal Norte" y
 * "sucursal-norte" son el mismo local, no dos.
 */
type CreateLocationDependencies = {
  repository: LocationRepository;
};

export async function createLocation(
  input: LocationInput,
  { repository }: CreateLocationDependencies,
): Promise<{ data: LocationRecord; meta: { updatedAt: string } }> {
  const slug = normalizeLocationSlug(input.slug);
  const errors = validateLocationInput({ ...input, slug });

  if (Object.keys(errors).length > 0) {
    throw new LocationError(422, "VALIDATION_ERROR", "Invalid payload", errors);
  }

  const existing = await repository.findLocationBySlug(slug);
  if (existing) {
    throw new LocationError(409, "CONFLICT", "Location slug already exists", {
      slug: `Ya hay un local con el identificador ${slug}`,
    });
  }

  const location = await repository.createLocation({
    ...input,
    name: input.name.trim(),
    slug,
    whatsapp: input.whatsapp?.trim() || null,
  });

  return { data: location, meta: { updatedAt: new Date().toISOString() } };
}
