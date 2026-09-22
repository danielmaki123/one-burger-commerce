import { shiftCloseAudit } from "@/app/api/admin/audit-action-helpers";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { registerShiftClosedAlert } from "@/modules/notifications/features/register-alert-event/register-alert-event";
import { emptyShiftPaymentMix } from "@/modules/orders/domain/shift-payment-mix";
import type { ShiftBankCloseInput } from "@/modules/orders/domain/shift-bank-close";
import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { closePosShift } from "@/modules/pos/features/close-pos-shift/close-pos-shift";

/**
 * TASK-305b + Bloque 13.1 + decisión del owner (2026-09-17) — cerrar la caja, firmarla y avisar.
 *
 * Tres cosas que pasan juntas al cerrar: el arqueo (el caso de uso), la **firma** en el log de auditoría y
 * el **mensaje al grupo** del dueño. Desde la decisión del owner el aviso sale en **cada** cierre —un
 * mensaje por turno, sin hora fija ni umbral— con la sucursal, quién cerró y el desglose por medio de pago
 * que el cierre ya calculó (`paymentMix`): la diferencia va adentro de ese mismo mensaje, así que un cierre
 * con problema no manda dos mensajes.
 *
 * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco** viaja en el mismo mensaje (lo
 * declarado, lo cobrado sin pasar por el cajón y la diferencia) y, cuando el aviso ya quedó en la cola, se
 * firma en el turno (`differenceNotifiedAt`): es lo que permite saber si el número se avisó o quedó solo
 * en la base.
 *
 * Es **best-effort**: si el registro del aviso falla, el cierre ya quedó asentado y la respuesta no se cae
 * (la regla del brief: las alertas no bloquean la operación).
 *
 * Vive acá y no en el `route.ts` porque el handler está en su tope de 50 líneas.
 */
export async function closePosShiftForRoute(input: {
  locationId: string;
  counts: ShiftCashCountInput[];
  /** Fase 3 — el cuadre por banco declarado en el mostrador. */
  bankCloses?: ShiftBankCloseInput[];
  notes?: string | null;
  actorUserId: string;
  /** Nombre de quien cierra: el mensaje lo dice (una firma con un id no la lee nadie). */
  actorName?: string | null;
}) {
  const deps = await createProductionPosShiftDependencies({ locationId: input.locationId });
  const result = await closePosShift(
    {
      locationId: input.locationId,
      counts: input.counts,
      bankCloses: input.bankCloses,
      notes: input.notes,
    },
    // La config del conteo del local viaja a la validación (Fase 2 del rediseño de Caja): es la misma que
    // la pantalla usa para dibujar la grilla. Desde la Fase 3 el catálogo de bancos viaja igual.
    deps,
  );

  await shiftCloseAudit({
    actorUserId: input.actorUserId,
    locationId: input.locationId,
    shiftId: result.data?.id,
    counted: result.data?.closingAmount ?? null,
    expected: result.data?.expectedAmount ?? null,
    difference: result.data?.difference ?? null,
    // Fase 3 — la diferencia del cuadre por banco, en la moneda del negocio. Va junto al arqueo: es el
    // número que explica por qué el lote no cuadró.
    bankDifference: result.meta.bankDifferenceAmount ?? null,
  });

  if (result.data) {
    try {
      const closed = result.data;
      const mix = result.meta.paymentMix ?? emptyShiftPaymentMix();
      const locations = await createProductionPosLocationDependencies().repository.listLocations();
      const locationName =
        locations.find((location) => location.id === input.locationId)?.name ?? input.locationId;

      await registerShiftClosedAlert(
        {
          shiftId: closed.id,
          locationName,
          openedAt: closed.openedAt,
          closedAt: closed.closedAt ?? new Date().toISOString(),
          closedByName: input.actorName ?? null,
          ordersCount: mix.orders,
          cash: mix.cash,
          card: mix.card,
          transfer: mix.transfer,
          total: mix.total,
          tips: mix.tips,
          // `null` = cierre ciego (nadie contó): el mensaje lo dice, no lo convierte en «cuadra».
          difference: closed.difference,
          reason: closed.notes ?? null,
          // Fase 3 — el cuadre por banco, en el mismo mensaje: un cierre con problema no manda dos avisos.
          bankDeclaredByCurrency: result.meta.bankDeclaredByCurrency ?? {},
          bankChargedByCurrency: result.meta.bankChargedByCurrency ?? {},
          bankDifferenceByCurrency: result.meta.bankDifferenceByCurrency ?? {},
          bankDifference: result.meta.bankDifferenceAmount ?? null,
        },
        { outboxRepository: new PrismaOutboxRepository() },
      );

      // El aviso ya quedó en la cola: se firma cuándo. Si el registro de arriba falla, no se firma y el
      // turno queda diciendo que el número no se avisó (que es la verdad).
      await deps.shiftRepository.markDifferenceNotified(closed.id, new Date().toISOString());
    } catch (error) {
      console.warn(
        "[alertas] no se pudo registrar el aviso de cierre de caja:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return result;
}
