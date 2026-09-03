import type { Decimal } from "@prisma/client/runtime/library";

import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { DeliveryZoneRecord } from "@/modules/orders/domain/order.types";
import type {
  CreateDeliveryZoneInput,
  DeliveryZoneRepository,
  UpdateDeliveryZoneInput,
} from "@/modules/orders/ports/delivery-zone-repository";

function decimalToNumber(d: Decimal): number {
  return Number(d.toString());
}

function mapDeliveryZone(zone: {
  id: string;
  name: string;
  description: string | null;
  baseFee: Decimal;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): DeliveryZoneRecord {
  return {
    id: zone.id,
    name: zone.name,
    description: zone.description,
    baseFee: decimalToNumber(zone.baseFee),
    isActive: zone.isActive,
    sortOrder: zone.sortOrder,
    createdAt: zone.createdAt.toISOString(),
    updatedAt: zone.updatedAt.toISOString(),
  };
}

export class PrismaDeliveryZoneRepository implements DeliveryZoneRepository {
  async listDeliveryZones(): Promise<DeliveryZoneRecord[]> {
    const prisma = getPrismaClient();
    const zones = await prisma.deliveryZone.findMany({
      orderBy: { sortOrder: "asc" },
    });
    return zones.map(mapDeliveryZone);
  }

  async getDeliveryZoneById(id: string): Promise<DeliveryZoneRecord | null> {
    const prisma = getPrismaClient();
    const zone = await prisma.deliveryZone.findUnique({ where: { id } });
    return zone ? mapDeliveryZone(zone) : null;
  }

  async findDeliveryZoneByNameCaseInsensitive(name: string): Promise<DeliveryZoneRecord | null> {
    const prisma = getPrismaClient();
    const zone = await prisma.deliveryZone.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: "insensitive",
        },
      },
    });
    return zone ? mapDeliveryZone(zone) : null;
  }

  async createDeliveryZone(input: CreateDeliveryZoneInput): Promise<DeliveryZoneRecord> {
    const prisma = getPrismaClient();
    const zone = await prisma.deliveryZone.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        baseFee: input.baseFee,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });
    return mapDeliveryZone(zone);
  }

  async updateDeliveryZone(id: string, input: UpdateDeliveryZoneInput): Promise<DeliveryZoneRecord> {
    const prisma = getPrismaClient();
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.baseFee !== undefined) data.baseFee = input.baseFee;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

    const zone = await prisma.deliveryZone.update({
      where: { id },
      data,
    });
    return mapDeliveryZone(zone);
  }
}
