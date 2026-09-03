import { ReservationError } from "@/modules/reservations/domain/reservation-errors";
import { isValidReservationBusinessHour } from "@/modules/reservations/domain/reservation-business-hours";
import {
  BLOCKING_RESERVATION_STATUSES,
  DEFAULT_RESERVATION_DURATION_MINUTES,
  hasReservationTimeOverlap,
} from "@/modules/reservations/domain/reservation-overlap";
import type { ReservationRepository } from "@/modules/reservations/ports/reservation-repository";

export async function checkAvailability(
  input: { date: string; partySize: number; time?: string },
  { repository }: { repository: ReservationRepository },
) {
  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid date", {
      date: "Required format YYYY-MM-DD",
    });
  }
  if (typeof input.partySize !== "number" || input.partySize < 1) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid partySize", {
      partySize: "Must be >= 1",
    });
  }
  if (
    input.time !== undefined &&
    /^([01]\d|2[0-3]):([0-5]\d)$/.test(input.time) === false
  ) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid time", {
      time: "Optional format HH:MM",
    });
  }
  if (input.time !== undefined && !isValidReservationBusinessHour(input.time)) {
    throw new ReservationError(422, "VALIDATION_ERROR", "Invalid time", {
      time: "Reservations are available from 12:00 to 20:00",
    });
  }

  const tables = await repository.listTables();
  const reservations = await repository.listReservations({ date: input.date });

  return {
    data: {
      tables: tables.map((t) => ({
        id: t.id,
        label: t.label,
        locationId: t.locationId,
        capacity: t.capacity,
        isAvailable: (() => {
          if (!t.isActive || t.capacity < input.partySize) return false;

          const blockingReservations = reservations.filter(
            (r) =>
              r.tableId === t.id &&
              BLOCKING_RESERVATION_STATUSES.includes(r.status),
          );

          if (input.time === undefined) {
            return blockingReservations.length === 0;
          }

          return blockingReservations.every((r) =>
            hasReservationTimeOverlap(
              r.time,
              input.time as string,
              DEFAULT_RESERVATION_DURATION_MINUTES,
            ) === false,
          );
        })(),
      })),
    },
    meta: {
      date: input.date,
      time: input.time ?? null,
      partySize: input.partySize,
      durationMinutes: DEFAULT_RESERVATION_DURATION_MINUTES,
    },
  };
}
