import type { PickupLocation } from "@/modules/locations/domain/location-rules";
import type { OrderPaymentMethod } from "@/modules/orders/domain/order.types";

/**
 * Los tipos de la pantalla del detalle de un pedido. Vivían dentro de `page.tsx` (deuda con techo
 * congelado: no puede crecer); son la forma de lo que la API devuelve y de lo que la pantalla muestra, y no
 * dependen de React.
 */

export type OrderType = "delivery" | "pickup" | "table";

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

export type OrderModifier = {
  id: string;
  modifierOptionId: string;
  name: string;
  priceDelta: number;
};

export type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  /** Precio unitario del pedido (lo devuelve la API; lo necesita el papel de la factura). */
  unitPrice: number;
  packagingUnitAmount: number;
  packagingQuantity: number;
  packagingTotalAmount: number;
  lineTotal: number;
  notes: string | null;
  modifiers: OrderModifier[];
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  customerName: string;
  customerWhatsapp: string;
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  deliveryFeeStatus?: string | null;
  tipAmount: number;
  tipRate?: number | null;
  total: number;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  address?: string | null;
  deliveryNotes?: string | null;
  deliveryZoneId?: string | null;
  deliveryZoneName?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  geoAccuracy?: number | null;
  geoCapturedAt?: string | null;
  pickupTime?: string | null;
  /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
  pickupScheduled?: boolean;
  pickupNotes?: string | null;
  /** Forma de pago declarada por el cliente (T11). */
  paymentMethod?: OrderPaymentMethod | null;
  /** Con cuánto paga el cliente cuando es efectivo (T12). */
  paidWithAmount?: number | null;
  /** PIN de retiro para dictar en caja (T13). */
  pickupPin?: string | null;
  /**
   * Cobros registrados (TASK-304): una venta de mostrador los tiene; un pedido del checkout no,
   * porque se paga al retirar. Es lo que la caja necesita para saber con qué pagó el cliente.
   */
  payments?: {
    id: string;
    method: OrderPaymentMethod;
    amount: number;
    currency: string | null;
  }[];
  /** Local del que sale el pedido (T8 fase 7); `null` si el local ya no existe. */
  pickupLocation?: PickupLocation | null;
};

export type GetOrderResponse = {
  data: OrderDetail;
};
