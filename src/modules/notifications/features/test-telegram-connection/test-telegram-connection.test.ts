import { describe, expect, it, vi } from "vitest";

import { InMemoryNotificationSettingsRepository } from "@/modules/notifications/adapters/in-memory-notification-settings-repository";
import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";

import { testTelegramConnection } from "./test-telegram-connection";

/** El nombre del negocio sale de la configuración: en el test se dobla para no tocar la base. */
const businessName = async () => "One Burger";

/**
 * Parte 3 del brief (alertas Telegram) — «Probar conexión» manda un mensaje **real**.
 *
 * Lo que se fija acá: sale un mensaje de verdad por el gateway (sin simulación), el resultado se guarda
 * (cuándo salió bien o el motivo del fallo) y el motivo se traduce al español antes de salir.
 */

function fakeGateway(result: Awaited<ReturnType<TelegramGateway["sendMessage"]>> = { ok: true }) {
  return { sendMessage: vi.fn(async () => result) } satisfies TelegramGateway;
}

describe("testTelegramConnection", () => {
  it("manda un mensaje real y anota cuándo salió bien", async () => {
    const repository = new InMemoryNotificationSettingsRepository({ chatId: "-1001234567890" });
    const gateway = fakeGateway({ ok: true });

    const result = await testTelegramConnection({ repository, gateway, loadBusinessName: businessName });

    expect(result.data.status).toBe("conectado");
    expect(gateway.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ chatId: "-1001234567890" }),
    );
    expect((await repository.get()).lastSentAt).toBeTruthy();
    expect((await repository.get()).lastError).toBeNull();
  });

  it("sin chat no llama a Telegram", async () => {
    const repository = new InMemoryNotificationSettingsRepository();
    const gateway = fakeGateway();

    await expect(testTelegramConnection({ repository, gateway, loadBusinessName: businessName })).rejects.toMatchObject({
      status: 422,
    });
    expect(gateway.sendMessage).not.toHaveBeenCalled();
  });

  it("si falla, guarda el motivo y lo dice con el mensaje específico", async () => {
    const repository = new InMemoryNotificationSettingsRepository({ chatId: "-1001234567890" });
    const gateway = fakeGateway({ ok: false, reason: "bot-not-in-chat", detail: "Forbidden" });

    await expect(testTelegramConnection({ repository, gateway, loadBusinessName: businessName })).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("El bot no está en ese grupo"),
    });
    expect((await repository.get()).lastError).toContain("El bot no está en ese grupo");
    expect((await repository.get()).lastSentAt).toBeNull();
  });
});
