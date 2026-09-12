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
  customerName: string;
  customerWhatsapp: string;
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
};

export type ListOrdersFilter = {
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
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

  listOrders(filter: ListOrdersFilter): Promise<OrderRecord[]>;

  updateOrderStatus(
    id: string,
    status: string,
    note?: string | null,
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
