import type { ReservationRepository } from "@/modules/reservations/ports/reservation-repository";

export async function listAdminReservations(
  filter: { status?: string; date?: string },
  { repository }: { repository: ReservationRepository },
) {
  const reservations = await repository.listReservations(filter);
  return {
    data: reservations,
    meta: { count: reservations.length },
  };
}
