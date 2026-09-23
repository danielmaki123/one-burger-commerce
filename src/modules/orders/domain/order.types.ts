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

/** Cómo se muestra el medio del **cobro real** (Bloque 4 del POS): incluye transferencia y mixto. */
export const PAYMENT_METHOD_TYPE_LABELS: Record<PaymentMethodType, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  mixed: "Mixto",
  other: "Otro",
};

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

/** Bloque 2 del POS — de qué lado va la plata del cajón. */
export type CashMovementKind = "withdrawal" | "deposit";

export type CashMovementCategory = "supplier" | "change_fund" | "vault" | "expense" | "other";

/** Bloque 3 del POS — de dónde sale la devolución y si es total o parcial. */
export type RefundKind = "full" | "partial";

/** Bloque 3 del POS — el estado de una devolución: sin aprobar, aprobada o rechazada. */
export type RefundStatus = "pending" | "approved" | "rejected";

/** Una devolución sobre un cobro (Bloque 3 del POS, Fase 2). */
export type RefundRecord = {
  id: string;
  paymentId: string;
  orderId: string;
  /** El turno donde se registró, para el arqueo. */
  shiftId: string | null;
  kind: RefundKind;
  /** Medio original del cobro: una devolución de tarjeta no sale del cajón. */
  method: PaymentMethodType;
  /** Monto **positivo**: lo que se le devolvió al cliente. */
  amount: number;
  currency: string;
  reason: string;
  status: RefundStatus;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdAt: string;
};

/** Un movimiento de caja del turno (Bloque 2 del POS, Fase 2). */
export type CashMovementRecord = {  id: string;
  shiftId: string;
  kind: CashMovementKind;
  category: CashMovementCategory;
  /** Monto positivo: el signo lo da el `kind`. */
  amount: number;
  currency: string;
  reason: string;
  userId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  /**
   * Tarea 2 del brief (2026-09-17) — el límite de retiro vigente cuando se registró. `null` = no había
   * límite. Va congelado para que cambiar el límite después no reescriba lo que ya pasó.
   */
  withdrawalLimitAmount: number | null;
  createdAt: string;
};

/** Un turno de caja. Los montos de cierre son `null` mientras está abierto. */
export type ShiftRecord = {
  id: string;
  locationId: string;
  userId: string;
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — la **terminal** del local donde está esta caja. `null` en
   * los turnos de antes de la fase y en las sucursales sin terminales cargadas (ahí hay una sola caja).
   */
  terminalId?: string | null;
  /** Fondo con el que arrancó la caja. */
  openingAmount: number;
  /** Lo que se contó al cerrar. */
  closingAmount: number | null;
  /** Lo que el sistema esperaba según los cobros. Congelado al cerrar. */
  expectedAmount: number | null;
  /** `closingAmount - expectedAmount`. Negativo = faltó plata. */
  difference: number | null;
  /**
   * Bloque 1.1 del POS (Fase 2) — el esperado **por moneda**, congelado al cerrar
   * (`{"NIO": 1200, "USD": 40}`). `null` mientras el turno está abierto o si es un cierre viejo.
   */
  expectedByCurrency?: Record<string, number> | null;
  /**
   * Bloque 1.2 del POS (Fase 2) — lo que entró **en efectivo** en el turno, en la moneda del negocio
   * (monto + propina − vuelto). La tarjeta no entra: no pasó por el cajón.
   */
  cashSalesAmount?: number | null;
  /**
   * Tarea 1.2 del roadmap + decisión del owner (2026-09-17) — el **desglose por medio** del turno,
   * congelado al cerrar: tarjeta, transferencia, otras formas y las propinas. `null` en los cierres
   * viejos (antes de que se persistiera): la pantalla lo dice en vez de estimarlo.
   */
  cardSalesAmount?: number | null;
  transferSalesAmount?: number | null;
  otherSalesAmount?: number | null;
  tipsAmount?: number | null;
  /**
   * Bloque 2 del POS (Fase 2) — cuánto movieron los retiros e ingresos del turno, en la moneda del
   * negocio (retiro resta, ingreso suma). Congelado al cerrar.
   */
  cashMovementsAmount?: number | null;
  /**
   * Bloque 3 del POS (Fase 2) — el neto de las devoluciones en efectivo aprobadas del turno, en
   * moneda del negocio (negativo o 0: la plata salió del cajón). Congelado al cerrar.
   */
  refundsAmount?: number | null;
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — la diferencia del **cuadre por banco** (lo declarado
   * menos lo cobrado con tarjeta y transferencia), en la moneda del negocio. Congelada al cerrar: el
   * lote de una terminal no se recalcula después.
   */
  bankDifferenceAmount?: number | null;
  /**
   * Fase 3 — cuándo salió el aviso del cierre al grupo del dueño, que es el mensaje donde viaja la
   * diferencia. `null` = todavía no se avisó (el aviso es best-effort).
   */
  differenceNotifiedAt?: string | null;
  /**
   * Fase 3 del rediseño de Caja (2026-09-23) — lo que cada banco reportó por este turno: el monto
   * declarado con su lote y su terminal, por moneda.
   */
  bankCloses?: {
    bankId: string;
    /** Nombre del banco al momento de leer (el cierre lo imprime: un id no lo lee nadie). */
    bankName?: string;
    bankCode?: string | null;
    declaredAmount: number;
    currency: string;
    lote: string | null;
    terminalLabel: string | null;
    notes: string | null;
  }[];
  /**
   * Bloque 1.10 del POS (Fase 2) — la firma de la última reapertura: cuándo, quién y por qué. `null`
   * si el turno nunca se reabrió.
   */
  reopenedAt?: string | null;
  reopenedByUserId?: string | null;
  reopenReason?: string | null;
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
