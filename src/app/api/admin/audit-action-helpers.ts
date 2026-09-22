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

/**
 * Cerrar la caja: lo que quedó asentado (contado, esperado y diferencia) y, desde la Fase 3 del rediseño
 * de Caja, la diferencia del **cuadre por banco** (lo declarado contra lo cobrado sin pasar por el cajón).
 */
export function shiftCloseAudit(input: {
  actorUserId: string;
  locationId: string;
  shiftId?: string;
  counted: number | null;
  expected: number | null;
  difference: number | null;
  bankDifference?: number | null;
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
      ...(input.bankDifference !== undefined ? { bankDifference: input.bankDifference } : {}),
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

/** Traspasar la caja a otro cajero: quién la recibe y con cuánto se la entrega (tarea 7, 1.13). */
export function shiftHandoverAudit(input: {
  actorUserId: string;
  handoverId: string;
  shiftId: string;
  locationId: string;
  handedByName: string | null;
  receivedByName: string;
  expectedAmount: number;
}) {
  return recordAdminAudit({
    action: "shift.handover",
    actorUserId: input.actorUserId,
    targetType: "Shift",
    targetId: input.shiftId,
    detail: {
      handoverId: input.handoverId,
      locationId: input.locationId,
      handedByName: input.handedByName,
      receivedByName: input.receivedByName,
      expectedAmount: input.expectedAmount,
    },
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

/**
 * Cambiar la personalización del negocio: el detalle está en el propio registro del cambio.
 */
export function settingsUpdateAudit(input: { actorUserId: string }) {
  return recordAdminAudit({
    action: "settings.update",
    actorUserId: input.actorUserId,
    targetType: "BusinessSettings",
    targetId: "business-settings",
  });
}

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — **cambiar la configuración de caja de una sucursal**.
 *
 * Se firma la sucursal y **qué** quedó configurado (monedas y arqueo ciego): es la regla con la que se
 * calcula el esperado de los turnos siguientes, así que seis meses después esto explica por qué esa caja
 * contaba en dólares o por qué el cajero veía la diferencia. Los billetes no van en el detalle porque son
 * del negocio y no de la sucursal (cambian para las tres a la vez).
 */
export function cashConfigUpdateAudit(input: {
  actorUserId: string;
  locationId: string;
  usdEnabled: boolean;
  blindCount: boolean;
}) {
  return recordAdminAudit({
    action: "cash_config.update",
    actorUserId: input.actorUserId,
    targetType: "LocationCashConfig",
    targetId: input.locationId,
    detail: { usdEnabled: input.usdEnabled, blindCount: input.blindCount },
  });
}

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — un descuento manual en el mostrador.
 *
 * Se firma con la **forma** (porcentaje o monto), el valor que se pidió y el **motivo** que escribió quien
 * lo autorizó: es lo único que seis meses después explica por qué esa venta entró con menos plata.
 */
export function manualDiscountAudit(input: {
  actorUserId: string;
  orderId: string;
  kind: string;
  value: number;
  reason: string;
}) {
  return recordAdminAudit({
    action: "order.manual_discount",
    actorUserId: input.actorUserId,
    targetType: "Order",
    targetId: input.orderId,
    detail: { kind: input.kind, value: input.value, reason: input.reason },
  });
}

/**
 * Punto 2 del roadmap (2026-09-18) — anular una factura emitida.
 *
 * El asiento guarda el **motivo** de la lista cerrada y, cuando el motivo es «Otro», el texto que
 * escribió quien anuló: la factura marca *que* está anulada, y esto explica *por qué*. El documento en
 * sí no se borra nunca (`voidedAt` / `voidedByUserId` / `voidReason`).
 */
export function invoiceVoidAudit(input: {
  actorUserId: string;
  invoiceId: string;
  reason: string;
  note?: string | null;
}) {
  const note = input.note?.trim();

  return recordAdminAudit({
    action: "invoice.void",
    actorUserId: input.actorUserId,
    targetType: "Invoice",
    targetId: input.invoiceId,
    detail: { reason: input.reason, ...(note ? { note } : {}) },
  });
}
