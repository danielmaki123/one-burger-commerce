import { manualDiscountAudit } from "@/app/api/admin/audit-action-helpers";

/**
 * Tarea 9.7 del roadmap del POS (Fase 2) — el asiento del **descuento manual**.
 *
 * Vive acá y no en la ruta porque el `route.ts` tiene un tope de 50 líneas y esto es un detalle del
 * descuento, no de la composición. Dos reglas: sin descuento no hay nada que firmar, y un cobro **reusado**
 * (mismo intento) tampoco: la venta ya se asentó la primera vez.
 */
export async function auditManualDiscount(input: {
  actorUserId: string;
  orderId: string;
  reused: boolean;
  manualDiscount: { kind: string; value: number; reason: string } | null | undefined;
}): Promise<void> {
  if (!input.manualDiscount || input.reused) return;

  await manualDiscountAudit({
    actorUserId: input.actorUserId,
    orderId: input.orderId,
    kind: input.manualDiscount.kind,
    value: input.manualDiscount.value,
    reason: input.manualDiscount.reason,
  });
}
