import { describe, expect, it, vi } from "vitest";

import { InMemoryNotificationSettingsRepository } from "@/modules/notifications/adapters/in-memory-notification-settings-repository";
import { buildTelegramAlertText } from "@/modules/notifications/domain/telegram-alerts";
import type { TelegramSendResult } from "@/modules/notifications/domain/telegram-result";
import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";

import { TelegramAlertSender } from "./telegram-alert-sender";

/**
 * Parte 3 del brief (alertas Telegram) — el que decide si un evento del sistema se reenvía al grupo.
 *
 * Tres comportamientos se prueban acá, y son el corazón del brief:
 * los eventos **desactivados se registran pero no se mandan**; un envío que falla **tira error** (para que
 * el outbox lo reintente y quede anotado el motivo); y un evento que no es una alerta se ignora sin fallar
 * (lo maneja otro sender).
 */

function setup(settings: Parameters<typeof InMemoryNotificationSettingsRepository.prototype.save>[0] = {}) {
  const repository = new InMemoryNotificationSettingsRepository({
    chatId: "-1001234567890",
    enabled: true,
    eventsEnabled: ["refund_over_threshold"],
    ...settings,
  });
  const gateway = {
    sendMessage: vi.fn(
      async (_input: { chatId: string; text: string }): Promise<TelegramSendResult> => ({ ok: true }),
    ),
  };
  const sender = new TelegramAlertSender({
    settingsRepository: repository,
    gateway: gateway as unknown as TelegramGateway,
    format: async () => ({
      businessName: "One Burger",
      currencySymbol: "C$",
      timezone: "America/Managua",
      locale: "es-NI",
    }),
  });

  return { repository, gateway, sender };
}

const refundNotification = {
  eventType: "refund_over_threshold",
  aggregateType: "Refund",
  aggregateId: "ref_01",
  payload: { orderNumber: "P-1042", amount: 750, threshold: 500, reason: "Faltó una bebida" },
};

describe("TelegramAlertSender", () => {
  it("manda la alerta activada y anota el envío", async () => {
    const { gateway, repository, sender } = setup();

    await sender.send(refundNotification);

    expect(gateway.sendMessage).toHaveBeenCalledTimes(1);
    const text = gateway.sendMessage.mock.calls[0][0].text as unknown as string;
    expect(text).toContain("P-1042");
    expect((await repository.get()).lastSentAt).toBeTruthy();
  });

  it("un evento que el owner no eligió se registra pero no se manda", async () => {
    const { gateway, sender } = setup({ eventsEnabled: [] });

    await sender.send(refundNotification);

    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("con las alertas apagadas no manda nada", async () => {
    const { gateway, sender } = setup({ enabled: false });

    await sender.send(refundNotification);

    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("si Telegram falla, tira error (para que el outbox reintente) y guarda el motivo", async () => {
    const { gateway, repository, sender } = setup();
    gateway.sendMessage.mockResolvedValueOnce({ ok: false, reason: "chat-invalid", detail: "chat not found" });

    await expect(sender.send(refundNotification)).rejects.toThrow(/chat_id no existe/);
    expect((await repository.get()).lastError).toContain("chat_id no existe");
  });

  it("un evento que no es una alerta se ignora sin fallar", async () => {
    const { gateway, sender } = setup();

    await sender.send({ eventType: "OrderCreated", aggregateType: "Order", aggregateId: "o1", payload: {} });

    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("un payload con forma inesperada no manda un mensaje con `undefined`", async () => {
    const { gateway, sender } = setup();

    await sender.send({ ...refundNotification, payload: { orderNumber: "P-1" } });

    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });
});

describe("buildTelegramAlertText", () => {
  const options = { businessName: "One Burger", currencySymbol: "C$", timezone: "America/Managua", locale: "es-NI" };

  it("arma el texto de cada evento y devuelve null si el payload no da", () => {
    expect(
      buildTelegramAlertText(
        "shift_open_over_24h",
        { locationName: "Principal", openedAt: "2026-09-17T04:00:00.000Z", hoursOpen: 27 },
        options,
      ),
    ).toContain("Caja sin cerrar");
    // Un payload al que le faltan campos (evento viejo o escrito a mano) no arma un mensaje con `undefined`.
    expect(buildTelegramAlertText("shift_closed", { locationName: "Principal" }, options)).toBeNull();
    expect(
      buildTelegramAlertText(
        "shift_closed",
        {
          locationName: "Principal",
          openedAt: "2026-09-17T13:00:00.000Z",
          closedAt: "2026-09-17T21:00:00.000Z",
          closedByName: "María Pérez",
          ordersCount: 3,
          cash: 500,
          card: 250,
          transfer: 0,
          total: 750,
          tips: 0,
          difference: 0,
        },
        options,
      ),
    ).toContain("Cierre de caja — Principal");
    expect(buildTelegramAlertText("refund_over_threshold", null, options)).toBeNull();
  });
});
