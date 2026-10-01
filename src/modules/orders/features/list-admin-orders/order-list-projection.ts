import type { OrderSource, OrderStatus } from "@/modules/orders/domain/order.types";
import type { OrderPaymentStatusValue } from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **`OrderListProjection`**: el contrato de lectura del listado de Pedidos.
 *
 * Es **mínima a propósito**. La bandeja sirve para **localizar** un pedido y decidir si hay que abrirlo;
 * todo lo que no haga falta para eso no viaja. Lo que quedó afuera, y por qué:
 *
 * - **items y modificadores**: son del detalle. Traerlos obligaba a multiplicar filas por pedido en cada
 *   lectura del listado (`A-61`) y con miles de pedidos la pantalla los bajaba todos.
 * - **el historial de estados**: el listado no dibuja la línea de tiempo. Lo único que necesita es
 *   `stageChangedAt`, que ya viene resuelto.
 * - **GPS** (`customerLat`/`customerLng`/`geoAccuracy`/`geoCapturedAt`): sólo lo lee el detalle, y sólo para
 *   delivery, que está fuera del MVP.
 * - **`orderLookupTokenHash`**: es el token con el que el cliente consulta su pedido. No tiene por qué
 *   viajar a una pantalla del panel, y menos en una lista.
 * - **los cobros crudos**: viaja la **proyección** de `payments` (`financialState`), que es lo que la
 *   pantalla muestra. La regla de qué es «pagado» vive en `payments` y no se reimplementa acá.
 */
export type OrderListFinancialState = {
  status: OrderPaymentStatusValue;
  paidAmount: number;
  outstandingAmount: number;
  unresolvedAmount: number;
  baseCurrencyCode: string;
};

export type OrderListProjection = {
  id: string;
  orderNumber: string;
  /** Canal por el que entró (`MENÚ`/`POS`); `null` en un pedido anterior a la columna (`D-015`). */
  source: OrderSource | null;
  customerName: string;
  customerWhatsapp: string;
  /** Nombre del local; `null` si el local ya no existe (el pedido no se rompe por eso). */
  locationName: string | null;
  pickupTime: string | null;
  pickupScheduled: boolean;
  status: OrderStatus;
  /** Cuándo empezó la etapa actual: lo que mide «hace cuánto está así». */
  stageChangedAt: string;
  total: number;
  /** La moneda congelada del pedido (`D-022`); `null` en un pedido legacy. */
  currencyCode: string | null;
  /** El estado financiero **de `payments`**, ya resuelto. Nunca se recalcula en la pantalla. */
  financialState: OrderListFinancialState;
};

/**
 * Los agregados de la cabecera, calculados **sobre el filtro completo**, no sobre la página.
 *
 * Es la diferencia que la spec subraya: «N pedidos · N activas · N pendientes de pago · N programadas» es
 * información sobre el **conjunto** que el usuario filtró. Calcularlos sobre la página visible haría que
 * cambiar de página cambiara los números, que es exactamente lo que un KPI no puede hacer.
 */
export type OrderListKpi = {
  total: number;
  /** Trabajo vivo: ni terminado ni cancelado (`ADMIN_ORDER_ACTIVE_STATUSES`). */
  active: number;
  /** `financialState.status != paid`: los `pending` **y** los `partial` (`D-020`). */
  pendingPayment: number;
  /** Retiro programado por el cliente (`pickupScheduled`). */
  scheduled: number;
};

export type OrderListMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type OrderListResult = {
  data: OrderListProjection[];
  meta: OrderListMeta;
  kpi: OrderListKpi;
};
