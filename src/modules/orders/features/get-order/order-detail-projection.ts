import type { PickupLocation } from "@/modules/locations/domain/location-rules";
import type {
  OrderItemModifierRecord,
  OrderItemRecord,
  OrderPaymentMethod,
  OrderRecord,
  OrderSource,
  OrderStatus,
  OrderStatusHistoryRecord,
  OrderType,
  PaymentRecord,
} from "@/modules/orders/domain/order.types";
import { resolveOrderStageTimes, type OrderStageTimes } from "@/modules/orders/domain/order-stage-times";
import type {
  OrderPaymentStatusValue,
} from "@/modules/payments/domain/order-financial-status";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **`OrderDetailProjection`**: el detalle completo de un pedido.
 *
 * Es la composición que la pantalla de detalle consume, y su responsabilidad principal es **decidir qué
 * sale y qué no** según la capacidad del rol. La regla del repo es explícita: *ocultar algo en React no es
 * autorización*. Por eso, cuando el rol **no** tiene `canViewOrderFinancials`, los campos financieros **no
 * existen en la respuesta** — no viajan en `null` para que la pantalla los esconda: no viajan.
 *
 * Lo que el detalle compone, y de quién lo toma:
 *
 * | Bloque | Dueño |
 * |---|---|
 * | Items, modificadores, notas y totales | `orders` (`order-totals.ts`) |
 * | Recorrido y sellos por etapa | `orders` (`order-stage-times.ts`, **derivados del historial real**) |
 * | Estado financiero, cobros y saldo | `payments` (se **consume**, nunca se recalcula) |
 * | Documento | `invoices` |
 * | Punto de retiro | `locations` |
 * | Quién movió el pedido | `auth` (el nombre del usuario, resuelto por el borde) |
 *
 * **El recorrido sale del historial**: no hay un segundo mapa estado→etapa. Lo que se muestra es lo que
 * pasó, con su hora y su actor, más los sellos que el historial demuestra.
 */

export type OrderDetailFinancial = {
  status: OrderPaymentStatusValue;
  paidAmount: number;
  outstandingAmount: number;
  unresolvedAmount: number;
  baseCurrencyCode: string;
};

export type OrderDetailPayment = {
  id: string;
  method: OrderPaymentMethod | string;
  amount: number;
  currency: string | null;
  /** Vuelto que salió del cajón con este cobro, en moneda del negocio. */
  changeAmount: number;
  tip: number;
  reference: string | null;
  createdAt: string;
  /** Cobro anulado: no cuenta para la plata, pero el detalle lo dice (`A-59`). */
  voidedAt: string | null;
  voidReason: string | null;
};

export type OrderDetailInvoice = {
  id: string;
  number: string;
  issuedAt: string;
  currencyCode: string;
  total: number;
  voidedAt: string | null;
  /** La hoja de 80 mm, con la URL ya armada: la pantalla no compone rutas a mano. */
  printUrl: string;
};

export type OrderDetailHistoryEvent = {
  id: string;
  status: OrderStatus;
  note: string | null;
  /** Cuándo pasó, en ISO. La pantalla lo formatea en la zona del **negocio**, no en la del navegador. */
  at: string;
  /** Quién lo movió, resuelto a nombre; `null` si el usuario ya no existe o el cambio no tiene firma. */
  actor: string | null;
};

export type OrderDetailPickup = {
  /** `asap` = «lo antes posible» (la venta de mostrador no promete hora); `scheduled` = hora elegida. */
  mode: "asap" | "scheduled";
  time: string | null;
  /** El cliente programó el retiro (`pickupScheduled`). El papel del ticket lo imprime. */
  scheduled: boolean;
  notes: string | null;
  location: PickupLocation | null;
};

export type OrderDetailTotals = {
  subtotal: number;
  discount: number;
  packagingAmount: number;
  deliveryFeeAmount: number;
  tipAmount: number;
  total: number;
  /** Con cuánto paga el cliente en efectivo, si lo declaró; el vuelto se deriva. */
  paidWithAmount: number | null;
};

export type OrderDetailProjection = {
  id: string;
  orderNumber: string;
  type: OrderType;
  status: OrderStatus;
  source: OrderSource | null;
  createdAt: string;
  updatedAt: string;
  /** El local del pedido, para el alcance por sucursal del borde. No es un dato financiero. */
  locationId: string;
  /** Moneda congelada del pedido (`D-022`); `null` en un pedido legacy. */
  currencyCode: string | null;
  customer: { name: string; whatsapp: string; email: string | null };
  pickup: OrderDetailPickup;
  items: OrderItemRecord[];
  history: OrderDetailHistoryEvent[];
  stageTimes: OrderStageTimes;
  /** `null` sin capacidad financiera: no es «cero», es «no corresponde». */
  financial: OrderDetailFinancial | null;
  payments: OrderDetailPayment[];
  pickupPin: string | null;
  invoice: OrderDetailInvoice | null;
  totals: OrderDetailTotals | null;
  /** Si esta sesión puede ver la plata del pedido. Lo consume la pantalla para no ofrecer lo que no hay. */
  canViewFinancials: boolean;
};

