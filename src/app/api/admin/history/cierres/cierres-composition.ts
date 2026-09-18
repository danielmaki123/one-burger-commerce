import { assertCanViewHistory, resolveHistoryLocationIds } from "@/app/api/admin/invoices/invoice-route-helpers";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { PrismaAdminAuthRepository } from "@/modules/auth/adapters/prisma-admin-auth-repository";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";
import { listHistoryShifts } from "@/modules/orders/features/shift/list-history-shifts/list-history-shifts";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";

/**
 * Punto 2 del roadmap (2026-09-18) — la composición de los cierres del Historial.
 *
 * La ruta tiene un tope de 50 líneas y solo orquesta; acá se resuelve el permiso de la sección, las
 * sucursales del alcance y el caso de uso que arma la lista. Se usa el repositorio de turnos de la caja
 * (el arqueo es el mismo dato) y el de usuarios para ponerle **nombre** al cajero.
 */
export async function loadHistoryShifts(input: {
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  query: URLSearchParams;
}) {
  assertCanViewHistory(input.role);

  const locationIds =
    resolveHistoryLocationIds({
      role: input.role,
      assignedLocationIds: input.assignedLocationIds,
      requestedLocationId: input.query.get("locationId"),
    }) ?? null;

  const allLocations = await createProductionPosLocationDependencies().repository.listLocations();
  const locations = (locationIds
    ? allLocations.filter((location) => locationIds.includes(location.id))
    : allLocations
  ).map((location) => ({ id: location.id, name: location.name }));

  const shifts = await listHistoryShifts(
    {
      locations,
      closedFrom: input.query.get("dateFrom"),
      closedTo: input.query.get("dateTo"),
      cashierUserId: input.query.get("cashierUserId"),
      onlyDifference: input.query.get("onlyDifference") === "1",
    },
    {
      shiftRepository: new PrismaShiftRepository(),
      userRepository: new PrismaAdminAuthRepository(),
    },
  );

  return { shifts, locationIds };
}
