import { timingSafeEqual } from "node:crypto";

import { OrderError } from "@/modules/orders/domain/order-errors";
import type { PublicOrderDetail } from "@/modules/orders/domain/order.types";
import { hashOrderLookupToken } from "@/modules/orders/domain/order-tracking";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

function safeCompareHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function getPublicOrder(
  id: string,
  token: string | null,
  { repository }: { repository: OrderRepository },
): Promise<{ data: PublicOrderDetail }> {
  if (!token || !token.trim()) {
    throw new OrderError(401, "UNAUTHORIZED", "Order lookup token required");
  }

  const order = await repository.findOrderById(id);
  if (!order || !order.orderLookupTokenHash) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  const incomingHash = hashOrderLookupToken(token.trim());
  if (!safeCompareHex(incomingHash, order.orderLookupTokenHash)) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  const publicOrder: PublicOrderDetail = {
    id: order.id,
    orderNumber: order.orderNumber,
    type: order.type,
    status: order.status,
    customerName: order.customerName,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    packagingAmount: order.packagingAmount,
    deliveryFeeAmount: order.deliveryFeeAmount,
    tipAmount: order.tipAmount,
    tipRate: order.tipRate ?? null,
    total: order.total,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    deliveryFeeStatus: order.deliveryFeeStatus,
    pickupTime: order.pickupTime,
    pickupScheduled: order.pickupScheduled ?? false,
    pickupNotes: order.pickupNotes,
    paymentMethod: order.paymentMethod,
    paidWithAmount: order.paidWithAmount ?? null,
    pickupPin: order.pickupPin ?? null,
    tableId: order.tableId,
    couponCode: order.couponCode,
    deliveryZoneId: order.deliveryZoneId,
    deliveryZoneName: order.deliveryZoneName,
  };

  return { data: publicOrder };
}
