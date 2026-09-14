import type { ShiftRecord } from "@/modules/orders/domain/order.types";
import { ShiftError } from "@/modules/orders/domain/shift-errors";
import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import type { ShiftRepository } from "@/modules/orders/ports/shift-repository";

/**
 * Abre la caja del local.
 *
 * Es la operación que arranca el arqueo: a partir de acá, todos los cobros que entren cuentan para
 * este turno. El local tiene que existir y no puede haber otra caja abierta en él — esta última
 * regla también la aplica la base con un índice único parcial, así que dos terminales simultáneas no
 * pueden ganar las dos.
 */
export async function openShift(
  input: {
    locationId: string;
    userId: string;
    openingAmount?: number;
    notes?: string | null;
  },
  {
    shiftRepository,
    locationRepository,
  }: {
    shiftRepository: ShiftRepository;
    locationRepository: LocationRepository;
  },
) {
  const locationId = input.locationId?.trim();
  if (!locationId) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
      locationId: "Requerido",
    });
  }

  const openingAmount = input.openingAmount ?? 0;
  if (!Number.isFinite(openingAmount) || openingAmount < 0) {
    throw new ShiftError(422, "VALIDATION_ERROR", "Invalid payload", {
      openingAmount: "Tiene que ser 0 o más",
    });
  }

  const locations = await locationRepository.listLocations();
  if (!locations.some((location) => location.id === locationId)) {
    throw new ShiftError(404, "NOT_FOUND", "Location not found");
  }

  const shift = await shiftRepository.openShift({
    locationId,
    userId: input.userId,
    openingAmount,
    notes: input.notes ?? null,
  });

  return { data: shift };
}

export type { ShiftRecord };
