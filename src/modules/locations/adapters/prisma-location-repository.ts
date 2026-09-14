import type { Location as PrismaLocation, LocationProduct as PrismaLocationProduct, Prisma } from "@prisma/client";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import { readBusinessHours } from "@/modules/business-settings/domain/business-hours";
import type { LocationInput } from "@/modules/locations/domain/location-rules";
import type {
  LocationProductInput,
  LocationProductRecord,
  LocationRecord,
} from "@/modules/locations/domain/location.types";
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
    acceptAlertMinutes: row.acceptAlertMinutes,
    prepAlertMinutes: row.prepAlertMinutes,
    isAcceptingOrders: row.isAcceptingOrders,
    closedMessage: row.closedMessage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapLocationProduct(row: PrismaLocationProduct): LocationProductRecord {
  return {
    id: row.id,
    locationId: row.locationId,
    productId: row.productId,
    // El Decimal de la base se convierte a número: los precios del proyecto son números.
    priceOverride: row.priceOverride === null ? null : Number(row.priceOverride),
    isAvailable: row.isAvailable,
    isActive: row.isActive,
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

  async findLocationById(id: string): Promise<LocationRecord | null> {
    const prisma = getPrismaClient();
    const row = await prisma.location.findUnique({ where: { id } });

    return row ? mapLocation(row) : null;
  }

  async findLocationBySlug(slug: string): Promise<LocationRecord | null> {
    const prisma = getPrismaClient();
    const row = await prisma.location.findUnique({ where: { slug } });

    return row ? mapLocation(row) : null;
  }

  async createLocation(input: LocationInput): Promise<LocationRecord> {
    const prisma = getPrismaClient();
    const row = await prisma.location.create({
      data: { ...input, businessHours: input.businessHours as unknown as Prisma.InputJsonValue },
    });

    return mapLocation(row);
  }

  async updateLocation(id: string, input: LocationInput): Promise<LocationRecord> {
    const prisma = getPrismaClient();
    const row = await prisma.location.update({
      where: { id },
      data: { ...input, businessHours: input.businessHours as unknown as Prisma.InputJsonValue },
    });

    return mapLocation(row);
  }

  async deleteLocation(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.location.delete({ where: { id } });
  }

  // Catálogo por local (fase 4).
  async listLocationProducts(locationId: string): Promise<LocationProductRecord[]> {
    const prisma = getPrismaClient();
    const rows = await prisma.locationProduct.findMany({
      where: { locationId },
      orderBy: { productId: "asc" },
    });

    return rows.map(mapLocationProduct);
  }

  async findLocationProduct(
    locationId: string,
    productId: string,
  ): Promise<LocationProductRecord | null> {
    const prisma = getPrismaClient();
    const row = await prisma.locationProduct.findUnique({
      where: { locationId_productId: { locationId, productId } },
    });

    return row ? mapLocationProduct(row) : null;
  }

  async upsertLocationProduct(
    input: LocationProductInput & { locationId: string; productId: string },
  ): Promise<LocationProductRecord> {
    const prisma = getPrismaClient();
    const row = await prisma.locationProduct.upsert({
      where: { locationId_productId: { locationId: input.locationId, productId: input.productId } },
      create: input,
      update: input,
    });

    return mapLocationProduct(row);
  }

  async deleteLocationProduct(locationId: string, productId: string): Promise<void> {
    const prisma = getPrismaClient();
    // Si no existe la fila no hay nada que borrar: el producto ya está al precio base.
    await prisma.locationProduct.deleteMany({ where: { locationId, productId } });
  }
}
