import type {
  CouponRecord,
  DeliveryFeeStatus,
  DeliveryZoneRecord,
  OrderPaymentMethod,
  OrderRecord,
  OrderSource,
  OrderStatus,
  OrderStatusHistoryRecord,
  OrderType,
  TableRecord,
} from "@/modules/orders/domain/order.types";

export type OrderItemInput = {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
  notes?: string | null;
};

/**
 * Un pedido leído para la **cola de trabajo**, con los sellos de sus etapas.
 *
 * No van en `OrderRecord` porque sólo la lectura de la lista los resuelve —y los resuelve para todos los
 * pedidos de una sola consulta—: la urgencia de la comanda se mide dentro de la etapa (aceptado hace
 * 20 minutos y en preparación hace 2 no está atrasado), y con `updatedAt` mentiría, porque también
 * cambia cuando alguien edita el pedido por otro motivo. Sin historial, la etapa empezó con el pedido.
 *
 * `TASK-ORDERS-KITCHEN-RUNTIME-002` agregó **`preparingAt`**: es el sello con el que se mide la
 * preparación real (`preparingAt → readyAt`). Un pedido que nadie empezó a preparar no tiene sello y la
 * pantalla lo dice («espera inicio»), en vez de contar el tiempo desde que entró el pedido.
 */
export type OrderQueueRecord = OrderRecord & {
  stageChangedAt: string;
  /** Cuándo quedó listo (`null` si todavía no lo estuvo). */
  readyAt: string | null;
  /** Cuándo empezó la preparación (`null` si nunca se empezó). Es la base del `PREP N m` de Cocina. */
  preparingAt: string | null;
};

/** Datos editables de una promo (T9c). El `id` y el uso acumulado los maneja el repositorio. */
export type CouponInput = {
  code: string;
  type: CouponRecord["type"];
  value: number;
  isActive: boolean;
  usageLimit: number;
  expiresAt: string | null;
  buyQuantity?: number | null;
  freeQuantity?: number | null;
  scopeType?: string | null;
  scopeId?: string | null;
};

export type CreateOrderInput = {
  type: "delivery" | "pickup" | "table";
  /** Local al que va el pedido (T8); el caso de uso lo resuelve antes de guardar. */
  locationId: string;
  /**
   * `TASK-ORDERS-KITCHEN-RUNTIME-002` — canal de origen, **declarado por la puerta de creación**: el
   * menú público manda `menu` y la venta del mostrador manda `pos`. Sin valor queda `null` (no
   * declarado) y **no** se completa con ninguna heurística.
   */
  source?: OrderSource | null;
  customerName: string;
  customerWhatsapp: string;
  /** TASK-303b — correo del cliente (opcional; hoy lo pide el POS, no el checkout). */
  customerEmail?: string | null;
  customerId?: string | null;
  items: OrderItemInput[];
  couponCode?: string | null;
  address?: string | null;
  deliveryNotes?: string | null;
  deliveryFeeStatus?: DeliveryFeeStatus | null;
  tipOptIn?: boolean;
  pickupTime?: Date | null;
  /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  /** Forma de pago declarada por el cliente (T11). */
  paymentMethod?: OrderPaymentMethod | null;
  /** Con cuánto paga el cliente cuando es efectivo (T12). */
  paidWithAmount?: number | null;
  /** PIN corto para dictar en caja (T13). */
  pickupPin?: string | null;
  tableId?: string | null;
  deliveryZoneId?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: Date | null;
  orderLookupTokenHash?: string | null;
  /**
   * TASK-101 — clave de operación del cliente. La guarda el adaptador en la misma escritura del
   * pedido; su índice único es lo que hace que dos altas simultáneas con la misma clave no
   * terminen en dos pedidos.
   */
  idempotencyKey?: string | null;
};

