import type { ReservationStatus } from "./reservation.types";

const TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["seated", "cancelled", "no_show"],
  rejected: [],
  seated: [],
  cancelled: [],
  no_show: [],
};

export function getAllowedNextStatuses(
  current: ReservationStatus,
): ReservationStatus[] {
  return TRANSITIONS[current] ?? [];
}

export function isValidStatusTransition(
  current: ReservationStatus,
  next: ReservationStatus,
): boolean {
  return getAllowedNextStatuses(current).includes(next);
}

export function getInitialStatus(): ReservationStatus {
  return "requested";
}
