import type { OrderRecord } from "@/modules/orders/domain/order.types";
import { formatCurrency } from "@/shared/lib/format-currency";

type OrderCreatedNotificationCustomer = {
  name: string;
  phone: string;
  type: string;
  address: string;
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
  customer: OrderCreatedNotificationCustomer;
  ticket: OrderCreatedNotificationTicket;
};

function formatOrderType(type: OrderRecord["type"]): string {
  if (type === "delivery") return "DELIVERY";
  if (type === "pickup") return "PICKUP";
  return "TABLE";
}

function buildCustomerAddress(order: OrderRecord): string {
  if (order.type === "delivery") {
    return order.address ?? order.deliveryNotes ?? "N/A";
  }

  if (order.type === "pickup") {
    return order.pickupNotes ?? "Retiro en One Burger";
  }

  return order.tableId ? `Mesa ${order.tableId}` : "Mesa";
}

function formatOrderLine(order: OrderRecord, item: OrderRecord["items"][number]): string[] {
  const modifierLabel =
    item.modifiers.length > 0
      ? ` [${item.modifiers.map((modifier) => modifier.name).join(", ")}]`
      : "";
  const lines = [`${item.quantity} x ${item.productName}${modifierLabel}`];

  if (item.packagingTotalAmount > 0) {
    lines.push(
      `Empaque: ${formatCurrency(item.packagingUnitAmount)} x ${item.packagingQuantity} = ${formatCurrency(item.packagingTotalAmount)}`,
    );
  }

  if (item.notes) {
    lines.push(`Nota: ${item.notes}`);
  }

  return lines;
}

function buildSummaryLines(order: OrderRecord): string[] {
  const tipLabel =
    order.tipRate && order.tipAmount > 0
      ? `Propina ${order.tipRate}%: ${formatCurrency(order.tipAmount)}`
      : `Propina: ${formatCurrency(order.tipAmount)}`;

  return [
    "RESUMEN:",
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Empaque: ${formatCurrency(order.packagingAmount)}`,
    `Envío: ${formatCurrency(order.deliveryFeeAmount)}`,
    tipLabel,
    `TOTAL: ${formatCurrency(order.total)}`,
  ];
}

export function buildOrderCreatedNotificationPayload(
  order: OrderRecord,
): OrderCreatedNotificationPayload {
  const itemLines = order.items.flatMap((item) => formatOrderLine(order, item));

  const detailLines = [
    ...itemLines,
    "------------------------------",
    ...buildSummaryLines(order),
  ];

  return {
    event: "new_order",
    type: formatOrderType(order.type),
    order_id: order.orderNumber,
    internal_id: order.id,
    timestamp: order.createdAt,
    customer: {
      name: order.customerName,
      phone: order.customerWhatsapp,
      type: formatOrderType(order.type),
      address: buildCustomerAddress(order),
    },
    ticket: {
      items: detailLines.join("\n"),
      total: formatCurrency(order.total),
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
    "🛎️ NUEVA ORDEN - ONE BURGER",
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