export type ListOrdersFilter = {
  type?: string;
  status?: string;
  /**
   * `TASK-ORDERS-KITCHEN-RUNTIME-002` — varios estados a la vez. La cola de Cocina mira **los cuatro**
   * estados del tablero (`new`, `confirmed`, `preparing`, `ready_for_pickup`) en **una** consulta: pedir
   * el turno entero y descartar en memoria sería traer de más.
   */
  statusIn?: string[];
  dateFrom?: string;
  dateTo?: string;
  /**
   * Sucursales del pedido. Una lista **vacía o ausente significa "todas"**: es lo que usa el
   * `owner` y el usuario sin asignar. Viene de la capa de composición, que resuelve el alcance
   * del usuario (`resolveOrderListLocationIds`).
   */
  locationIds?: string[];
  /**
   * B4 — búsqueda por número, nombre, WhatsApp o PIN. La regla está en `domain/order-search.ts`:
   * el adaptador de Prisma la traduce a SQL y el de memoria la aplica igual.
   */
  search?: string;
  /** B4 — forma de pago declarada por el cliente, para la caja. */
  paymentMethod?: OrderPaymentMethod;
};

/**
 * `TASK-ORDERS-RUNTIME-5B` — la fila **mínima** del listado administrativo de pedidos.
 *
 * Existe porque la bandeja de Pedidos no necesita el pedido para dibujar una comanda: necesita
 * identificarlo, ubicarlo y decir cómo viene de plata. Traer `items` + `modifiers` + el historial completo
 * de cada fila —lo que hacía `listOrders`— era la causa del `A-61` (proyección excesiva) y lo que impedía
 * paginar.
 *
 * **Sin un solo campo de dinero crudo**: el estado financiero se resuelve en el caso de uso con la
 * proyección de `payments`, que es su dueño. Acá sólo viaja el resumen de los cobros para que esa
 * proyección pueda sumar (`baseAmount`, `unresolvedAmount`).
 *
 * No incluye `orderLookupTokenHash`, ni GPS, ni items, ni historial: si un campo no lo dibuja el listado ni
 * decide su filtro, no sale de la base.
 */
export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  source: OrderSource | null;
  status: OrderStatus;
  type: OrderType;
  customerName: string;
  customerWhatsapp: string;
  locationId: string;
  pickupTime: string | null;
  pickupScheduled: boolean;
  total: number;
  /** La moneda en la que está expresado `total`; `null` en los pedidos legacy (`D-022`). */
  currencyCode: string | null;
  /** El último cambio de estado, o la creación: lo que mide «hace cuánto en esta etapa». */
  stageChangedAt: string;
  createdAt: string;
  /** Los cobros **de este pedido**, en la misma consulta. La regla de qué es «pagado» es de `payments`. */
  payments: Array<{
    id: string;
    amount: number;
    currency: string | null;
    baseCurrencyCode: string | null;
    exchangeRate: number | null;
    baseAmount: number | null;
    method: string;
    createdAt: string;
    voidedAt: string | null;
  }>;
};

export type AdminOrderRowFilter = {
  /** Varios estados a la vez (los grupos del control de estado). Vacío = todos. */
  statuses?: string[];
  /** Ventana de creación del pedido, ya resuelta en la zona del negocio. */
  dateFrom?: string;
  dateTo?: string;
  /** Sucursales del alcance del usuario. Vacío o ausente = todas. */
  locationIds?: string[];
  search?: string;
  /** Sólo los programados (`pickupScheduled`). Sin valor, no filtra. */
  scheduledOnly?: boolean;
};

