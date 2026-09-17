import { PrismaAuditLogRepository } from "@/modules/audit/adapters/prisma-audit-log-repository";
import type { AuditAction } from "@/modules/audit/domain/audit-actions";
import { recordAuditAction } from "@/modules/audit/features/record-audit-action/record-audit-action";

/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — el cableado del log a las acciones sensibles.
 *
 * El módulo de auditoría sabe **guardar**; acá se arma **qué** se guarda. Las rutas de caja, cobros y
 * pedidos son todas iguales en esto: sesión → permiso → acción, y después un asiento con **quién** la
 * hizo y el detalle que la explica. Tenerlo en un solo lugar evita que una ruta nueva se olvide de
 * firmar —y que dos rutas escriban el mismo detalle distinto— y mantiene cada `route.ts` dentro de su
 * tope de líneas: cada llamada es una línea.
 *
 * `shift.close` apunta al turno, pero un cierre que no devolvió turno (la caja ya estaba cerrada) cae a
 * la sucursal: el asiento igual dice que alguien intentó cerrar. El detalle no se inventa: cada atajo
 * arma el suyo y el que no tiene nada que explicar no manda `detail`.
 */
export async function recordAdminAudit(input: {
  action: AuditAction;
  actorUserId: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await recordAuditAction(
    {
      action: input.action,
      actorUserId: input.actorUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.detail ? { detail: input.detail } : {}),
    },
    { auditLogRepository: new PrismaAuditLogRepository() },
  );
}

/** Abrir la caja: con qué fondo y en qué sucursal. */
export function shiftOpenAudit(input: {
  actorUserId: string;
  shiftId: string;
  locationId: string;
  openingAmount: number | null;
}) {
  return recordAdminAudit({
    action: "shift.open",
    actorUserId: input.actorUserId,
    targetType: "Shift",
    targetId: input.shiftId,
    detail: { locationId: input.locationId, openingAmount: input.openingAmount },
  });
}

/** Cerrar la caja: lo que quedó asentado (contado, esperado y diferencia). */
export function shiftCloseAudit(input: {
  actorUserId: string;
  locationId: string;
  shiftId?: string;
  counted: number | null;
  expected: number | null;
  difference: number | null;
}) {
  return recordAdminAudit({
    action: "shift.close",
    actorUserId: input.actorUserId,
    targetType: "Shift",
    targetId: input.shiftId ?? input.locationId,
    detail: {
      locationId: input.locationId,
      counted: input.counted,
      expected: input.expected,
      difference: input.difference,
    },
  });
}

/** Reabrir una caja cerrada: quién la reabrió y con qué motivo (es lo que explica un arqueo rehecho). */
export function shiftReopenAudit(input: { actorUserId: string; shiftId: string; reason: string }) {
  return recordAdminAudit({
    action: "shift.reopen",
    actorUserId: input.actorUserId,
    targetType: "Shift",
    targetId: input.shiftId,
    detail: { reason: input.reason },
  });
}

/** Mover plata de la caja: tipo, monto, moneda y a qué turno pertenece. */
export function cashMovementAudit(input: {
  actorUserId: string;
  movementId: string;
  shiftId: string;
  kind: string;
  amount: number;
  currency: string;
}) {
  return recordAdminAudit({
    action: "cash_movement.create",
    actorUserId: input.actorUserId,
    targetType: "CashMovement",
    targetId: input.movementId,
    detail: {
      shiftId: input.shiftId,
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
    },
  });
}

/** Pedir una devolución: sobre qué pedido, por cuánto y si quedó pendiente o ya aprobada. */
export function refundRequestAudit(input: {
  actorUserId: string;
  refundId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
}) {
  return recordAdminAudit({
    action: "refund.request",
    actorUserId: input.actorUserId,
    targetType: "Refund",
    targetId: input.refundId,
    detail: {
      orderId: input.orderId,
      amount: input.amount,
      currency: input.currency,
      status: input.status,
    },
  });
}

/** Resolver una devolución: aprobada y rechazada son acciones distintas a propósito (se auditan aparte). */
export function refundReviewAudit(input: {
  actorUserId: string;
  refundId: string;
  decision: "approved" | "rejected";
  note?: string | null;
}) {
  return recordAdminAudit({
    action: input.decision === "approved" ? "refund.approve" : "refund.reject",
    actorUserId: input.actorUserId,
    targetType: "Refund",
    targetId: input.refundId,
    ...(input.note?.trim() ? { detail: { note: input.note.trim() } } : {}),
  });
}

/** Cancelar un pedido ya cobrado: cuántas devoluciones quedaron pendientes de devolver. */
export function paidOrderCancelledAudit(input: {
  actorUserId: string;
  orderId: string;
  refundsRequested: number;
}) {
  return recordAdminAudit({
    action: "order.cancel_paid",
    actorUserId: input.actorUserId,
    targetType: "Order",
    targetId: input.orderId,
    detail: { refundsRequested: input.refundsRequested },
  });
}

/** Cambiar la personalización del negocio: el detalle está en el propio registro del cambio. */
export function settingsUpdateAudit(input: { actorUserId: string }) {
  return recordAdminAudit({
    action: "settings.update",
    actorUserId: input.actorUserId,
    targetType: "BusinessSettings",
    targetId: "business-settings",
  });
}
