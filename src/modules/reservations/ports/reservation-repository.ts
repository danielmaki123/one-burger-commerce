import type { ReservationRecord } from "@/modules/reservations/domain/reservation.types";

export type TableWithCapacity = {
  id: string;
  label: string;
  capacity: number;
  isActive: boolean;
  locationId?: string;
};

export type CreateReservationInput = {
  customerName: string;
  customerWhatsapp: string;
  customerId?: string | null;
  reservationNumber?: string | null;
  reservationLookupTokenHash?: string | null;
  date: string;
  time: string;
  partySize: number;
  tableId: string;
  tableLabel: string;
  notes?: string | null;
};

export type ListReservationsFilter = {
  status?: string;
  date?: string;
};

export type ReservationTrackingRecord = {
  reservationNumber: string;
  reservationLookupTokenHash: string;
  status: string;
  date: string;
  time: string;
  partySize: number;
  tableLabel: string;
  updatedAt: string;
};

export interface ReservationRepository {
  listTables(): Promise<TableWithCapacity[]>;
  findTableById(id: string): Promise<TableWithCapacity | null>;

  listReservations(filter: ListReservationsFilter): Promise<ReservationRecord[]>;
  findReservationById(id: string): Promise<ReservationRecord | null>;
  findReservationByNumber(
    reservationNumber: string,
  ): Promise<ReservationRecord | null>;
  findReservationTrackingByNumber(
    reservationNumber: string,
  ): Promise<ReservationTrackingRecord | null>;
  findReservationsByTableAndDate(
    tableId: string,
    date: string,
  ): Promise<ReservationRecord[]>;

  createReservation(input: CreateReservationInput): Promise<ReservationRecord>;
  updateReservationStatus(
    id: string,
    status: string,
  ): Promise<{ id: string; status: string; updatedAt: string }>;
}