export interface OrderRepository {
  createOrder(
    input: CreateOrderInput & {
      orderNumber: string;
      subtotal: number;
      discount: number;
      packagingAmount: number;
      deliveryFeeAmount: number;
      tipAmount: number;
      tipRate?: number | null;
      total: number;
      /**
       * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-89`) — la moneda en la que están expresados los
       * montos de esta alta. `null` sólo en los pedidos anteriores a la columna (legacy, no demostrables):
       * **toda alta nueva la escribe**.
       */
      currencyCode?: string | null;
      status: string;
    },
    itemDetails: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      packagingUnitAmount: number;
      packagingQuantity: number;
      packagingTotalAmount: number;
      notes: string | null;
      lineTotal: number;
      modifiers: Array<{
        modifierOptionId: string;
        name: string;
        priceDelta: number;
      }>;
    }>,
  ): Promise<OrderRecord>;

  findOrderById(id: string): Promise<OrderRecord | null>;
  findOrderByOrderNumber(orderNumber: string): Promise<OrderRecord | null>;
  /**
   * TASK-101 — el pedido que ya se creó con esa clave de operación, o `null`. Es lo que convierte
   * un reintento del mismo request en el **mismo** pedido en vez de en otro.
   */
  findOrderByIdempotencyKey(idempotencyKey: string): Promise<OrderRecord | null>;

  listOrders(filter: ListOrdersFilter): Promise<OrderQueueRecord[]>;

  /**
   * `TASK-ORDERS-RUNTIME-5B` — las filas **mínimas** del listado administrativo, ya filtradas.
   *
   * Devuelve el filtro **completo** (no una página): el caso de uso resuelve el estado financiero de cada
   * fila con la proyección de `payments`, aplica el filtro por estado de pago —que no existe en `Order`—,
   * calcula los KPI sobre ese conjunto y **después** recorta la página. Empujar ese filtro a SQL obligaría
   * a reescribir la regla de `D-020` en SQL, que es exactamente lo que la ley de *Single Owner* prohíbe.
   *
   * El orden es por `createdAt` descendente (lo más reciente primero), igual que la referencia aprobada.
   */
  listAdminOrderRows(filter: AdminOrderRowFilter): Promise<AdminOrderRow[]>;

  updateOrderStatus(
    id: string,
    status: string,
    note?: string | null,
    /** B5 — quién lo cambió: queda asentado en el historial. */
    changedByUserId?: string | null,
  ): Promise<{ id: string; status: string; updatedAt: string }>;

  updateDeliveryFee(
    id: string,
    deliveryFeeAmount: number,
    deliveryFeeStatus: DeliveryFeeStatus,
  ): Promise<OrderRecord>;

  addOrderItems(
    orderId: string,
    itemDetails: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
      packagingUnitAmount: number;
      packagingQuantity: number;
      packagingTotalAmount: number;
      notes: string | null;
      lineTotal: number;
      modifiers: Array<{
        modifierOptionId: string;
        name: string;
        priceDelta: number;
      }>;
    }>,
    newSubtotal: number,
    newDiscount: number,
    newPackagingAmount: number,
    newTipAmount: number,
    newTipRate: number | null,
    newTotal: number,
  ): Promise<OrderRecord>;

  getOrderStatusHistory(orderId: string): Promise<OrderStatusHistoryRecord[]>;

  // Coupon helpers
  findCouponByCode(code: string): Promise<CouponRecord | null>;
  /**
   * Reserves one use of the coupon. Must be atomic: returns `false` when the
   * usage limit was already reached, so concurrent orders cannot overspend it.
   */
  consumeCouponUsage(id: string, usageLimit: number): Promise<boolean>;
  /** Returns a previously reserved use after the order failed to persist. */
  releaseCouponUsage(id: string): Promise<void>;

  /**
   * Administración de promos (T9c).
   *
   * Viven en este puerto y no en un módulo aparte porque el cupón es del pedido:
   * su tabla tiene la relación con `Order`. Si las promos crecen —por ejemplo, si
   * empiezan a aplicarse solas sin código—, conviene mudarlas a su propio módulo.
   */
  listCoupons(): Promise<CouponRecord[]>;
  findCouponById(id: string): Promise<CouponRecord | null>;
  createCoupon(input: CouponInput): Promise<CouponRecord>;
  updateCoupon(id: string, input: Partial<CouponInput>): Promise<CouponRecord>;
  deleteCoupon(id: string): Promise<void>;

  // Table helper
  findTableById(id: string): Promise<TableRecord | null>;
  findTableByQrToken(qrToken: string): Promise<TableRecord | null>;

  // Delivery zone helper
  findDeliveryZoneById(id: string): Promise<DeliveryZoneRecord | null>;

  // Product helper for validation
  getProductWithModifiers(productId: string): Promise<{
    id: string;
    name: string;
    basePrice: number;
    packagingFeeAmount?: number | null;
    /** Categoría y subcategoría: las necesitan las promos por alcance (T9). */
    categoryId: string;
    subcategoryId?: string | null;
    isActive: boolean;
    isAvailable: boolean;
    modifierGroups: {
      id: string;
      name: string;
      isRequired: boolean;
      minSelections: number;
      maxSelections: number;
      options: {
        id: string;
        name: string;
        priceDelta: number;
        isActive: boolean;
      }[];
    }[];
  } | null>;
}
