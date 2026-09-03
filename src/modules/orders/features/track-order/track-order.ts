import { timingSafeEqual } from "node:crypto";

import { OrderError } from "@/modules/orders/domain/order-errors";
import { hashOrderLookupToken } from "@/modules/orders/domain/order-tracking";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";
import { normalizeWhatsapp } from "@/shared/lib/normalize-whatsapp";

function getPublicStatusLabel(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "new") return "Recibida";
  if (normalized === "confirmed") return "Confirmada";
  if (normalized === "preparing") return "En preparación";
  if (normalized === "ready") return "Lista";
  if (normalized === "ready_for_pickup") return "Lista para retirar";
  if (normalized === "picked_up") return "Retirada";
  if (normalized === "out_for_delivery") return "En camino";
  if (normalized === "delivered") return "Entregada";
  if (normalized === "accepted") return "Aceptada";
  if (normalized === "served") return "Servida";
  if (normalized === "closed") return "Completada";
  if (normalized === "cancelled") return "Cancelada";
  return status;
}

export async function trackOrder(
  input: {
    orderNumber: string;
    customerWhatsapp?: string;
    orderLookupToken?: string;
  },
  { repository }: { repository: OrderRepository },
) {
  const orderNumber = input.orderNumber.trim();

  if (!orderNumber) {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload");
  }

  const order = await repository.findOrderByOrderNumber(orderNumber);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  if (input.orderLookupToken) {
    if (!order.orderLookupTokenHash) {
      throw new OrderError(404, "NOT_FOUND", "Order not found");
    }
    const incomingHash = hashOrderLookupToken(input.orderLookupToken.trim());
    if (!safeCompareHex(incomingHash, order.orderLookupTokenHash)) {
      throw new OrderError(404, "NOT_FOUND", "Order not found");
    }
  } else if (input.customerWhatsapp) {
    const providedWhatsapp = normalizeWhatsapp(input.customerWhatsapp);
    if (!providedWhatsapp) {
      throw new OrderError(400, "BAD_REQUEST", "Invalid payload");
    }
    const storedWhatsapp = normalizeWhatsapp(order.customerWhatsapp);
    if (storedWhatsapp !== providedWhatsapp) {
      throw new OrderError(404, "NOT_FOUND", "Order not found");
    }
  } else {
    throw new OrderError(400, "BAD_REQUEST", "Invalid payload");
  }

  return {
    data: {
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      statusLabel: getPublicStatusLabel(order.status),
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
      })),
      subtotal: order.subtotal,
      discount: order.discount,
      packagingAmount: order.packagingAmount,
      deliveryFeeAmount: order.deliveryFeeAmount,
      tipAmount: order.tipAmount,
      tipRate: order.tipRate ?? null,
      total: order.total,
    },
  };
}

function safeCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}
