export type OrderType = "delivery" | "pickup" | "table";

export type DeliveryFeeStatus =
  | "pending_manual_validation"
  | "confirmed";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "closed"
  | "ready_for_pickup"
  | "picked_up"
  | "accepted"
  | "served"
  | "cancelled";

export type OrderItemRecord = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  packagingUnitAmount: number;
  packagingQuantity: number;
  packagingTotalAmount: number;
  modifiers: OrderItemModifierRecord[];
  notes: string | null;
  lineTotal: number;
};

export type OrderItemModifierRecord = {
  id: string;
  modifierOptionId: string;
  name: string;
  priceDelta: number;
};

export type OrderStatusHistoryRecord = {
  id: string;
  orderId: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
};

export type DeliveryZoneRecord = {
  id: string;
  name: string;
  description: string | null;
  baseFee: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type OrderRecord = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  customerWhatsapp: string;
  customerId?: string | null;
  items: OrderItemRecord[];
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  tipRate?: number | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  address?: string | null;
  deliveryNotes?: string | null;
  deliveryFeeStatus?: DeliveryFeeStatus | null;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  tableId?: string | null;
  couponCode?: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: string | null;
  orderLookupTokenHash?: string | null;
};

export type PublicOrderDetail = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  items: OrderItemRecord[];
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  tipRate?: number | null;
  total: number;
  createdAt: string;
  updatedAt: string;
  deliveryFeeStatus?: DeliveryFeeStatus | null;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  tableId?: string | null;
  couponCode?: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
};

export type CouponRecord = {
  id: string;
  code: string;
  type: "percentage" | "fixed_amount";
  value: number;
  isActive: boolean;
  usageLimit: number;
  usedCount: number;
  expiresAt: string | null;
};

export type TableRecord = {
  id: string;
  label: string;
  qrToken: string;
  isActive: boolean;
  locationId: string;
};
