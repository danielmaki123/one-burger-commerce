import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { requirePosLocation } from "@/app/api/admin/pos/pos-route-helpers";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import { listPosOperationalOrders } from "@/modules/orders/features/list-pos-operational-orders/list-pos-operational-orders";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §8, §12) — la composición del **feed operacional del POS**.
 *
 * Vive acá y no en el `route.ts` porque el repo tiene un tope de 50 líneas por handler y porque el orden de
 * las tres decisiones es la parte que importa: **rol → alcance por sucursal → POS prendido en el local**
 * (`requirePosLocation`), y recién después la lectura. La autorización se aplica en el servidor; la pantalla
 * no filtra nada.
 *
 * La moneda base entra por el mismo borde que el catálogo (`readProductionMoney`): el estado financiero se
 * expresa en la moneda que `money` define, no en una que la pantalla suponga.
 */
export async function loadPosOperationalFeed(input: {
  role: AdminRole;
  assignedLocationIds?: readonly string[] | null;
  requestedLocationId: string;
}) {
  const locationId = await requirePosLocation({
    role: input.role,
    assignedLocationIds: input.assignedLocationIds,
    requested: input.requestedLocationId,
  });

  const money = await readProductionMoney();

  return listPosOperationalOrders(
    { locationId, baseCurrencyCode: money.context.baseCurrencyCode },
    {
      repository: new PrismaOrderRepository(),
      locationRepository: new PrismaLocationRepository(),
    },
  );
}
