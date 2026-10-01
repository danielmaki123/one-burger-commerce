import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import {
  POS_OPERATIONAL_FEED_STATUSES,
  countPosOperationalSummary,
  type PosOperationalOrder,
} from "@/modules/orders/domain/pos-operational-orders";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import { getOrderPaymentStatus } from "@/modules/payments/features/get-order-payment-status/get-order-payment-status";

import {
  projectPosOperationalOrder,
  sortPosOperationalOrders,
  type PosOperationalFinancialProjection,
} from "./pos-operational-orders-projection";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §8, §9, §10, §12) — **el feed operacional del POS y su resumen**.
 *
 * Es la tercera pregunta del sistema de pedidos: ni «¿qué le vendo a este cliente?» (venta rápida) ni «¿qué
 * pedido quiero buscar y auditar?» (Pedidos), sino **«¿qué necesita hacer el cajero ahora en este local?»**.
 *
 * Lo que este caso de uso decide, y por qué acá:
 *
 * 1. **El resumen lo produce el servidor.** Los cuatro KPI se calculan sobre el feed operacional **completo**
 *    del local, no sobre las filas que la pantalla tiene dibujadas y no con cuatro requests agregados en
 *    React (brief §10). Un KPI que dependiera del viewport no sería un KPI.
 * 2. **El scope por sucursal se aplica en la lectura.** El local lo resuelve el borde (`requirePosLocation`:
 *    rol → alcance → POS prendido) y se pasa acá como filtro; esta capa **no** decide permisos, pero
 *    tampoco devuelve un pedido fuera del alcance que se le pidió.
 * 3. **El estado financiero lo resuelve `payments`** (`getOrderPaymentStatus`), que es su dueño. Acá no se
 *    suma un solo `amount`: el número que se devuelve es el que produjo la proyección.
 * 4. **El feed no trae historia.** Sólo los estados vivos (`POS_OPERATIONAL_FEED_STATUSES`): lo terminal y
 *    lo cancelado no tienen acción para el cajero y no se descargan para descartarlos después.
 * 5. **El orden es del feed, no del SQL.** Los programados van primero por hora prometida y el resto por
 *    «hace cuánto en esta etapa»; el `orderBy` de la lectura es una comodidad, no el contrato.
 */

export type ListPosOperationalOrdersInput = {
  /** El local ya resuelto y autorizado por el borde. Es el alcance del feed. */
  locationId: string;
  /** La moneda base vigente, resuelta por el borde con `money`. */
  baseCurrencyCode: string;
};

export type ListPosOperationalOrdersDependencies = {
  repository: OrderRepository;
  locationRepository: LocationRepository;
  /**
   * La resolución del estado financiero. Se inyecta para que el doble del test no pueda mentir sobre la
   * regla que se está probando: el test **no** reusa `projectOrderPaymentStatus` para su `expected`.
   */
  resolveFinancialState?: (
    orderId: string,
  ) => Promise<PosOperationalFinancialProjection>;
};

export async function listPosOperationalOrders(
  input: ListPosOperationalOrdersInput,
  {
    repository,
    locationRepository,
    resolveFinancialState,
  }: ListPosOperationalOrdersDependencies,
): Promise<{ orders: PosOperationalOrder[]; summary: ReturnType<typeof countPosOperationalSummary> }> {
  const rows = await repository.listAdminOrderRows({
    statuses: [...POS_OPERATIONAL_FEED_STATUSES],
    excludeStatuses: ["cancelled"],
    locationIds: [input.locationId],
  });

  const location = await locationRepository.findLocationById(input.locationId);
  const locationName = location?.name ?? null;

  const resolveState =
    resolveFinancialState ??
    (async (orderId: string) => {
      const row = rows.find((candidate) => candidate.id === orderId);

      return getOrderPaymentStatus({
        orderId,
        total: row?.total ?? 0,
        baseCurrencyCode: input.baseCurrencyCode,
        payments: (row?.payments ?? []).map((payment) => ({
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          baseCurrencyCode: payment.baseCurrencyCode,
          exchangeRate: payment.exchangeRate,
          baseAmount: payment.baseAmount,
          method: payment.method,
          createdAt: payment.createdAt,
          voidedAt: payment.voidedAt,
        })),
      });
    });

  const stageChangedAtById = new Map(rows.map((row) => [row.id, row.stageChangedAt]));
  const orders: PosOperationalOrder[] = [];

  for (const row of rows) {
    orders.push(
      projectPosOperationalOrder({
        row,
        locationName,
        baseCurrencyCode: input.baseCurrencyCode,
        financial: await resolveState(row.id),
      }),
    );
  }

  const sorted = sortPosOperationalOrders(orders, stageChangedAtById);

  return {
    orders: sorted,
    summary: countPosOperationalSummary(
      sorted.map((order) => ({
        status: order.status,
        pickupScheduled: order.pickupScheduled,
        pickupTime: order.pickupTime,
        financialStatus: order.financialState.status,
        unresolvedAmount: order.financialState.unresolvedAmount,
      })),
    ),
  };
}
