import type {
  OrderSource,
  OrderStatus,
  OrderType,
} from "@/modules/orders/domain/order.types";

/**
 * `KitchenOrderProjection` — el contrato de lectura de **Cocina**.
 *
 * Es la frontera de autorización de la superficie: **no tiene un solo campo de dinero**. No es que la
 * pantalla elija no mostrarlo —eso no sería autorización, es una UI—: el campo **no existe** en el tipo,
 * así que no puede viajar en la respuesta de la API ni con React manipulado.
 *
 * Lo que **nunca** entra acá, y su dueño: `subtotal`, `discount`, `packagingAmount`, `deliveryFeeAmount`,
 * `tipAmount`, `tipRate`, `total`, `paidWithAmount`, `pickupPin`, `paymentMethod`, `orderLookupTokenHash`,
 * `payments[]`, la factura y el saldo (`pending`/`partial`/`paid`, que es de `payments`).
 *
 * Lo que sí entra es lo que la cocina necesita para cocinar: qué pedido es, de dónde vino, para cuándo,
 * qué hay que preparar y desde cuándo espera.
 */

/** Un renglón de la comanda: qué cocinar, con sus modificadores y su nota. Sin precio. */
export type KitchenOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  notes: string | null;
  modifiers: Array<{ id: string; name: string }>;
};

/**
 * Lo que la comanda necesita saber del local: dónde se cocina y cuánto antes del retiro hay que arrancar.
 *
 * `name`/`pickupLeadMinutes` son `null` cuando el local no se puede resolver (borrado, o un id viejo): la
 * comanda sigue apareciendo —es trabajo real en el fuego— pero sin nombre ni inicio recomendado, en vez
 * de romper el tablero.
 */
export type KitchenLocationInfo = {
  id: string;
  name: string | null;
  /** `Location.pickupLeadMinutes`: la autoridad por local del inicio recomendado. */
  pickupLeadMinutes: number | null;
};

export type KitchenOrderProjection = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  /** Canal de origen. `null` = **no declarado**: la tarjeta sale sin etiqueta, nunca con una adivinada. */
  source: OrderSource | null;
  customerName: string;
  location: KitchenLocationInfo;
  createdAt: string;
  /** Cuándo empezó la etapa actual (`OrderStatusHistory`): es lo que mide la urgencia. */
  stageChangedAt: string;
  /** Cuándo empezó a prepararse. `null` = todavía nadie lo empezó («espera inicio», sin cronómetro). */
  preparingAt: string | null;
  /** Cuándo quedó listo. `null` = todavía no. */
  readyAt: string | null;
  /** Hora prometida del retiro. `null` = «lo antes posible» (venta de mostrador). */
  pickupTime: string | null;
  /** Si el cliente la eligió, o la puso el servidor para «lo antes posible». */
  pickupScheduled: boolean;
  items: KitchenOrderItem[];
};

/**
 * El resumen del turno que la cabecera de Cocina muestra.
 *
 * Sale del **servidor** y en una sola pasada: la pantalla no puede pedir el historial de cada pedido para
 * sacar un promedio. `averagePrepMinutes` y `longestPrepMinutes` son `null` —no `0`— cuando todavía no hay
 * ninguna preparación medida: 0 min se leería como una cocina instantánea.
 */
export type KitchenBoardSummary = {
  averagePrepMinutes: number | null;
  longestPrepMinutes: number | null;
  /** El umbral de **cocina** del local con el que se mide el atraso. Es el «objetivo» de la cabecera. */
  prepTargetMinutes: number;
  /**
   * El umbral de la **entrada** del local (`acceptAlertMinutes`): cuánto puede esperar una comanda que
   * nadie tomó. Viaja por el mismo motivo que el de cocina —la pantalla no reimplementa el umbral del
   * local— y porque el carril de entrada incluye `confirmed` (A-64): un pedido aceptado y sin empezar
   * sigue midiéndose con el umbral de aceptación, no con el del fuego.
   */
  acceptTargetMinutes: number;
};

export type KitchenOrdersResult = {
  data: KitchenOrderProjection[];
  meta: {
    count: number;
    /** `null`/ausente = el usuario ve todos los locales. Lo usa la pantalla para el contexto del turno. */
    locationScope: string[] | null;
    summary: KitchenBoardSummary;
  };
};
