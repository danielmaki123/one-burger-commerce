import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";
import type { OutboxRepository } from "@/modules/notifications/ports/outbox-repository";

/**
 * Tareas 4 y 8 del brief (alertas Telegram) — los **disparadores**: cuándo un hecho del negocio merece un
 * aviso al grupo.
 *
 * Dos reglas que valen para los tres:
 *
 * 1. **El umbral se lee de la configuración** (`NotificationSettings`), no de una constante: el owner
 *    decidió C$500 para las devoluciones. El cierre de caja, en cambio, avisa **siempre** (decisión del
 *    owner 2026-09-17): cada turno que se cierra es un mensaje.
 * 2. Lo que no pasa el umbral **no se registra**: el outbox es la cola de lo que hay que mandar, no un
 *    archivo de todo lo que pasó (para eso están las tablas y el log de auditoría). Así el reintento de
 *    Telegram no trabaja con ruido.
 *
 * El que decide si además **se envía** es el sender, con los toggles: acá solo se registra el evento.
 */
export async function registerRefundAlert(
  input: { refundId: string; orderNumber: string; amount: number; reason: string | null },
  {
    settingsRepository,
    outboxRepository,
  }: {
    settingsRepository: NotificationSettingsRepository;
    outboxRepository: OutboxRepository;
  },
): Promise<{ registered: boolean }> {
  const settings = await settingsRepository.get();

  if (input.amount <= settings.refundAlertThreshold) return { registered: false };

  await outboxRepository.createEvent({
    eventType: "refund_over_threshold",
    aggregateType: "Refund",
    aggregateId: input.refundId,
    payload: {
      orderNumber: input.orderNumber,
      amount: input.amount,
      threshold: settings.refundAlertThreshold,
      reason: input.reason,
    },
  });

  return { registered: true };
}

/**
 * Decisión del owner (2026-09-17) — **el cierre de cada turno avisa siempre**: un mensaje por cierre, sin
 * hora fija ni umbral. Reemplaza al «resumen diario a las 22:00» (que nunca se disparó solo) y a la vieja
 * alerta de diferencia: la diferencia viene dentro de este mismo mensaje, así que un cierre con problema no
 * manda dos mensajes al grupo.
 *
 * No mira el umbral a propósito: cualquier diferencia se destaca, y el toggle del evento decide si el grupo
 * lo recibe. Lo que se registra siempre es el evento (la cola del outbox es del sistema, no del toggle).
 */
export async function registerShiftClosedAlert(
  input: {
    shiftId: string;
    locationName: string;
    openedAt: string;
    closedAt: string;
    closedByName: string | null;
    ordersCount: number;
    cash: number;
    card: number;
    transfer: number;
    total: number;
    tips: number;
    /** `null` = cierre ciego (nadie contó la caja): el mensaje lo dice con palabras. */
    difference: number | null;
    reason: string | null;
    /**
     * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco**: lo que declaró cada banco por
     * moneda (el lote de la terminal), lo que el sistema cobró sin pasar por el cajón y la diferencia,
     * en la moneda del negocio. Vacío = el turno se cerró sin declarar lotes y el mensaje no lo menciona.
     */
    bankDeclaredByCurrency?: Record<string, number>;
    bankChargedByCurrency?: Record<string, number>;
    bankDifferenceByCurrency?: Record<string, number>;
    bankDifference?: number | null;
  },
  { outboxRepository }: { outboxRepository: OutboxRepository },
): Promise<{ registered: boolean }> {
  await outboxRepository.createEvent({
    eventType: "shift_closed",
    aggregateType: "Shift",
    aggregateId: input.shiftId,
    payload: { ...input },
  });

  return { registered: true };
}

/**
 * El barrido de cajas abiertas hace más de un día. Se llama desde el proceso periódico del outbox (el que
 * ya corre cada `OUTBOX_PROCESSOR_SCHEDULE_MS`): no hay cron nuevo ni dependencia nueva.
 *
 * **Se registra una sola vez por turno**: el barrido corre cada 15 s y el mismo turno sigue abierto, así que
 * sin esta guarda la cola se llenaría con el mismo aviso (y Telegram mandaría un mensaje por tick). La
 * guarda mira los eventos ya registrados de este tipo —el `aggregateId` es el turno—, no una memoria del
 * proceso: sobrevive a un reinicio.
 */
export async function registerShiftOpenTooLongAlerts(
  shifts: readonly {
    shiftId: string;
    locationName: string;
    openedAt: string;
    hoursOpen: number;
  }[],
  {
    settingsRepository,
    outboxRepository,
  }: {
    settingsRepository: NotificationSettingsRepository;
    outboxRepository: OutboxRepository;
  },
): Promise<{ registered: number }> {
  const settings = await settingsRepository.get();
  if (!settings.chatId?.trim()) return { registered: 0 };

  const alreadyRegistered = new Set(
    (await outboxRepository.listEvents({ eventType: "shift_open_over_24h" })).map(
      (event) => event.aggregateId,
    ),
  );

  let registered = 0;

  for (const shift of shifts) {
    if (shift.hoursOpen <= 24) continue;
    if (alreadyRegistered.has(shift.shiftId)) continue;

    await outboxRepository.createEvent({
      eventType: "shift_open_over_24h",
      aggregateType: "Shift",
      aggregateId: shift.shiftId,
      payload: {
        locationName: shift.locationName,
        openedAt: shift.openedAt,
        hoursOpen: Math.floor(shift.hoursOpen),
      },
    });
    registered += 1;
  }

  return { registered };
}
