import type { LocationRepository } from "@/modules/locations/ports/location-repository";
import {
  POS_OPERATIONAL_FEED_STATUSES,
  countPosOperationalSummary,
  isPosOperationalScheduled,
  type PosOperationalOrder,
} from "@/modules/orders/domain/pos-operational-orders";
import type { AdminOrderRow, OrderRepository } from "@/modules/orders/ports/order-repository";
import type { OrderPaymentStatus } from "@/modules/payments/domain/order-financial-status";
import { getOrderPaymentStatus } from "@/modules/payments/features/get-order-payment-status/get-order-payment-status";

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
 *
 * La **proyección** (`projectPosOperationalOrder`) vive en este archivo y no en uno aparte: es la traducción de
 * una fila leída al contrato del POS, no una responsabilidad con su propia razón de ser, y el repo exige que
 * un caso de uso tenga su test hermano —un archivo de proyección sin test propio sería deuda nueva—.
 */

/**
 * `PosOperationalOrdersProjection` — la proyección mínima de `orders` orientada al cajero.
 *
 * Es la traducción de una fila leída (`AdminOrderRow`, la misma fila mínima que usa el listado administrativo)
 * al contrato del POS. Reutiliza la lectura y **no** la reconstruye: lo que cambia es qué se proyecta y con
 * qué pregunta.
 *
 * Lo que esta proyección **no** deja pasar, a propósito (brief §11): items, modificadores, historial completo,
 * facturas, GPS, tokens de seguimiento, devoluciones y cualquier campo administrativo que el cajero no use
 * para decidir su próxima acción. Tampoco el WhatsApp del cliente: no está en el contrato del POS y el panel
 * no lo dibuja.
 */

/** El estado financiero que `payments` produjo, reducido a los cuatro números que el POS muestra. */
export type PosOperationalFinancialProjection = Pick<
  OrderPaymentStatus,
  "status" | "paidAmount" | "outstandingAmount" | "unresolvedAmount"
>;

export type PosOperationalProjectionInput = {
  row: AdminOrderRow;
  locationName: string | null;
  /** La moneda base vigente, resuelta por el borde con `money`. */
  baseCurrencyCode: string;
  financial: PosOperationalFinancialProjection;
};

export function projectPosOperationalOrder(
  input: PosOperationalProjectionInput,
): PosOperationalOrder {
  const { row, financial } = input;

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    source: row.source ?? null,
    customerName: row.customerName,
    locationId: row.locationId,
    locationName: input.locationName,
    status: row.status,
    pickupTime: row.pickupTime,
    pickupScheduled: row.pickupScheduled,
    currencyCode: row.currencyCode,
    total: row.total,
    financialState: {
      status: financial.status,
      paidAmount: financial.paidAmount,
      outstandingAmount: financial.outstandingAmount,
      unresolvedAmount: financial.unresolvedAmount,
      // Una fila legacy sin moneda de pedido se informa con la base vigente: es la moneda en la que
      // `payments` expresó el estado, y cambiar la base no reinterpreta ningún cobro (`D-018`).
      baseCurrencyCode: input.baseCurrencyCode,
    },
  };
}

/**
 * El orden del feed: **los programados primero, por hora prometida**, y el resto por «hace cuánto está en
 * esta etapa», con lo más reciente arriba.
 *
 * Por qué no se ordena todo por `pickupTime`: un pedido sin programar puede tener una `pickupTime` que el
 * servidor calculó para que Cocina sepa cuándo arrancar (brief §6), así que ordenar por esa hora mezclaría
 * compromisos del cliente con estimaciones del sistema. Los programados son los únicos con una promesa que el
 * cajero tiene que respetar en un orden concreto.
 */
export function sortPosOperationalOrders(
  orders: readonly PosOperationalOrder[],
  stageChangedAtById: ReadonlyMap<string, string>,
): PosOperationalOrder[] {
  return [...orders].sort((a, b) => {
    /**
     * Un programado **sin hora** no es un programado (`isPosOperationalScheduled`): no entra a la primera
     * banda ni se compara por una hora que no existe. Comparar `null` como `""` lo haría ganar el primer
     * lugar, que es exactamente el error que el test fija.
     */
    const aScheduled = isPosOperationalScheduled(a);
    const bScheduled = isPosOperationalScheduled(b);

    if (aScheduled && bScheduled) {
      const byPickup = (a.pickupTime ?? "").localeCompare(b.pickupTime ?? "");
      if (byPickup !== 0) return byPickup;
    } else if (aScheduled !== bScheduled) {
      return aScheduled ? -1 : 1;
    }

    const aStage = stageChangedAtById.get(a.id) ?? "";
    const bStage = stageChangedAtById.get(b.id) ?? "";

    return bStage.localeCompare(aStage);
  });
}

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
