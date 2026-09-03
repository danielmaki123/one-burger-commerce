import type { ReservationRecord } from "@/modules/reservations/domain/reservation.types";
import type {
  CreateReservationInput,
  ListReservationsFilter,
  ReservationTrackingRecord,
  ReservationRepository,
  TableWithCapacity,
} from "@/modules/reservations/ports/reservation-repository";

type InMemoryReservationRecord = ReservationRecord & {
  reservationLookupTokenHash?: string | null;
};

function toPublicReservation(
  reservation: InMemoryReservationRecord,
): ReservationRecord {
  return {
    id: reservation.id,
    status: reservation.status,
    customerName: reservation.customerName,
    customerWhatsapp: reservation.customerWhatsapp,
    customerId: reservation.customerId,
    reservationNumber: reservation.reservationNumber,
    date: reservation.date,
    time: reservation.time,
    partySize: reservation.partySize,
    tableId: reservation.tableId,
    tableLabel: reservation.tableLabel,
    notes: reservation.notes,
    createdAt: reservation.createdAt,
    updatedAt: reservation.updatedAt,
  };
}

export class InMemoryReservationRepository implements ReservationRepository {
  tables: TableWithCapacity[] = [];
  reservations: InMemoryReservationRecord[] = [];

  async listTables(): Promise<TableWithCapacity[]> {
    return this.tables;
  }

  async findTableById(id: string): Promise<TableWithCapacity | null> {
    return this.tables.find((t) => t.id === id) ?? null;
  }

  async listReservations(
    filter: ListReservationsFilter,
  ): Promise<ReservationRecord[]> {
    return this.reservations
      .filter((r) => {
      if (filter.status && r.status !== filter.status) return false;
      if (filter.date && r.date !== filter.date) return false;
      return true;
      })
      .map(toPublicReservation);
  }

  async findReservationById(id: string): Promise<ReservationRecord | null> {
    const reservation = this.reservations.find((r) => r.id === id);
    return reservation ? toPublicReservation(reservation) : null;
  }

  async findReservationByNumber(
    reservationNumber: string,
  ): Promise<ReservationRecord | null> {
    const reservation = this.reservations.find(
      (r) => r.reservationNumber === reservationNumber,
    );
    return reservation ? toPublicReservation(reservation) : null;
  }

  async findReservationTrackingByNumber(
    reservationNumber: string,
  ): Promise<ReservationTrackingRecord | null> {
    const reservation = this.reservations.find(
      (r) => r.reservationNumber === reservationNumber,
    );
    if (
      !reservation?.reservationNumber ||
      !reservation.reservationLookupTokenHash
    ) {
      return null;
    }

    return {
      reservationNumber: reservation.reservationNumber,
      reservationLookupTokenHash: reservation.reservationLookupTokenHash,
      status: reservation.status,
      date: reservation.date,
      time: reservation.time,
      partySize: reservation.partySize,
      tableLabel: reservation.tableLabel,
      updatedAt: reservation.updatedAt,
    };
  }

  async findReservationsByTableAndDate(
    tableId: string,
    date: string,
  ): Promise<ReservationRecord[]> {
    return this.reservations.filter(
      (r) => r.tableId === tableId && r.date === date,
    );
  }

  async createReservation(
    input: CreateReservationInput,
  ): Promise<ReservationRecord> {
    const now = new Date().toISOString();
    const reservation: InMemoryReservationRecord = {
      id: `res_${this.reservations.length + 1}`,
      status: "requested",
      customerName: input.customerName,
      customerWhatsapp: input.customerWhatsapp,
      customerId: input.customerId ?? null,
      reservationNumber: input.reservationNumber ?? null,
      reservationLookupTokenHash: input.reservationLookupTokenHash ?? null,
      date: input.date,
      time: input.time,
      partySize: input.partySize,
      tableId: input.tableId,
      tableLabel: input.tableLabel,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.reservations.push(reservation);
    return toPublicReservation(reservation);
  }

  async updateReservationStatus(
    id: string,
    status: string,
  ): Promise<{ id: string; status: string; updatedAt: string }> {
    const reservation = this.reservations.find((r) => r.id === id);
    if (!reservation) throw new Error("Reservation not found");
    reservation.status = status as ReservationRecord["status"];
    reservation.updatedAt = new Date().toISOString();
    return { id, status, updatedAt: reservation.updatedAt };
  }
}
