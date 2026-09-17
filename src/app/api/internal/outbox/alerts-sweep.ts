import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { PrismaNotificationSettingsRepository } from "@/modules/notifications/adapters/prisma-notification-settings-repository";
import { PrismaOutboxRepository } from "@/modules/notifications/adapters/prisma-outbox-repository";
import { registerShiftOpenTooLongAlerts } from "@/modules/notifications/features/register-alert-event/register-alert-event";
import { PrismaShiftRepository } from "@/modules/orders/adapters/prisma-shift-repository";

/**
 * Tarea 1.8 del brief (alerta de turno sin cerrar >24 h) — el barrido.
 *
 * Lo llama el proceso periódico del outbox que ya existe (cada `OUTBOX_PROCESSOR_SCHEDULE_MS`): no hay cron
 * nuevo. Mira las cajas abiertas de todas las sucursales, calcula cuántas horas llevan y deja el aviso
 * registrado — una sola vez por turno, que de eso se encarga el caso de uso.
 *
 * Es **best-effort** a propósito: si el barrido falla, el procesamiento del outbox sigue (los avisos no
 * pueden bloquear el resto de las notificaciones).
 */
export async function sweepStaleShiftAlerts({ now = new Date() }: { now?: Date } = {}) {
  const locations = await new PrismaLocationRepository().listLocations();
  const shiftRepository = new PrismaShiftRepository();
  const openShifts: {
    shiftId: string;
    locationName: string;
    openedAt: string;
    hoursOpen: number;
  }[] = [];

  for (const location of locations) {
    const shift = await shiftRepository.findOpenShiftByLocation(location.id);
    if (!shift) continue;

    openShifts.push({
      shiftId: shift.id,
      locationName: location.name,
      openedAt: shift.openedAt,
      hoursOpen: (now.getTime() - new Date(shift.openedAt).getTime()) / 3_600_000,
    });
  }

  return registerShiftOpenTooLongAlerts(openShifts, {
    settingsRepository: new PrismaNotificationSettingsRepository(),
    outboxRepository: new PrismaOutboxRepository(),
  });
}

/**
 * El barrido, sin poder romper el procesamiento del outbox: si falla, se avisa por el log y se sigue. Las
 * alertas son un recordatorio extra; no pueden ser la razón por la que un pedido no avisa a nadie.
 */
export async function sweepStaleShiftAlertsSafe(): Promise<void> {
  try {
    await sweepStaleShiftAlerts();
  } catch (error) {
    console.warn(
      "[alertas] no se pudo barrer los turnos abiertos:",
      error instanceof Error ? error.message : String(error),
    );
  }
}
