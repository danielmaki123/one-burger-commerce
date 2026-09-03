import { ReservationError } from "@/modules/reservations/domain/reservation-errors";
import type { ReservationRepository } from "@/modules/reservations/ports/reservation-repository";

export async function getAdminReservation(
  id: string,
  { repository }: { repository: ReservationRepository },
) {
  const reservation = await repository.findReservationById(id);
  if (!reservation) {
    throw new ReservationError(404, "NOT_FOUND", "Reservation not found");
  }

  return {
    data: reservation,
  };
}
