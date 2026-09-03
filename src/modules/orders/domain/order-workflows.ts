import type { OrderStatus, OrderType } from "./order.types";

const DELIVERY_TRANSITIONS: Record<string, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["closed"],
  cancelled: [],
};

const PICKUP_TRANSITIONS: Record<string, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["picked_up"],
  picked_up: ["closed"],
  cancelled: [],
};

const TABLE_TRANSITIONS: Record<string, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing"],
  preparing: ["served", "cancelled"],
  served: ["closed"],
  cancelled: [],
};

const WORKFLOWS: Record<OrderType, Record<string, OrderStatus[]>> = {
  delivery: DELIVERY_TRANSITIONS,
  pickup: PICKUP_TRANSITIONS,
  table: TABLE_TRANSITIONS,
};

export function getAllowedNextStatuses(
  type: OrderType,
  current: OrderStatus,
): OrderStatus[] {
  return WORKFLOWS[type]?.[current] ?? [];
}

export function isValidStatusTransition(
  type: OrderType,
  current: OrderStatus,
  next: OrderStatus,
): boolean {
  return getAllowedNextStatuses(type, current).includes(next);
}

export function getInitialStatus(_type: OrderType): OrderStatus {
  return "new";
}
