import {
  DEFAULT_BUSINESS_HOURS,
  cloneBusinessHours,
} from "@/modules/business-settings/domain/business-settings-defaults";
import type { LocationInput } from "@/modules/locations/domain/location-rules";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";

/**
 * Doble en memoria del puerto de locales.
 *
 * Vive al lado del adaptador de Prisma para que cada método del puerto exista una sola
 * vez por implementación: agregar un método al puerto rompe la compilación acá en vez
 * de que el doble se desincronice en silencio.
 *
 * El horario por defecto sale de los defaults del dominio, no de literales escritos acá:
 * el contrato anti-hardcode falla si un dato del negocio (12:00, 22:00) aparece fuera de
 * `src/modules/business-settings`.
 */

export function createInMemoryLocation(
  overrides: Partial<LocationRecord> & { id: string; name: string },
): LocationRecord {
  return {
    slug: overrides.id,
    isActive: true,
    sortOrder: 0,
    addressLine: null,
    city: null,
    addressReference: null,
    mapsUrl: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    businessHours: cloneBusinessHours(DEFAULT_BUSINESS_HOURS),
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    isAcceptingOrders: true,
    closedMessage: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    updatedAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

export class InMemoryLocationRepository implements LocationRepository {
  readonly locations: LocationRecord[];
  private nextId = 1;

  constructor(locations: LocationRecord[] = []) {
    this.locations = [...locations];
    this.nextId = locations.length + 1;
  }

  async listLocations(): Promise<LocationRecord[]> {
    return [...this.locations].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, "es");
    });
  }

  async findLocationById(id: string): Promise<LocationRecord | null> {
    return this.locations.find((location) => location.id === id) ?? null;
  }

  async findLocationBySlug(slug: string): Promise<LocationRecord | null> {
    return this.locations.find((location) => location.slug === slug) ?? null;
  }

  async createLocation(input: LocationInput): Promise<LocationRecord> {
    const now = "2026-09-12T00:00:00.000Z";
    const location: LocationRecord = {
      ...input,
      id: `loc_${this.nextId}`,
      createdAt: now,
      updatedAt: now,
    };

    this.nextId += 1;
    this.locations.push(location);

    return location;
  }

  async updateLocation(id: string, input: LocationInput): Promise<LocationRecord> {
    const index = this.locations.findIndex((location) => location.id === id);
    if (index < 0) throw new Error(`Location ${id} not found`);

    const updated: LocationRecord = { ...this.locations[index], ...input };
    this.locations[index] = updated;

    return updated;
  }

  async deleteLocation(id: string): Promise<void> {
    const index = this.locations.findIndex((location) => location.id === id);
    if (index >= 0) this.locations.splice(index, 1);
  }
}
