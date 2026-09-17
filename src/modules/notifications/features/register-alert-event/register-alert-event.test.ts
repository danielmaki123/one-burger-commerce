import { describe, expect, it, vi } from "vitest";

import { InMemoryNotificationSettingsRepository } from "@/modules/notifications/adapters/in-memory-notification-settings-repository";
import type { OutboxRepository } from "@/modules/notifications/ports/outbox-repository";

import {
  registerShiftClosedAlert,
  registerRefundAlert,
  registerShiftOpenTooLongAlerts,
} from "./register-alert-event";

/**
 * Tareas 4 y 8 del brief (alertas Telegram) — los **disparadores**.
 *
 * Regla que fija este archivo: el evento se registra en el sistema **siempre** (es el outbox, la fuente de
 * verdad de «qué pasó»), pero el umbral decide si vale la pena avisar. Lo que no se registra es el evento
 * por debajo del umbral: sin eso, un día con veinte devoluciones chicas llenaría la cola de ruido y el
 * reintento de Telegram trabajaría de más.
 */

const outbox = () => ({
  createEvent: vi.fn(async (input: unknown) => ({ id: "evt_1", ...(input as object) })),
  listEvents: vi.fn(async () => [] as { aggregateId: string }[]),
});

function settings(values: Partial<Parameters<typeof InMemoryNotificationSettingsRepository.prototype.save>[0]>) {
  return new InMemoryNotificationSettingsRepository({
    chatId: "-1001234567890",
    enabled: true,
    eventsEnabled: ["refund_over_threshold", "shift_closed", "shift_open_over_24h"],
    ...values,
  });
}

describe("registerRefundAlert", () => {
  it("una devolución por encima del umbral se registra con lo que el aviso necesita", async () => {
    const repository = outbox() as unknown as OutboxRepository;

    const result = await registerRefundAlert(
      { refundId: "ref_01", orderNumber: "P-1042", amount: 750, reason: "Faltó una bebida" },
      { settingsRepository: settings({}), outboxRepository: repository },
    );

    expect(result).toEqual({ registered: true });
    expect(repository.createEvent).toHaveBeenCalledWith({
      eventType: "refund_over_threshold",
      aggregateType: "Refund",
      aggregateId: "ref_01",
      payload: {
        orderNumber: "P-1042",
        amount: 750,
        threshold: 500,
        reason: "Faltó una bebida",
      },
    });
  });

  it("una devolución chica no se registra (el umbral es del owner)", async () => {
    const repository = outbox() as unknown as OutboxRepository;

    const result = await registerRefundAlert(
      { refundId: "ref_02", orderNumber: "P-1043", amount: 200, reason: null },
      { settingsRepository: settings({ refundAlertThreshold: 500 }), outboxRepository: repository },
    );

    expect(result).toEqual({ registered: false });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("el umbral configurado manda: 600 avisa si el owner bajó el umbral a 500 y no si lo subió a 700", async () => {
    const repository = outbox() as unknown as OutboxRepository;
    const input = { refundId: "ref_03", orderNumber: "P-1044", amount: 600, reason: null };

    expect(
      await registerRefundAlert(input, {
        settingsRepository: settings({ refundAlertThreshold: 500 }),
        outboxRepository: repository,
      }),
    ).toEqual({ registered: true });
    expect(
      await registerRefundAlert(input, {
        settingsRepository: settings({ refundAlertThreshold: 700 }),
        outboxRepository: repository,
      }),
    ).toEqual({ registered: false });
  });
});

describe("registerShiftClosedAlert", () => {
  const cierre = {
    shiftId: "shift_01",
    locationName: "Camino de Oriente",
    openedAt: "2026-09-18T14:00:00.000Z",
    closedAt: "2026-09-19T02:30:00.000Z",
    closedByName: "María Pérez",
    ordersCount: 12,
    cash: 4000,
    card: 1500,
    transfer: 500,
    total: 6000,
    tips: 120,
    difference: -100,
    reason: "Faltó vuelto",
  };

  it("registra el cierre con todo lo que el mensaje necesita", async () => {
    const repository = outbox() as unknown as OutboxRepository;

    const result = await registerShiftClosedAlert(cierre, { outboxRepository: repository });

    expect(result).toEqual({ registered: true });
    expect(repository.createEvent).toHaveBeenCalledWith({
      eventType: "shift_closed",
      aggregateType: "Shift",
      aggregateId: "shift_01",
      payload: cierre,
    });
  });

  it("una caja que cuadra también avisa: es un mensaje por cierre, no por problema", async () => {
    const repository = outbox() as unknown as OutboxRepository;

    const result = await registerShiftClosedAlert(
      { ...cierre, difference: 0, reason: null },
      { outboxRepository: repository },
    );

    expect(result).toEqual({ registered: true });
    expect(repository.createEvent).toHaveBeenCalledTimes(1);
  });
});
describe("registerShiftOpenTooLongAlerts", () => {
  it("registra las cajas abiertas hace más de 24 h, una por turno", async () => {
    const repository = outbox() as unknown as OutboxRepository;

    const result = await registerShiftOpenTooLongAlerts(
      [
        { shiftId: "shift_viejo", locationName: "Principal", openedAt: "2026-09-16T04:00:00.000Z", hoursOpen: 30 },
        { shiftId: "shift_nuevo", locationName: "Principal", openedAt: "2026-09-17T12:00:00.000Z", hoursOpen: 4 },
      ],
      { settingsRepository: settings({}), outboxRepository: repository },
    );

    expect(result).toEqual({ registered: 1 });
    expect(repository.createEvent).toHaveBeenCalledTimes(1);
    expect(repository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "shift_open_over_24h",
        aggregateId: "shift_viejo",
      }),
    );
  });

  it("el mismo turno no se registra dos veces (el barrido corre cada 15 s)", async () => {
    const repository = outbox();
    repository.listEvents.mockResolvedValue([{ aggregateId: "shift_viejo" }]);

    const result = await registerShiftOpenTooLongAlerts(
      [
        { shiftId: "shift_viejo", locationName: "Principal", openedAt: "2026-09-16T04:00:00.000Z", hoursOpen: 30 },
      ],
      {
        settingsRepository: settings({}),
        outboxRepository: repository as unknown as OutboxRepository,
      },
    );

    expect(result).toEqual({ registered: 0 });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("sin grupo configurado no se registra nada (no hay a dónde avisar)", async () => {
    const repository = outbox();

    const result = await registerShiftOpenTooLongAlerts(
      [
        { shiftId: "shift_viejo", locationName: "Principal", openedAt: "2026-09-16T04:00:00.000Z", hoursOpen: 30 },
      ],
      {
        settingsRepository: settings({ chatId: null }),
        outboxRepository: repository as unknown as OutboxRepository,
      },
    );

    expect(result).toEqual({ registered: 0 });
    expect(repository.createEvent).not.toHaveBeenCalled();
  });
});
