import type { NotificationSettingsRepository } from "@/modules/notifications/ports/notification-settings-repository";
import type { OutboxRepository } from "@/modules/notifications/ports/outbox-repository";

/**
 * Tareas 4 y 8 del brief (alertas Telegram) — los **disparadores**: cuándo un hecho del negocio merece un
 * aviso al grupo.
 *
 * Dos reglas que valen para los tres:
 *
 * 1. **El umbral se lee de la configuración** (`NotificationSettings`), no de una constante: el owner
 *    decidió C$500 para las devoluciones y «sin umbral = no avisar» para las diferencias de caja.
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

export async function registerDifferenceAlert(
  input: {
    shiftId: string;
    locationName: string;
    closedAt: string;
    counted: number;
    expected: number;
    difference: number;
  },
  {
    settingsRepository,
    outboxRepository,
  }: {
    settingsRepository: NotificationSettingsRepository;
    outboxRepository: OutboxRepository;
  },
): Promise<{ registered: boolean }> {
  const settings = await settingsRepository.get();
  const threshold = settings.differenceAlertThreshold;

  // Sin umbral el owner dijo «no me avises»; y una caja que cuadra no es una diferencia.
  if (threshold === null || input.difference === 0) return { registered: false };
  if (Math.abs(input.difference) <= threshold) return { registered: false };

  await outboxRepository.createEvent({
    eventType: "cash_difference_over_threshold",
    aggregateType: "Shift",
    aggregateId: input.shiftId,
    payload: {
      locationName: input.locationName,
      closedAt: input.closedAt,
      counted: input.counted,
      expected: input.expected,
      difference: input.difference,
      threshold,
    },
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
