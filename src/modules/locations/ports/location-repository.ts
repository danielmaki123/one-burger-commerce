import type { LocationRecord } from "@/modules/locations/domain/location.types";

/**
 * Lectura de los locales (T8).
 *
 * Fase 1 solo necesita listarlos: la resolución de "qué local atiende este pedido" es
 * pura (`resolveLocation`) y trabaja sobre la lista completa, porque el local por
 * defecto es el primero activo por orden y eso no se puede resolver sin verlos todos.
 */
export interface LocationRepository {
  listLocations(): Promise<LocationRecord[]>;
}
