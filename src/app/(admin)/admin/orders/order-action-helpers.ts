import { getAllowedNextStatuses } from "@/modules/orders/domain/order-workflows";
import type { OrderStatus, OrderType } from "@/modules/orders/domain/order.types";

/**
 * B2 — cómo se le cuenta a la persona lo que puede hacer con una comanda.
 *
 * Qué transiciones son válidas **no se decide acá**: sale de `order-workflows.ts`, la misma regla que
 * valida el servidor. Si se duplicara, la pantalla ofrecería botones que la API rechaza. Lo que sí
 * vive acá es el vocabulario de la cocina (la API habla en estados; la cocina en acciones) y los
 * mensajes de error.
 */

/** El nombre que ve la cocina para cada estado destino. */
const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  confirmed: "Aceptar",
  accepted: "Aceptar",
  preparing: "Preparando",
  ready: "Terminado",
  ready_for_pickup: "Terminado",
  out_for_delivery: "En camino",
  picked_up: "Entregada",
  delivered: "Entregada",
  served: "Servida",
  closed: "Cerrar",
};

export type OrderAction = { status: OrderStatus; label: string };

/**
 * La **única** acción primaria de la etapa, o `null` si el pedido ya terminó su recorrido.
 *
 * La cancelación se excluye a propósito: rechazar es destructivo y va separado y en color de peligro
 * (§4.2), nunca como el botón grande que invita a tocarlo por error.
 */
export function resolvePrimaryOrderAction(order: {
  type: OrderType;
  status: OrderStatus;
}): OrderAction | null {
  const next = getAllowedNextStatuses(order.type, order.status).find(
    (status) => status !== "cancelled",
  );

  if (!next) return null;

  return { status: next, label: ACTION_LABELS[next] ?? next };
}

/** Si el pedido todavía se puede rechazar, según el flujo del dominio. */
export function canRejectOrder(order: { type: OrderType; status: OrderStatus }): boolean {
  return getAllowedNextStatuses(order.type, order.status).includes("cancelled");
}

/** El motivo del rechazo es obligatorio y los espacios no son un motivo. */
export function isRejectNoteValid(note: string): boolean {
  return note.trim().length > 0;
}

/** Cuerpo del `PATCH /api/admin/orders/:id/status`: el motivo vacío viaja como `null`. */
export function buildStatusUpdateBody(
  status: OrderStatus,
  note?: string,
): { status: OrderStatus; note: string | null } {
  const trimmed = note?.trim();

  return { status, note: trimmed ? trimmed : null };
}

/**
 * Qué decir cuando el cambio de estado no pasó. Un 409 no es un error de la persona: alguien más ya
 * movió el pedido (o el poll lo trajo actualizado) y lo único honesto es decirlo y refrescar.
 */
export function describeOrderActionFailure(httpStatus: number): string {
  if (httpStatus === 0) {
    return "No hay conexión con el servidor. Revisá el wifi y probá de nuevo.";
  }
  if (httpStatus === 401) {
    return "Tu sesión venció. Volvé a entrar para seguir.";
  }
  if (httpStatus === 403) {
    return "Este pedido es de otra sucursal.";
  }
  if (httpStatus === 409) {
    return "El pedido ya cambió de estado. Actualizamos la lista para que veas dónde está.";
  }
  if (httpStatus === 422) {
    return "Falta el motivo del rechazo.";
  }

  return "No se pudo cambiar el estado del pedido. Probá de nuevo.";
}
