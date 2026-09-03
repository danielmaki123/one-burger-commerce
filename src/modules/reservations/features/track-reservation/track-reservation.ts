import { timingSafeEqual } from "node:crypto";

import { hashReservationLookupToken } from "@/modules/reservations/domain/reservation-tracking";
import { ReservationError } from "@/modules/reservations/domain/reservation-errors";
import type { ReservationRepository } from "@/modules/reservations/ports/reservation-repository";
import { getReservationStatusProgress } from "@/shared/lib/activity-status";

type TrackReservationInput = {
  reservationNumber: string;
  reservationLookupToken: string;
};

export async function trackReservation(
  input: TrackReservationInput,
  { repository }: { repository: ReservationRepository },
) {
  const reservationNumber = input.reservationNumber.trim().toUpperCase();
  const reservationLookupToken = input.reservationLookupToken.trim();

  if (!reservationNumber || !reservationLookupToken) {
    throw new ReservationError(400, "BAD_REQUEST", "Invalid payload");
  }

  const reservation = await repository.findReservationTrackingByNumber(
    reservationNumber,
  );
  if (!reservation?.reservationLookupTokenHash) {
    throw new ReservationError(404, "NOT_FOUND", "Reservation not found");
  }

  const incomingHash = hashReservationLookupToken(reservationLookupToken);
  if (!safeCompareHex(incomingHash, reservation.reservationLookupTokenHash)) {
    throw new ReservationError(404, "NOT_FOUND", "Reservation not found");
  }

  return {
    data: {
      reservationNumber,
      status: reservation.status,
      statusLabel: getReservationStatusProgress(reservation.status).label,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      tableLabel: reservation.tableLabel,
      updatedAt: reservation.updatedAt,
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
