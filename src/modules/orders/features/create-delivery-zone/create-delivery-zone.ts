import { OrderError } from "@/modules/orders/domain/order-errors";
import type { DeliveryZoneRecord } from "@/modules/orders/domain/order.types";
import type { DeliveryZoneRepository } from "@/modules/orders/ports/delivery-zone-repository";

type CreateDeliveryZoneInput = {
  name: string;
  description?: string | null;
  baseFee: number;
  isActive?: boolean;
  sortOrder?: number;
};

type CreateDeliveryZoneDependencies = {
  repository: DeliveryZoneRepository;
};

export async function createDeliveryZone(
  input: CreateDeliveryZoneInput,
  { repository }: CreateDeliveryZoneDependencies,
): Promise<{ data: DeliveryZoneRecord; meta: { updatedAt: string } }> {
  if (!input.name || input.name.trim().length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (typeof input.baseFee !== "number" || Number.isNaN(input.baseFee)) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { baseFee: "Required" });
  }

  if (input.baseFee < 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "baseFee must be >= 0", {
      baseFee: "Must be >= 0",
    });
  }

  const normalizedName = input.name.trim();
  const existing = await repository.findDeliveryZoneByNameCaseInsensitive(normalizedName);
  if (existing) {
    throw new OrderError(409, "CONFLICT", "A delivery zone with this name already exists", {
      name: "Already in use",
    });
  }

  const zone = await repository.createDeliveryZone({
    name: normalizedName,
    description: input.description ?? null,
    baseFee: input.baseFee,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
  });

  return {
    data: zone,
    meta: { updatedAt: new Date().toISOString() },
  };
}