export type OrderDetailInvoiceRecord = {
  id: string;
  number: string;
  issuedAt: string;
  currencyCode: string;
  total: number;
  voidedAt: string | null;
};

export type ProjectOrderDetailInput = {
  order: OrderRecord;
  pickupLocation: PickupLocation | null;
  payments: readonly PaymentRecord[];
  history: readonly OrderStatusHistoryRecord[];
  /** Los nombres de los usuarios del panel, para firmar cada cambio del historial. */
  actorNames: ReadonlyMap<string, string>;
  /** El estado financiero de `payments`, o `null` si el rol no puede verlo. */
  financial: Omit<OrderDetailFinancial, "baseCurrencyCode"> | null;
  invoice: OrderDetailInvoiceRecord | null;
};

const EMPTY_STAGE_TIMES: OrderStageTimes = {
  confirmedAt: null,
  preparingAt: null,
  readyAt: null,
  pickedUpAt: null,
  closedAt: null,
};

/** El `options.orderType` es un dato del pedido: `type` no decide si hay historial, pero sí lo ordena. */
function resolvePickup(order: OrderRecord, location: PickupLocation | null): OrderDetailPickup {
  return {
    // La venta de mostrador crea el pedido **sin** hora prometida y con `pickupScheduled: false`: eso es
    // «lo antes posible», no un programado sin hora.
    mode: order.pickupScheduled ? "scheduled" : "asap",
    time: order.pickupTime ?? null,
    scheduled: Boolean(order.pickupScheduled),
    notes: order.pickupNotes ?? null,
    location,
  };
}

export function projectOrderDetail(
  input: ProjectOrderDetailInput,
  options: { canViewFinancials: boolean; internalBaseUrl: string },
): OrderDetailProjection {
  const { order, history } = input;
  const canView = options.canViewFinancials;

  const events: OrderDetailHistoryEvent[] = [...history]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((entry) => ({
      id: entry.id,
      status: entry.status,
      note: entry.note,
      at: entry.createdAt,
      actor: entry.changedByUserId ? (input.actorNames.get(entry.changedByUserId) ?? null) : null,
    }));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    source: order.source ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    locationId: order.locationId,
    currencyCode: order.currencyCode ?? null,
    customer: {
      name: order.customerName,
      whatsapp: order.customerWhatsapp,
      email: order.customerEmail ?? null,
    },
    pickup: resolvePickup(order, input.pickupLocation),
    items: order.items,
    history: events,
    // Los cinco sellos se derivan **del historial**, con la regla del dominio y una sola vez.
    stageTimes: history.length > 0 ? resolveOrderStageTimes(history) : EMPTY_STAGE_TIMES,
    financial: canView && input.financial ? { ...input.financial, baseCurrencyCode: order.currencyCode ?? "" } : null,
    payments: canView
      ? input.payments.map((payment) => ({
          id: payment.id,
          method: payment.method,
          amount: payment.amount,
          currency: payment.currency,
          changeAmount: payment.changeAmount,
          tip: payment.tip,
          reference: payment.reference,
          createdAt: payment.createdAt,
          voidedAt: payment.voidedAt,
          voidReason: payment.voidReason,
        }))
      : [],
    // El PIN de retiro es un dato de mostrador: lo dicta el cliente para que le entreguen el pedido, y
    // cocina no lo necesita para nada.
    pickupPin: canView ? (order.pickupPin ?? null) : null,
    invoice:
      canView && input.invoice
        ? {
            ...input.invoice,
            printUrl: `${options.internalBaseUrl}/orders/${order.id}/invoice/print`,
          }
        : null,
    totals: canView
      ? {
          subtotal: order.subtotal,
          discount: order.discount,
          packagingAmount: order.packagingAmount,
          deliveryFeeAmount: order.deliveryFeeAmount,
          tipAmount: order.tipAmount,
          total: order.total,
          paidWithAmount: order.paidWithAmount ?? null,
        }
      : null,
    canViewFinancials: canView,
  };
}

/** Reexport del tipo de un modificador, para que la pantalla no importe el dominio entero. */
export type OrderDetailModifier = OrderItemModifierRecord;
