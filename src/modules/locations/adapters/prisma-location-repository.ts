import type { Location as PrismaLocation } from "@prisma/client";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { readBusinessHours } from "@/modules/business-settings/domain/business-hours";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";

/**
 * Locales en Postgres (T8).
 *
 * `businessHours` es JSON: se normaliza día por día con el mismo lector que usa la
 * configuración del negocio, porque el JSON guardado nunca se confía.
 */
function mapLocation(row: PrismaLocation): LocationRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    addressLine: row.addressLine,
    city: row.city,
    addressReference: row.addressReference,
    mapsUrl: row.mapsUrl,
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    whatsapp: row.whatsapp,
    businessHours: readBusinessHours(row.businessHours),
    pickupLeadMinutes: row.pickupLeadMinutes,
    pickupMaxMinutes: row.pickupMaxMinutes,
    isAcceptingOrders: row.isAcceptingOrders,
    closedMessage: row.closedMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaLocationRepository implements LocationRepository {
  async listLocations(): Promise<LocationRecord[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.location.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return rows.map(mapLocation);
  }
}
