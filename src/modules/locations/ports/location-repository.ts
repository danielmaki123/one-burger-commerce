import type { LocationInput } from "@/modules/locations/domain/location-rules";
import type { LocationRecord } from "@/modules/locations/domain/location.types";

/**
 * Locales del negocio (T8).
 *
 * `listLocations` es lo único que necesita la resolución de "qué local atiende este
 * pedido": el local por defecto es el primero activo por orden y eso no se puede saber
 * sin verlos todos. El resto son las operaciones del admin.
 */
export interface LocationRepository {
  listLocations(): Promise<LocationRecord[]>;
  findLocationById(id: string): Promise<LocationRecord | null>;
  /** El slug es único: sirve para URLs y para detectar duplicados antes de guardar. */
  findLocationBySlug(slug: string): Promise<LocationRecord | null>;
  createLocation(input: LocationInput): Promise<LocationRecord>;
  updateLocation(id: string, input: LocationInput): Promise<LocationRecord>;
  deleteLocation(id: string): Promise<void>;
}
