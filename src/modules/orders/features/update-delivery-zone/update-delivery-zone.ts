import { OrderError } from "@/modules/orders/domain/order-errors";
import type { DeliveryZoneRecord } from "@/modules/orders/domain/order.types";
import type { DeliveryZoneRepository } from "@/modules/orders/ports/delivery-zone-repository";

type UpdateDeliveryZoneInput = {
  name?: string;
  description?: string | null;
  baseFee?: number;
  isActive?: boolean;
  sortOrder?: number;
};

type UpdateDeliveryZoneDependencies = {
  repository: DeliveryZoneRepository;
};

export async function updateDeliveryZone(
  id: string,
  input: UpdateDeliveryZoneInput,
  { repository }: UpdateDeliveryZoneDependencies,
): Promise<{ data: DeliveryZoneRecord; meta: { updatedAt: string } }> {
  const existing = await repository.getDeliveryZoneById(id);
  if (!existing) {
    throw new OrderError(404, "NOT_FOUND", "Delivery zone not found");
  }

  if (input.name !== undefined && input.name.trim().length === 0) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { name: "Required" });
  }

  if (input.baseFee !== undefined) {
    if (typeof input.baseFee !== "number" || Number.isNaN(input.baseFee)) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload", { baseFee: "Required" });
    }
    if (input.baseFee < 0) {
      throw new OrderError(422, "VALIDATION_ERROR", "baseFee must be >= 0", {
        baseFee: "Must be >= 0",
      });
    }
  }

  if (input.name !== undefined) {
    const normalizedName = input.name.trim();
    const duplicate = await repository.findDeliveryZoneByNameCaseInsensitive(normalizedName);
    if (duplicate && duplicate.id !== id) {
      throw new OrderError(409, "CONFLICT", "A delivery zone with this name already exists", {
        name: "Already in use",
      });
    }
  }

  const zone = await repository.updateDeliveryZone(id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.baseFee !== undefined ? { baseFee: input.baseFee } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  });

  return {
    data: zone,
    meta: { updatedAt: new Date().toISOString() },
  };
}
