import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { formatTimeInTimeZone } from "@/modules/business-settings/domain/format-time-in-timezone";
import type { OrderRecord } from "@/modules/orders/domain/order.types";
import {
  DEFAULT_CURRENCY_FORMAT,
  formatCurrency,
  type CurrencyFormat,
} from "@/shared/lib/format-currency";

/** Branding del negocio que se congela en el ticket al momento del pedido. */
export type OrderNotificationBranding = {
  businessName: string;
  currency: CurrencyFormat;
  /** Zona horaria del negocio, para mostrar la hora de retiro como la ve el local. */
  timeZone: string;
};

/**
 * Respaldo si el emisor no pasa branding: sale del módulo de defaults, que es la
 * única fuente de verdad. El outbox siempre pasa la configuración guardada.
 */
function resolveBranding(branding?: Partial<OrderNotificationBranding>): OrderNotificationBranding {
  return {
    businessName: branding?.businessName ?? DEFAULT_BUSINESS_SETTINGS.name,
    currency: branding?.currency ?? DEFAULT_CURRENCY_FORMAT,
    timeZone: branding?.timeZone ?? DEFAULT_BUSINESS_SETTINGS.timezone,
  };
}

type OrderCreatedNotificationCustomer = {
  name: string;
  phone: string;
  type: string;
  address: string;
  /** Para cuándo es el retiro. `null` en pedidos que no son de retiro o sin hora. */
  pickup: string | null;
};

type OrderCreatedNotificationTicket = {
  items: string;
  total: string;
  payment: string;
};

export type OrderCreatedNotificationPayload = {
  event: "new_order";
  type: string;
  order_id: string;
  internal_id: string;
  timestamp: string;
  business: { name: string };
  customer: OrderCreatedNotificationCustomer;
  ticket: OrderCreatedNotificationTicket;
};

function formatOrderType(type: OrderRecord["type"]): string {
  if (type === "delivery") return "DELIVERY";
  if (type === "pickup") return "PICKUP";
  return "TABLE";
}

function buildCustomerAddress(order: OrderRecord, businessName: string): string {
  if (order.type === "delivery") {
    return order.address ?? order.deliveryNotes ?? "N/A";
  }

  if (order.type === "pickup") {
    return order.pickupNotes ?? `Retiro en ${businessName}`;
  }

  return order.tableId ? `Mesa ${order.tableId}` : "Mesa";
}

/**
 * Para cuándo es el retiro, tal como lo necesita la cocina.
 *
 * Se distingue "programado" de "lo antes posible" a propósito: no es lo mismo un pedido
 * que hay que empezar ya que uno que el cliente viene a buscar en dos horas.
 */
function buildPickupLine(order: OrderRecord, timeZone: string): string | null {
  if (order.type !== "pickup" || !order.pickupTime) return null;

  const time = formatTimeInTimeZone(order.pickupTime, timeZone);
  if (!time) return null;

  return order.pickupScheduled
    ? `Programado para las ${time}`
    : `Lo antes posible (~${time})`;
}

function formatOrderLine(
  order: OrderRecord,
  item: OrderRecord["items"][number],
  currency: CurrencyFormat,
): string[] {
  const modifierLabel =
    item.modifiers.length > 0
      ? ` [${item.modifiers.map((modifier) => modifier.name).join(", ")}]`
      : "";
  const lines = [`${item.quantity} x ${item.productName}${modifierLabel}`];

  if (item.packagingTotalAmount > 0) {
    lines.push(
      `Empaque: ${formatCurrency(item.packagingUnitAmount, currency)} x ${item.packagingQuantity} = ${formatCurrency(item.packagingTotalAmount, currency)}`,
    );
  }

  if (item.notes) {
    lines.push(`Nota: ${item.notes}`);
  }

  return lines;
}

function buildSummaryLines(order: OrderRecord, currency: CurrencyFormat): string[] {
  const tipLabel =
    order.tipRate && order.tipAmount > 0
      ? `Propina ${order.tipRate}%: ${formatCurrency(order.tipAmount, currency)}`
      : `Propina: ${formatCurrency(order.tipAmount, currency)}`;

  return [
    "RESUMEN:",
    `Subtotal: ${formatCurrency(order.subtotal, currency)}`,
    `Empaque: ${formatCurrency(order.packagingAmount, currency)}`,
    `Envío: ${formatCurrency(order.deliveryFeeAmount, currency)}`,
    tipLabel,
    `TOTAL: ${formatCurrency(order.total, currency)}`,
  ];
}

export function buildOrderCreatedNotificationPayload(
  order: OrderRecord,
  brandingInput?: Partial<OrderNotificationBranding>,
): OrderCreatedNotificationPayload {
  const branding = resolveBranding(brandingInput);
  const itemLines = order.items.flatMap((item) => formatOrderLine(order, item, branding.currency));

  const detailLines = [
    ...itemLines,
    "------------------------------",
    ...buildSummaryLines(order, branding.currency),
  ];

  return {
    event: "new_order",
    type: formatOrderType(order.type),
    order_id: order.orderNumber,
    internal_id: order.id,
    timestamp: order.createdAt,
    business: { name: branding.businessName },
    customer: {
      name: order.customerName,
      phone: order.customerWhatsapp,
      type: formatOrderType(order.type),
      address: buildCustomerAddress(order, branding.businessName),
      pickup: buildPickupLine(order, branding.timeZone),
    },
    ticket: {
      items: detailLines.join("\n"),
      total: formatCurrency(order.total, branding.currency),
      payment: "PENDIENTE",
    },
  };
}

/**
 * The Telegram sender posts with `parse_mode: "HTML"`, and every field here
 * comes from customer input (name, notes, address) or from the menu catalog.
 * Escaping the assembled ticket prevents tag injection that could fake a total
 * or break the message with a 400 from Telegram.
 */
export function escapeTelegramHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatOrderCreatedTelegramMessage(
  payload: OrderCreatedNotificationPayload,
): string {
  const customerType = payload.customer.type.toUpperCase();
  const detailBlock = payload.ticket.items.includes("TOTAL:")
    ? payload.ticket.items
    : `${payload.ticket.items}\nTOTAL: ${payload.ticket.total}`;
  const lines = [
    // Los eventos que ya estaban en el outbox se guardaron sin `business`:
    // se leen de forma defensiva para no romper el envío.
    `🛎️ NUEVA ORDEN - ${(payload.business?.name ?? DEFAULT_BUSINESS_SETTINGS.name).toUpperCase()}`,
    "==============================",
    `ORDEN: #${payload.order_id}`,
    `ID INTERNO: ${payload.internal_id}`,
    `CREADO: ${payload.timestamp ?? ""}`,
    "------------------------------",
    `CLIENTE: ${payload.customer.name}`,
    `TEL: ${payload.customer.phone}`,
    `TIPO: ${customerType}`,
  ];

  if (customerType === "DELIVERY") {
    lines.push(`DIR: ${payload.customer.address}`);
  } else {
    // El retiro va en su propia línea: antes la hora se perdía porque la línea de
    // info la ocupaban las notas del cliente.
    if (payload.customer?.pickup) {
      lines.push(`RETIRO: ${payload.customer.pickup}`);
    }
    lines.push(`INFO: ${payload.customer.address}`);
  }

    lines.push(
    "------------------------------",
    "DETALLE:",
    detailBlock,
    "------------------------------",
    "💬 HABLAR CON CLIENTE:",
    `https://wa.me/${payload.customer.phone.replace(/\D/g, "")}`,
    "==============================",
  );

  return escapeTelegramHtml(lines.join("\n"));
}
