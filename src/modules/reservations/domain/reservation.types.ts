export type ReservationStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "seated"
  | "cancelled"
  | "no_show";

export type ReservationRecord = {
  id: string;
  status: ReservationStatus;
  customerName: string;
  customerWhatsapp: string;
  customerId?: string | null;
  reservationNumber?: string | null;
  date: string;
  time: string;
  partySize: number;
  tableId: string;
  tableLabel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
