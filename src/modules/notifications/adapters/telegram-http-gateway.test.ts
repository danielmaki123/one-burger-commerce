import { describe, expect, it, vi } from "vitest";

import { TelegramHttpGateway } from "./telegram-http-gateway";

/**
 * Parte 3 del brief (alertas Telegram) — la llamada real a la API de Telegram.
 *
 * El brief pide mensajes de error **específicos** ("chat_id inválido", "el bot no está en el grupo",
 * "token no configurado"): el owner tiene que poder arreglar lo que falla sin leer un log. Por eso el
 * gateway traduce cada respuesta de la API a un motivo del dominio y **nunca devuelve el token**.
 */

function gateway(token: string | undefined = "123:ABC") {
  return new TelegramHttpGateway({ botToken: token, timeoutMs: 50 });
}

function respondWith(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("TelegramHttpGateway", () => {
  it("manda el mensaje al chat indicado y devuelve ok", async () => {
    const fetchMock = respondWith(200, { ok: true, result: { message_id: 1 } });
    vi.stubGlobal("fetch", fetchMock);

    const result = await gateway().sendMessage({ chatId: "-1001234", text: "<b>hola</b>" });

    expect(result).toEqual({ ok: true });
    const [url, init] = (fetchMock as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: "-1001234", text: "<b>hola</b>" });
    vi.unstubAllGlobals();
  });

  it("sin token del bot no intenta nada y lo dice", async () => {
    const fetchMock = respondWith(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new TelegramHttpGateway({ botToken: undefined, timeoutMs: 50 }).sendMessage({
      chatId: "-1001234",
      text: "hola",
    });

    expect(result).toMatchObject({ ok: false, reason: "token-missing" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("un 400 es chat inválido, un 403 es que el bot no está en el grupo y un 401 el token", async () => {
    for (const [status, reason] of [
      [400, "chat-invalid"],
      [403, "bot-not-in-chat"],
      [401, "unauthorized"],
    ] as const) {
      vi.stubGlobal("fetch", respondWith(status, { ok: false, description: "nope" }));

      const result = await gateway().sendMessage({ chatId: "-1001234", text: "hola" });

      expect(result).toMatchObject({ ok: false, reason });
      vi.unstubAllGlobals();
    }
  });

  it("un corte de red se informa como tal", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("fetch failed");
      }),
    );

    const result = await gateway().sendMessage({ chatId: "-1001234", text: "hola" });

    expect(result).toMatchObject({ ok: false, reason: "network" });
    vi.unstubAllGlobals();
  });

  it("nunca devuelve el token en el detalle del error", async () => {
    vi.stubGlobal("fetch", respondWith(500, { ok: false, description: "boom 123:ABC" }));

    const result = await gateway().sendMessage({ chatId: "-1001234", text: "hola" });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("123:ABC");
    vi.unstubAllGlobals();
  });
});
