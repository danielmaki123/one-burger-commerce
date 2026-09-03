import { ReservationStatus } from "@/modules/reservations/domain/reservation.types";

// UI mapping must stay aligned with the persisted reservation status.
export const ADMIN_RESERVATION_STATUS_ORDER: ReservationStatus[] = [
  "requested",
  "approved",
  "rejected",
  "seated",
  "cancelled",
  "no_show",
];

export const ADMIN_RESERVATION_STATUS_META: Record<
  ReservationStatus,
  {
    label: string;
    variant:
      | "default"
      | "secondary"
      | "danger"
      | "outline"
      | "success"
      | "warning";
  }
> = {
  requested: { label: "Pendiente", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "danger" },
  seated: { label: "En mesa", variant: "outline" },
  cancelled: { label: "Cancelada", variant: "danger" },
  no_show: { label: "No asistió", variant: "danger" },
};

// Transiciones operativas permitidas desde el detalle (admin v2). La API
// acepta cualquier estado; esta tabla es la guía operativa de la UI.
export const ADMIN_RESERVATION_TRANSITIONS: Record<
  ReservationStatus,
  ReservationStatus[]
> = {
  requested: ["approved", "rejected"],
  approved: ["seated", "cancelled", "no_show"],
  seated: [],
  rejected: [],
  cancelled: [],
  no_show: [],
};

const MANAGUA_TZ = "America/Managua";

// La API devuelve `date` como "YYYY-MM-DD" (date-only) u ocasionalmente ISO
// completo. Formato admin: dd/mm/aaaa (R4), sin desfase de zona para date-only.
export function formatAdminReservationDate(date: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("es-NI", {
    timeZone: MANAGUA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

// La API devuelve `time` como "HH:MM" (24h, estándar del admin). Se muestra tal cual.
export function formatAdminReservationTime(time: string): string {
  return time;
}
