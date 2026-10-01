import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import {
  ADMIN_ORDER_ACTIVE_STATUSES,
  isPendingPaymentState,
  matchesAdminOrderPaymentFilter,
  type AdminOrderPaymentFilter,
} from "@/modules/orders/domain/admin-order-filters";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import type { OrderPaymentStatus } from "@/modules/payments/domain/order-financial-status";
import { getOrderPaymentStatus } from "@/modules/payments/features/get-order-payment-status/get-order-payment-status";

import type {
  OrderListKpi,
  OrderListProjection,
  OrderListResult,
} from "./order-list-projection";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **el listado administrativo de pedidos**: paginado, filtrado y con sus KPI.
 *
 * Lo que este caso de uso decide, y por qué acá:
 *
 * 1. **Empuja el filtro a la lectura** (`listAdminOrderRows`): estados, ventana de fecha, sucursales del
 *    alcance, búsqueda y «programados» se resuelven en SQL. Lo que **no** se empuja es el filtro por estado
 *    de pago, porque no es un dato de `Order`: es una **proyección de `payments`** (`D-020`). Reescribir esa
 *    regla en SQL sería tener dos veces la misma regla de negocio.
 * 2. **Resuelve el estado financiero con `payments`** — `getOrderPaymentStatus`—, que es su dueño. Acá no
 *    se suma un solo `Payment.amount`: el estado que se devuelve es el que produjo la proyección.
 * 3. **Agrega antes de paginar**: los cuatro KPI se calculan sobre el conjunto ya filtrado y **después** se
 *    recorta la página. Al revés, los números de la cabecera cambiarían al pasar de página.
 * 4. **Proyecta lo mínimo**: sólo los campos de `OrderListProjection`. Lo que no está en ese tipo no sale.
 *
 * La moneda base entra por parámetro (la resuelve el borde con `readProductionMoney`, igual que la
 * factura): este caso de uso no lee configuración ni toca Prisma.
 */

/** Tamaño de página por defecto. La referencia aprobada muestra ~6 filas en escritorio; 25 deja margen. */
export const DEFAULT_ADMIN_ORDER_PAGE_SIZE = 25;

/** Techo del tamaño de página: una request no puede pedir la tabla entera «paginando». */
export const MAX_ADMIN_ORDER_PAGE_SIZE = 100;

export type ListAdminOrdersFilter = {
  /** Estados (los grupos del control). Vacío = todos. */
  statuses?: string[];
  dateFrom?: string;
  dateTo?: string;
  locationIds?: string[];
  search?: string;
  /** Sólo retiros programados. */
  scheduledOnly?: boolean;
  /** El filtro por estado de pago: se aplica **después** de resolver el estado financiero. */
  payment?: AdminOrderPaymentFilter;
  page?: number;
  pageSize?: number;
};

export type ListAdminOrdersDependencies = {
  repository: OrderRepository;
  locationRepository: LocationRepository;
  /** La moneda base vigente, resuelta por el borde (`money` es su dueño). */
  baseCurrencyCode: string;
  /**
   * La resolución del estado financiero. Se inyecta para que el doble del test no pueda mentir sobre la
   * regla que se está probando: el test no reusa `projectOrderPaymentStatus` para su `expected`.
   */
  resolveFinancialState?: (orderId: string) => Promise<{
    status: OrderPaymentStatus["status"];
    paidAmount: number;
    outstandingAmount: number;
    unresolvedAmount: number;
  }>;
};

/** Normaliza el número de página: una request no puede pedir la página 0 ni la -3. */
function normalizePage(value: number | undefined): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function normalizePageSize(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return DEFAULT_ADMIN_ORDER_PAGE_SIZE;
  }

  return Math.min(value, MAX_ADMIN_ORDER_PAGE_SIZE);
}

export async function listAdminOrders(
  filter: ListAdminOrdersFilter,
  {
    repository,
    locationRepository,
    baseCurrencyCode,
    resolveFinancialState,
  }: ListAdminOrdersDependencies,
): Promise<OrderListResult> {
  const page = normalizePage(filter.page);
  const pageSize = normalizePageSize(filter.pageSize);

  const rows = await repository.listAdminOrderRows({
    statuses: filter.statuses,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
    locationIds: filter.locationIds,
    search: filter.search,
    scheduledOnly: filter.scheduledOnly,
  });

  // Más recientes primero, igual que la referencia aprobada. El adaptador ya ordena, pero el orden es
  // parte del contrato de la proyección y no de un detalle de SQL.
  const ordered = [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // El nombre del local se resuelve **una sola vez** para toda la lista.
  const locations = await locationRepository.listLocations();
  const nameById = new Map(locations.map((location) => [location.id, location.name]));

  const resolveState =
    resolveFinancialState ??
    (async (orderId: string) => {
      const row = ordered.find((candidate) => candidate.id === orderId);
      const status = await getOrderPaymentStatus({
        orderId,
        total: row?.total ?? 0,
        baseCurrencyCode,
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

      return {
        status: status.status,
        paidAmount: status.paidAmount,
        outstandingAmount: status.outstandingAmount,
        unresolvedAmount: status.unresolvedAmount,
      };
    });

  const projected: OrderListProjection[] = [];

  for (const row of ordered) {
    const financial = await resolveState(row.id);

    if (
      !matchesAdminOrderPaymentFilter({
        filter: filter.payment ?? "all",
        state: financial.status,
      })
    ) {
      continue;
    }

    projected.push({
      id: row.id,
      orderNumber: row.orderNumber,
      source: row.source,
      customerName: row.customerName,
      customerWhatsapp: row.customerWhatsapp,
      locationName: nameById.get(row.locationId) ?? null,
      pickupTime: row.pickupTime,
      pickupScheduled: row.pickupScheduled,
      status: row.status,
      stageChangedAt: row.stageChangedAt,
      total: row.total,
      currencyCode: row.currencyCode,
      financialState: {
        status: financial.status,
        paidAmount: financial.paidAmount,
        outstandingAmount: financial.outstandingAmount,
        unresolvedAmount: financial.unresolvedAmount,
        // Una fila legacy sin moneda de pedido se informa con la base vigente: es la moneda en la que
        // `payments` expresó el estado, y cambiar la base no reinterpreta ningún cobro (`D-018`).
        baseCurrencyCode,
      },
    });
  }

  const kpi = projectKpi(projected);

  return {
    data: projected.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total: projected.length },
    kpi,
  };
}

/**
 * Los cuatro KPI del filtro completo. Se calculan sobre las filas **ya proyectadas** —es decir, sobre el
 * mismo conjunto que el usuario está viendo— para que la cabecera y la tabla no puedan discrepar.
 *
 * Se exporta porque es el contrato de los agregados: el listado los consume y los tests los fijan sin
 * tener que armar una request entera.
 */
export function projectKpi(orders: readonly OrderListProjection[]): OrderListKpi {
  let active = 0;
  let pendingPayment = 0;
  let scheduled = 0;

  for (const order of orders) {
    if ((ADMIN_ORDER_ACTIVE_STATUSES as readonly string[]).includes(order.status)) active += 1;
    if (isPendingPaymentState(order.financialState.status)) pendingPayment += 1;
    if (order.pickupScheduled) scheduled += 1;
  }

  return { total: orders.length, active, pendingPayment, scheduled };
}
