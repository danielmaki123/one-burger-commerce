import { describe, expect, it, vi } from "vitest";

import {
  TelegramNotificationSender,
  type TelegramNotificationSenderConfig,
} from "./telegram-notification-sender";

function createSender(
  overrides?: Partial<TelegramNotificationSenderConfig>,
): TelegramNotificationSender {
  return new TelegramNotificationSender({
    botToken: "secret-bot-token-123",
    chatId: "chat-456",
    enabled: true,
    timeoutMs: 1000,
    ...overrides,
  });
}

describe("TelegramNotificationSender", () => {
  it("does nothing when disabled", async () => {
    const sender = createSender({ enabled: false });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response());
    await sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("sends message successfully", async () => {
    const sender = createSender();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await sender.send({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
      payload: { total: 100 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toContain("secret-bot-token-123");
    expect(call[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({
      chat_id: "chat-456",
    });
    fetchSpy.mockRestore();
  });

  it("formats order-created messages with totals breakdown when payload is recognized", async () => {
    const sender = createSender();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await sender.send({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
      payload: {
        event: "new_order",
        order_id: "D-TEST100",
        internal_id: "ord_01",
        customer: {
          name: "TASK 100 QA",
          phone: "+50588888888",
          type: "DELIVERY",
          address: "One Burger staging 123",
        },
        ticket: {
          items: [
            "2 x Prime Rib Steak [Término medio, Papas de la casa]",
            "Empaque: C$35.00 x 2 = C$70.00",
            "",
            "RESUMEN:",
            "Subtotal: C$2194.95",
            "Empaque: C$105.00",
            "Envío: C$60.00",
            "Propina 10%: C$219.50",
          ].join("\n"),
          total: "C$2579.45",
        },
      },
    });

    const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body));
    expect(body.text).toContain("RESUMEN:");
    expect(body.text).toContain("Empaque: C$105.00");
    expect(body.text).toContain("Propina 10%: C$219.50");
    expect(body.text).toContain("TOTAL: C$2579.45");
    fetchSpy.mockRestore();
  });

  it("throws on HTTP error without leaking token", async () => {
    const sender = createSender();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad" }), { status: 400 }),
    );

    await expect(
      sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} }),
    ).rejects.toThrow("Telegram HTTP 400");

    fetchSpy.mockRestore();
  });

  it("throws on timeout", async () => {
    const sender = createSender({ timeoutMs: 50 });
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(abortErr);

    await expect(
      sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} }),
    ).rejects.toThrow("Telegram request timeout");

    fetchSpy.mockRestore();
  });

  it("does not include bot token in thrown error message", async () => {
    const token = "super-secret-xyz";
    const sender = createSender({ botToken: token });
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(
      new Error(`Network error with token ${token}`),
    );

    try {
      await sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toContain(token);
      expect(msg).toContain("[REDACTED]");
    }

    fetchSpy.mockRestore();
  });
});
