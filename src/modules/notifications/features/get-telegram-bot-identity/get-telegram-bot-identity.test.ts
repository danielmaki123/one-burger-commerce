import { describe, expect, it, vi } from "vitest";

import type { TelegramGateway } from "@/modules/notifications/ports/telegram-gateway";

import { getTelegramBotIdentity } from "./get-telegram-bot-identity";

/**
 * Decisión del owner (2026-09-17) — la identidad del bot que muestra la pantalla de alertas.
 *
 * Es una lectura **best-effort**: la pantalla tiene que abrirse igual si Telegram no contesta (o si el
 * servidor no tiene token). Lo que se fija: el `@usuario` cuando se puede preguntar y `null` —sin romper—
 * cuando falla.
 */

function gateway(identity: Awaited<ReturnType<TelegramGateway["getBotIdentity"]>> | Error) {
  return {
    sendMessage: vi.fn(),
    getBotIdentity: vi.fn(async () => {
      if (identity instanceof Error) throw identity;
      return identity;
    }),
  } as unknown as TelegramGateway;
}

describe("getTelegramBotIdentity", () => {
  it("devuelve el @usuario del bot configurado", async () => {
    const result = await getTelegramBotIdentity({ gateway: gateway({ username: "humbalertbot" }) });

    expect(result.data.username).toBe("humbalertbot");
  });

  it("sin token (o si Telegram contesta mal) devuelve null, no un error", async () => {
    expect((await getTelegramBotIdentity({ gateway: gateway({ username: null }) })).data.username).toBeNull();
  });

  it("si el gateway tira, la pantalla igual se abre", async () => {
    const result = await getTelegramBotIdentity({ gateway: gateway(new Error("sin red")) });

    expect(result.data.username).toBeNull();
  });
});
