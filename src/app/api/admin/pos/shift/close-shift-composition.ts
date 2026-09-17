import { shiftCloseAudit } from "@/app/api/admin/audit-action-helpers";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { registerDifferenceAlert } from "@/modules/notifications/features/register-alert-event/register-alert-event";
import type { ShiftCashCountInput } from "@/modules/orders/domain/shift-cash";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { createProductionPosShiftDependencies } from "@/modules/pos/adapters/production-pos-shift";
import { closePosShift } from "@/modules/pos/features/close-pos-shift/close-pos-shift";

/**
 * TASK-305b + Bloque 13.1 + tarea 4 del brief (alertas Telegram) — cerrar la caja, firmarla y avisar.
 *
 * Tres cosas que pasan juntas al cerrar: el arqueo (el caso de uso), la **firma** en el log de auditoría y
 * el **aviso al dueño** si la diferencia supera el umbral que él configuró. La última solo se registra
 * cuando hay diferencia: sin eso, cada cierre sano llenaría la cola de avisos.
 *
 * Vive acá y no en el `route.ts` porque el handler está en su tope de 50 líneas.
 */
export async function closePosShiftForRoute(input: {
  locationId: string;
  counts: ShiftCashCountInput[];
  notes?: string | null;
  actorUserId: string;
}) {
  const result = await closePosShift(
    { locationId: input.locationId, counts: input.counts, notes: input.notes },
    await createProductionPosShiftDependencies(),
  );

  await shiftCloseAudit({
    actorUserId: input.actorUserId,
    locationId: input.locationId,
    shiftId: result.data?.id,
    counted: result.data?.closingAmount ?? null,
    expected: result.data?.expectedAmount ?? null,
    difference: result.data?.difference ?? null,
  });

  // El aviso necesita el **nombre** de la sucursal (el dueño lee el mensaje, no el id) y solo se busca
  // cuando hay una diferencia que contar. Es **best-effort**: si el registro del aviso falla, el cierre ya
  // quedó asentado y la respuesta no se cae (la regla del brief: las alertas no bloquean la operación).
  if (result.data && result.data.difference !== null && result.data.difference !== 0) {
    try {
      const locations = await createProductionPosLocationDependencies().repository.listLocations();
      const locationName =
        locations.find((location) => location.id === input.locationId)?.name ?? input.locationId;

      await registerDifferenceAlert(
        {
          shiftId: result.data.id,
          locationName,
          closedAt: result.data.closedAt ?? new Date().toISOString(),
          counted: result.data.closingAmount ?? 0,
          expected: result.data.expectedAmount ?? 0,
          difference: result.data.difference,
        },
        {
          settingsRepository: new PrismaNotificationSettingsRepository(),
          outboxRepository: new PrismaOutboxRepository(),
        },
      );
    } catch (error) {
      console.warn(
        "[alertas] no se pudo registrar el aviso de diferencia de caja:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return result;
}
