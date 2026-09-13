import { formatPickupAddress } from "@/modules/locations/domain/location-rules";

/** Campos de dirección con los que se puede armar el destino de un local. */
export type LocationDirectionsSource = {
  mapsUrl: string | null;
  addressLine: string | null;
  addressReference: string | null;
  city: string | null;
};

/**
 * A-07 — el enlace de "Cómo llegar" de **un local**.
 *
 * Es la versión por sucursal de lo que la home hacía para el negocio: primero el mapa que el
 * owner cargó en el local, y si no lo cargó, una búsqueda de mapas armada con **la dirección
 * de ese local** (no la del negocio). Sin mapa ni dirección devuelve `null`, para que el
 * consumidor no dibuje un control que no lleva a ningún lado.
 */
export function locationDirectionsHref(location: LocationDirectionsSource): string | null {
  if (location.mapsUrl) return location.mapsUrl;

  const address = formatPickupAddress(location);
  if (!address) return null;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
