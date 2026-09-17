import { describe, expect, it } from "vitest";

import { InMemoryNotificationSettingsRepository } from "@/modules/notifications/adapters/in-memory-notification-settings-repository";
import { NotificationSettingsError } from "@/modules/notifications/domain/notification-settings-errors";

import { updateNotificationSettings } from "./update-notification-settings";

/**
 * Parte 3 del brief (alertas Telegram) — lo que el owner puede cambiar.
 *
 * Las tres validaciones se prueban porque cada una tapa un error distinto: un chat con forma inválida
 * (Telegram lo rechazaría recién al primer aviso), prender las alertas **sin destino** (el más silencioso:
 * quedaría «activado» y no llegaría nada) y un umbral negativo (que dispararía en todos los cierres).
 */
describe("updateNotificationSettings", () => {
  it("guarda el chat, los eventos elegidos y los umbrales", async () => {
    const repository = new InMemoryNotificationSettingsRepository();

    const { data } = await updateNotificationSettings(
      {
        chatId: "-1001234567890",
        enabled: true,
        eventsEnabled: ["refund_over_threshold", "inventado"],
        refundAlertThreshold: 800,
        differenceAlertThreshold: 100,
      },
      { repository },
    );

    expect(data).toMatchObject({
      chatId: "-1001234567890",
      enabled: true,
      eventsEnabled: ["refund_over_threshold"],
      refundAlertThreshold: 800,
      differenceAlertThreshold: 100,
    });
  });

  it("un chat_id con forma inválida no se guarda", async () => {
    const repository = new InMemoryNotificationSettingsRepository();

    await expect(
      updateNotificationSettings({ chatId: "mi grupo" }, { repository }),
    ).rejects.toBeInstanceOf(NotificationSettingsError);
    expect((await repository.get()).chatId).toBeNull();
  });

  it("no se pueden prender las alertas sin chat configurado", async () => {
    const repository = new InMemoryNotificationSettingsRepository();

    await expect(
      updateNotificationSettings({ enabled: true }, { repository }),
    ).rejects.toMatchObject({ status: 422 });
    expect((await repository.get()).enabled).toBe(false);
  });

  it("un umbral negativo se rechaza", async () => {
    const repository = new InMemoryNotificationSettingsRepository();

    await expect(
      updateNotificationSettings({ refundAlertThreshold: -1 }, { repository }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("borrar el umbral de diferencia apaga ese aviso sin tocar el resto", async () => {
    const repository = new InMemoryNotificationSettingsRepository({
      chatId: "-1001234567890",
      differenceAlertThreshold: 100,
    });

    const { data } = await updateNotificationSettings(
      { differenceAlertThreshold: null },
      { repository },
    );

    expect(data.differenceAlertThreshold).toBeNull();
    expect(data.chatId).toBe("-1001234567890");
  });
});
