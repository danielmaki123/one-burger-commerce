export type OrderType = "delivery" | "pickup" | "table";

/**
 * Forma de pago declarada por el cliente (T11).
 *
 * El cobro es **en el local**: esto es informativo, para que la caja sepa si
 * preparar el vuelto o el POS. No hay pasarela ni cobro online.
 */
export const PAYMENT_METHODS = ["cash", "card"] as const;

export type OrderPaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Cómo se muestra en el checkout, en la confirmación y en el admin. */
export const PAYMENT_METHOD_LABELS: Record<OrderPaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
};

export function isOrderPaymentMethod(value: unknown): value is OrderPaymentMethod {
  return typeof value === "string" && (PAYMENT_METHODS as readonly string[]).includes(value);
}

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
  /**
   * Forma de pago declarada por el cliente (T11). Opcional en el tipo porque la
   * columna tiene default en la base (igual que pickupScheduled): un registro
   * viejo o parcial nunca deja la pantalla sin dato.
   */
  paymentMethod?: OrderPaymentMethod;
  /**
   * Con cuánto paga el cliente, cuando es efectivo (T12).
   *
   * El **cambio no se guarda**: se deriva de este monto y el total, así un total
   * corregido no deja un vuelto viejo en la caja.
   */
  paidWithAmount?: number | null;
  /** PIN corto para dictar en caja (T13); no autoriza nada. */
  pickupPin?: string | null;
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
  /**
   * Forma de pago declarada por el cliente (T11). Opcional en el tipo porque la
   * columna tiene default en la base (igual que pickupScheduled): un registro
   * viejo o parcial nunca deja la pantalla sin dato.
   */
  paymentMethod?: OrderPaymentMethod;
  /** Con cuánto paga el cliente cuando es efectivo (T12); el vuelto se deriva. */
  paidWithAmount?: number | null;
  /** PIN corto para dictar en caja (T13); no autoriza nada. */
  pickupPin?: string | null;
  tableId?: string | null;
  couponCode?: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
};

export type CouponRecord = {
  id: string;
  code: string;
  type: "percentage" | "fixed_amount" | "bogo";
  value: number;
  isActive: boolean;
  usageLimit: number;
  usedCount: number;
  expiresAt: string | null;
  /** Promo por cantidad (T9): unidades que se llevan y unidades que salen gratis. */
  buyQuantity?: number | null;
  freeQuantity?: number | null;
  scopeType?: string | null;
  scopeId?: string | null;
};

export type TableRecord = {
  id: string;
  label: string;
  qrToken: string;
  isActive: boolean;
  locationId: string;
};
