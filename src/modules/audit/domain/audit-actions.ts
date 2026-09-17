/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — las **acciones sensibles** que se auditan.
 *
 * Lista cerrada: un texto libre no se puede agrupar ni auditar después, y "cualquier cosa que toque
 * plata" no es una respuesta que sirva seis meses más tarde. Cada acción nueva se agrega acá con su
 * etiqueta en español, y el caso de uso rechaza lo que no esté en la lista.
 */
export const AUDIT_ACTIONS = [
  "shift.open",
  "shift.close",
  "shift.reopen",
  "shift.handover",
  "cash_movement.create",
  "refund.request",
  "refund.approve",
  "refund.reject",
  "order.cancel_paid",
  "settings.update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const ACTION_LABELS: Record<AuditAction, string> = {
  "shift.open": "Caja abierta",
  "shift.close": "Cierre de caja",
  "shift.reopen": "Caja reabierta",
  "shift.handover": "Traspaso de caja",
  "cash_movement.create": "Movimiento de caja",
  "refund.request": "Devolución pedida",
  "refund.approve": "Devolución aprobada",
  "refund.reject": "Devolución rechazada",
  "order.cancel_paid": "Pedido cobrado cancelado",
  "settings.update": "Configuración actualizada",
};

export function describeAction(action: AuditAction): string {
  return ACTION_LABELS[action];
}
