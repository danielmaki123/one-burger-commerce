import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";

/**
 * T8 fase 6 — los locales que ve el cliente.
 *
 * Solo los activos y **solo los datos del punto de retiro**: dirección, mapa, horario, minutos
 * de preparación y si están recibiendo pedidos. El teléfono del local, el WhatsApp interno y la
 * auditoría no salen a la calle (para el contacto del negocio ya está la configuración pública).
 */
export type PublicLocation = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  addressReference: string | null;
  mapsUrl: string | null;
  businessHours: BusinessHours;
  pickupLeadMinutes: number;
  pickupMaxMinutes: number | null;
  isAcceptingOrders: boolean;
  closedMessage: string | null;
};

type ListPublicLocationsDependencies = {
  repository: LocationRepository;
};

export async function listPublicLocations({
  repository,
}: ListPublicLocationsDependencies): Promise<{ data: PublicLocation[] }> {
  const locations = await repository.listLocations();

  const data: PublicLocation[] = locations
    .filter((location) => location.isActive)
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, "es");
    })
    .map((location) => ({
      id: location.id,
      name: location.name,
      addressLine: location.addressLine,
      city: location.city,
      addressReference: location.addressReference,
      mapsUrl: location.mapsUrl,
      businessHours: location.businessHours,
      pickupLeadMinutes: location.pickupLeadMinutes,
      pickupMaxMinutes: location.pickupMaxMinutes,
      isAcceptingOrders: location.isAcceptingOrders,
      closedMessage: location.closedMessage,
    }));

  return { data };
}
