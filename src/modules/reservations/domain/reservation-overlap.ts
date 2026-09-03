import type { ReservationStatus } from "@/modules/reservations/domain/reservation.types";

export const BLOCKING_RESERVATION_STATUSES: ReservationStatus[] = [
  "requested",
  "approved",
  "seated",
];

export const DEFAULT_RESERVATION_DURATION_MINUTES = 120;

function parseTimeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function hasReservationTimeOverlap(
  baseTime: string,
  comparedTime: string,
  durationMinutes = DEFAULT_RESERVATION_DURATION_MINUTES,
): boolean {
  const a = parseTimeToMinutes(baseTime);
  const b = parseTimeToMinutes(comparedTime);
  if (a === null || b === null) return false;

  const aEnd = a + durationMinutes;
  const bEnd = b + durationMinutes;

  return a < bEnd && b < aEnd;
}
