import { publish } from "@/infrastructure/events/event-bus";
import { AuthError } from "@/modules/auth/domain/auth-errors";
import { canApproveReservations } from "@/modules/auth/domain/admin-permissions";
import type { AdminRole } from "@/modules/auth/domain/admin-role";
import type { ReservationStatus } from "@/modules/reservations/domain/reservation.types";
import type { ReservationRecord } from "@/modules/reservations/domain/reservation.types";
import { ReservationError } from "@/modules/reservations/domain/reservation-errors";
import { isValidStatusTransition } from "@/modules/reservations/domain/reservation-workflows";
import type { ReservationRepository } from "@/modules/reservations/ports/reservation-repository";

export async function updateReservationStatus(
  id: string,
  input: { status: ReservationStatus; reason?: string | null },
  context: {
    repository: ReservationRepository;
    admin: { role: AdminRole };
  },
) {
  if (!canApproveReservations(context.admin.role)) {
    throw new AuthError(
      403,
      "FORBIDDEN",
      "Insufficient permissions to update reservation status",
    );
  }

  const reservation = await context.repository.findReservationById(id);
  if (!reservation) {
    throw new ReservationError(404, "NOT_FOUND", "Reservation not found");
  }

  if (
    !isValidStatusTransition(
      reservation.status,
      input.status as ReservationRecord["status"],
    )
  ) {
    throw new ReservationError(
      409,
      "CONFLICT",
      `Invalid status transition from ${reservation.status} to ${input.status}`,
    );
  }

  const updated = await context.repository.updateReservationStatus(
    id,
    input.status,
  );

  if (input.status === "approved") {
    await publish("ReservationApproved", { reservationId: id });
  }

  return {
    data: updated,
    meta: { reason: input.reason ?? undefined },
  };
}
