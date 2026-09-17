import { describe, expect, it } from "vitest";

import { InMemoryNotificationSettingsRepository } from "@/modules/notifications/adapters/in-memory-notification-settings-repository";

import { getNotificationSettings } from "./get-notification-settings";

/**
 * Parte 3 del brief (alertas Telegram) — leer la configuración para la pantalla.
 *
 * El estado del **token** viaja aparte (`meta.tokenConfigured`) y no se mezcla con lo que el negocio
 * configuró: son dos cosas que arreglan personas distintas (el owner del SaaS pone la variable de
 * entorno; el dueño del negocio pone el chat).
 */
describe("getNotificationSettings", () => {
  it("devuelve la configuración con los defaults cuando nunca se tocó", async () => {
    const repository = new InMemoryNotificationSettingsRepository();

    const { data } = await getNotificationSettings({ repository }, { tokenConfigured: true });

    expect(data).toMatchObject({
      chatId: null,
      enabled: false,
      eventsEnabled: [],
      refundAlertThreshold: 500,
      differenceAlertThreshold: null,
      lastSentAt: null,
      lastError: null,
    });
  });

  it("informa si el servidor tiene el token del bot", async () => {
    const repository = new InMemoryNotificationSettingsRepository();

    const sinToken = await getNotificationSettings({ repository }, { tokenConfigured: false });
    const conToken = await getNotificationSettings({ repository }, { tokenConfigured: true });

    expect(sinToken.meta.tokenConfigured).toBe(false);
    expect(conToken.meta.tokenConfigured).toBe(true);
  });
});
