import type {
  CouponRecord,
  DeliveryFeeStatus,
  DeliveryZoneRecord,
  OrderPaymentMethod,
  OrderRecord,
  OrderStatusHistoryRecord,
  TableRecord,
} from "@/modules/orders/domain/order.types";

export type OrderItemInput = {
  productId: string;
  quantity: number;
  modifierOptionIds: string[];
  notes?: string | null;
};

/**
 * Un pedido leído para la **cola de trabajo**, con el instante en que empezó su etapa actual (B3).
 *
 * No va en `OrderRecord` porque solo la lectura de la lista lo resuelve —y lo resuelve para todos los
 * pedidos de una sola consulta—: la urgencia de la comanda se mide dentro de la etapa (aceptado hace
 * 20 minutos y en preparación hace 2 no está atrasado), y con `updatedAt` mentiría, porque también
 * cambia cuando alguien edita el pedido por otro motivo. Sin historial, la etapa empezó con el pedido.
 */
export type OrderQueueRecord = OrderRecord & {
  stageChangedAt: string;
  /**
   * B5 — cuándo quedó listo (`null` si todavía no lo estuvo). Es lo que permite decir cuánto tarda la
   * cocina hoy sin pedir el historial de cada pedido por separado.
   */
  readyAt: string | null;
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
