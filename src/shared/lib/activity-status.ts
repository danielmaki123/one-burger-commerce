export type StatusTone = "warning" | "success" | "danger";

export type StatusProgressState = {
  label: string;
  stepIndex: number;
  isTerminalNegative: boolean;
  tone: StatusTone;
};

export const ORDER_PROGRESS_STEPS = [
  "Recibida",
  "Aceptada",
  "En preparación",
  "Lista",
  "Completada",
] as const;

export const RESERVATION_PROGRESS_STEPS = [
  "Solicitada",
  "Confirmada",
] as const;

export function getOrderStatusProgress(status: string): StatusProgressState {
  const normalized = status.toLowerCase();

  if (normalized === "cancelled") {
    return {
      label: "Cancelada",
      stepIndex: 0,
      isTerminalNegative: true,
      tone: "danger",
    };
  }

  if (normalized === "new") {
    return { label: "Recibida", stepIndex: 0, isTerminalNegative: false, tone: "warning" };
  }

  if (normalized === "confirmed" || normalized === "accepted") {
    return { label: "Aceptada", stepIndex: 1, isTerminalNegative: false, tone: "success" };
  }

  if (normalized === "preparing") {
    return { label: "En preparación", stepIndex: 2, isTerminalNegative: false, tone: "success" };
  }

  if (normalized === "ready" || normalized === "ready_for_pickup") {
    return { label: "Lista", stepIndex: 3, isTerminalNegative: false, tone: "success" };
  }

  if (normalized === "out_for_delivery") {
    return { label: "En camino", stepIndex: 3, isTerminalNegative: false, tone: "success" };
  }

  if (
    normalized === "delivered" ||
    normalized === "picked_up" ||
    normalized === "served" ||
    normalized === "closed"
  ) {
    return { label: "Completada", stepIndex: 4, isTerminalNegative: false, tone: "success" };
  }

  return { label: status, stepIndex: 0, isTerminalNegative: false, tone: "warning" };
}

export function getReservationStatusProgress(status: string): StatusProgressState {
  const normalized = status.toLowerCase();

  if (normalized === "requested") {
    return { label: "Solicitada", stepIndex: 0, isTerminalNegative: false, tone: "warning" };
  }

  if (normalized === "approved") {
    return { label: "Confirmada", stepIndex: 1, isTerminalNegative: false, tone: "success" };
  }

  if (normalized === "seated") {
    return { label: "Completada", stepIndex: 1, isTerminalNegative: false, tone: "success" };
  }

  if (normalized === "cancelled") {
    return { label: "Cancelada", stepIndex: 0, isTerminalNegative: true, tone: "danger" };
  }

  if (normalized === "rejected") {
    return { label: "Rechazada", stepIndex: 0, isTerminalNegative: true, tone: "danger" };
  }

  if (normalized === "no_show") {
    return { label: "No asistio", stepIndex: 0, isTerminalNegative: true, tone: "danger" };
  }

  return { label: status, stepIndex: 0, isTerminalNegative: false, tone: "warning" };
}
