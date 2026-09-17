import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";
import { isTelegramEvent, TELEGRAM_EVENT_LABELS } from "@/modules/notifications/domain/telegram-events";
import type { OutboxRepository } from "@/modules/notifications/ports/outbox-repository";

/**
 * Decisión del owner (2026-09-17) — el **historial de envíos** de la pantalla de alertas.
 *
 * El dueño necesita ver que las alertas están saliendo (y cuáles fallaron), no solo la hora del último
 * envío. Sale del **outbox**, que ya guarda cada evento con su estado: no hay tabla nueva ni memoria del
 * proceso, y lo que se muestra es lo que el sistema intentó mandar de verdad.
 *
 * Dos decisiones: solo los eventos de **alerta** (la lista cerrada de Telegram) y solo lo que ya se
 * intentó —`processed` o `failed`—, porque un evento pendiente todavía no es un envío. El nombre de la
 * sucursal sale del payload (el dueño lee «Camino de Oriente», no un id).
 */
export type TelegramAlertHistoryRow = {
  id: string;
  /** Etiqueta del evento en español («Cierre de caja»). */
  label: string;
  /** Sucursal del aviso, si el payload la trae. */
  locationName: string | null;
  /** Cuándo se intentó (el `processedAt` del outbox y, si falta, cuándo se creó). */
  at: string;
  ok: boolean;
  /** Motivo del fallo, tal como lo guardó el outbox. `null` cuando salió bien. */
  errorMessage: string | null;
};

const ALERT_EVENT_TYPES = ["shift_closed", "shift_open_over_24h", "refund_over_threshold"];

function locationOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;

  const value = (payload as { locationName?: unknown }).locationName;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function rowOf(event: OutboxEventRecord): TelegramAlertHistoryRow | null {
  if (!isTelegramEvent(event.eventType)) return null;

  return {
    id: event.id,
    label: TELEGRAM_EVENT_LABELS[event.eventType],
    locationName: locationOf(event.payload),
    at: event.processedAt ?? event.createdAt,
    ok: event.status === "processed",
    errorMessage: event.errorMessage,
  };
}

export async function listTelegramAlertHistory(
  input: { limit: number },
  { outboxRepository }: { outboxRepository: OutboxRepository },
) {
  const events = await outboxRepository.listRecentEvents({
    eventTypes: ALERT_EVENT_TYPES,
    // Se piden unos cuantos más: los pendientes se descartan abajo y no tienen que dejar la lista corta.
    limit: Math.max(1, input.limit) * 2,
  });

  return {
    data: events
      .filter((event) => event.status === "processed" || event.status === "failed")
      .map(rowOf)
      .filter((row): row is TelegramAlertHistoryRow => row !== null)
      .slice(0, Math.max(0, input.limit)),
  };
}
