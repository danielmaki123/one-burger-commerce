import { LocationError } from "@/modules/locations/domain/location-errors";
import { validateLocationProductInput } from "@/modules/locations/domain/location-product-rules";
import type {
  LocationProductInput,
  LocationProductRecord,
} from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type { MenuRepository } from "@/modules/menu/ports/menu-repository";

/**
 * T8 fase 4 — el precio y la disponibilidad de un producto **en un local**.
 *
 * Se guarda como excepción: precio propio (`null` = el base), agotado y "no lo vendo".
 * Volver al precio base es borrar la excepción, no guardar el precio del negocio copiado
 * (así, si el owner sube el precio base, todos los locales sin excepción lo siguen).
 */
type SetLocationProductDependencies = {
  locationRepository: LocationRepository;
  menuRepository: MenuRepository;
};

export async function setLocationProduct(
  locationId: string,
  productId: string,
  input: LocationProductInput,
  { locationRepository, menuRepository }: SetLocationProductDependencies,
): Promise<{ data: LocationProductRecord | null; meta: { updatedAt: string } }> {
  const location = await locationRepository.findLocationById(locationId);
  if (!location) {
    throw new LocationError(404, "NOT_FOUND", "Location not found");
  }

  const product = await menuRepository.getProductById(productId);
  if (!product) {
    throw new LocationError(404, "NOT_FOUND", "Product not found");
  }

  const errors = validateLocationProductInput(input);
  if (Object.keys(errors).length > 0) {
    throw new LocationError(422, "VALIDATION_ERROR", "Invalid payload", errors);
  }

  const isBasePrice = input.priceOverride === null;
  const isPlainlySold = input.isAvailable && input.isActive;

  // Sin excepción que guardar, la fila se borra: es la forma de decir "como el negocio".
  if (isBasePrice && isPlainlySold) {
    await locationRepository.deleteLocationProduct(locationId, productId);

    return { data: null, meta: { updatedAt: new Date().toISOString() } };
  }

  const row = await locationRepository.upsertLocationProduct({ ...input, locationId, productId });

  return { data: row, meta: { updatedAt: new Date().toISOString() } };
}
