import { publish } from "@/infrastructure/events/event-bus";
import { OrderError } from "@/modules/orders/domain/order-errors";
import type { DeliveryFeeStatus } from "@/modules/orders/domain/order.types";
import type { OrderRepository } from "@/modules/orders/ports/order-repository";

export type ReviewDeliveryFeeRequest = {
  deliveryFeeAmount: number;
  deliveryFeeStatus: DeliveryFeeStatus;
};

export async function reviewDeliveryFee(
  id: string,
  input: ReviewDeliveryFeeRequest,
  { repository }: { repository: OrderRepository },
) {
  if (typeof input.deliveryFeeAmount !== "number" || input.deliveryFeeAmount < 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid delivery fee amount", {
      deliveryFeeAmount: "Must be a non-negative number",
    });
  }

  if (!input.deliveryFeeStatus || !["pending_manual_validation", "confirmed"].includes(input.deliveryFeeStatus)) {
    throw new OrderError(422, "VALIDATION_ERROR", "Invalid delivery fee status", {
      deliveryFeeStatus: "Must be pending_manual_validation or confirmed",
    });
  }

  if (input.deliveryFeeStatus === "pending_manual_validation" && input.deliveryFeeAmount !== 0) {
    throw new OrderError(422, "VALIDATION_ERROR", "Inconsistent delivery fee state", {
      deliveryFeeAmount: "Must be 0 when status is pending_manual_validation",
    });
  }

  const order = await repository.findOrderById(id);
  if (!order) {
    throw new OrderError(404, "NOT_FOUND", "Order not found");
  }

  if (order.type !== "delivery") {
    throw new OrderError(409, "CONFLICT", "Delivery fee only applies to delivery orders");
  }

  const updated = await repository.updateDeliveryFee(
    id,
    input.deliveryFeeAmount,
    input.deliveryFeeStatus,
  );

  await publish("DeliveryFeeReviewed", {
    orderId: id,
    deliveryFeeAmount: input.deliveryFeeAmount,
    deliveryFeeStatus: input.deliveryFeeStatus,
  });

  return {
    data: updated,
    meta: {
      sourceOfTruth: "backend" as const,
    },
  };
}
