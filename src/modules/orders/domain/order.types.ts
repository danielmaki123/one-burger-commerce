import type { PickupLocation } from "@/modules/locations/domain/location-rules";

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
  /**
   * B5 — quién hizo el cambio (id del usuario del panel). Opcional porque las filas viejas no lo
   * tienen: con cuentas compartidas, «quién aceptó esto» tiene que quedar asentado.
   */
  changedByUserId?: string | null;
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
  /** Local al que va el pedido (T8). Obligatorio: la migración backfillea los viejos. */
  locationId: string;
  /**
   * TASK-101 — clave de operación que mandó el cliente para esta alta. `null` en los pedidos que
   * ya existían y en los que llegan sin clave: un pedido "sin clave" es un pedido normal, no uno
   * que pueda reusarse.
   */
  idempotencyKey?: string | null;
  customerName: string;
  customerWhatsapp: string;
  /** TASK-303b — correo del cliente, si lo dejó (la venta de mostrador lo pide opcional). */
  customerEmail?: string | null;
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
  /**
   * Dónde retira el cliente (T8 fase 7). Se resuelve al leer el local del pedido;
   * `null` si el local ya no existe. El `locationId` no sale al público.
   */
  pickupLocation: PickupLocation | null;
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

/**
 * TASK-103 — cómo se cobró un pedido.
 *
 * Es distinto de `OrderPaymentMethod` (lo que el cliente **declara** en el checkout): acá entran la
 * transferencia, el pago repartido y "otro", que son cosas que pasan en el mostrador.
 */
export const PAYMENT_METHOD_TYPES = {
  cash: "cash",
  card: "card",
  transfer: "transfer",
  mixed: "mixed",
  other: "other",
} as const;

export type PaymentMethodType =
  (typeof PAYMENT_METHOD_TYPES)[keyof typeof PAYMENT_METHOD_TYPES];

export function isPaymentMethodType(value: string): value is PaymentMethodType {
  return Object.values(PAYMENT_METHOD_TYPES).includes(value as PaymentMethodType);
}

/** Un cobro registrado sobre un pedido. Un pago mixto son varias filas. */
export type PaymentRecord = {
  id: string;
  orderId: string;
  method: PaymentMethodType;
  amount: number;
  /**
   * TASK-303b — moneda en la que entró este cobro. `null` = la moneda del negocio (los cobros que
   * existen desde TASK-103 no la declaran).
   */
  currency: string | null;
  /** TASK-305 — vuelto que salió del cajón con este cobro, en moneda del negocio (0 si no hubo). */
  changeAmount: number;
  tip: number;
  reference: string | null;
  createdAt: string;
};

/** TASK-104 — estado de un turno de caja. */
export const SHIFT_STATUSES = {
  open: "open",
  closed: "closed",
} as const;

export type ShiftStatus = (typeof SHIFT_STATUSES)[keyof typeof SHIFT_STATUSES];

export function isShiftStatus(value: string): value is ShiftStatus {
  return Object.values(SHIFT_STATUSES).includes(value as ShiftStatus);
}

/** Un turno de caja. Los montos de cierre son `null` mientras está abierto. */
export type ShiftRecord = {
  id: string;
  locationId: string;
  userId: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  /** Fondo con el que arrancó la caja. */
  openingAmount: number;
  /** Lo que se contó al cerrar. */
  closingAmount: number | null;
  /** Lo que el sistema esperaba según los cobros. Congelado al cerrar. */
  expectedAmount: number | null;
  /** `closingAmount - expectedAmount`. Negativo = faltó plata. */
  difference: number | null;
  /**
   * TASK-305 — el conteo billete por billete, de apertura y de cierre, con su moneda. El total dice
   * cuánto hay; esto dice **de dónde salió**, que es lo que permite revisar un arqueo.
   */
  cashCounts?: {
    kind: "opening" | "closing";
    currency: string;
    denomination: number;
    quantity: number;
  }[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
