import type {
  CouponRecord,
  DeliveryFeeStatus,
  DeliveryZoneRecord,
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
  pickupNotes?: string | null;
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
  incrementCouponUsedCount(id: string): Promise<void>;

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
