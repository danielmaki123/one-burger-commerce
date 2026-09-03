import { describe, expect, it, vi } from "vitest";

import {
  N8nWebhookSender,
  type N8nWebhookSenderConfig,
} from "./n8n-webhook-sender";

function createSender(
  overrides?: Partial<N8nWebhookSenderConfig>,
): N8nWebhookSender {
  return new N8nWebhookSender({
    baseUrl: "https://n8n.example.com/webhook/outbox",
    secret: "n8n-secret-789",
    timeoutMs: 1000,
    ...overrides,
  });
}

describe("N8nWebhookSender", () => {
  it("sends payload with secret header", async () => {
    const sender = createSender();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    await sender.send({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
      payload: {
        event: "new_order",
        type: "DELIVERY",
        order_id: "D-TEST100",
        customer: {
          name: "TASK 100 QA",
          phone: "+50588888888",
          type: "DELIVERY",
          address: "One Burger staging 123",
        },
        ticket: {
          items: "RESUMEN:\nSubtotal: C$2194.95",
          total: "C$2579.45",
        },
      },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-N8N-Webhook-Secret": "n8n-secret-789",
      },
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_01",
      body: {
        order_id: "D-TEST100",
        customer: {
          name: "TASK 100 QA",
        },
        ticket: {
          items: "RESUMEN:\nSubtotal: C$2194.95",
          total: "C$2579.45",
        },
      },
    });
    fetchSpy.mockRestore();
  });

  it("duplicates object payload fields at the top level for n8n webhook compatibility", async () => {
    const sender = createSender();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    await sender.send({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_compat_01",
      payload: {
        event: "new_order",
        type: "DELIVERY",
        order_id: "D-COMPAT100",
        customer: {
          name: "TASK 100R QA",
          phone: "+50588888888",
          type: "DELIVERY",
          address: "One Burger staging 123",
        },
        ticket: {
          items: "Subtotal: C$1029.95",
          total: "C$1262.95",
          payment: "PENDIENTE",
        },
      },
    });

    const [, init] = fetchSpy.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_compat_01",
      order_id: "D-COMPAT100",
      customer: {
        name: "TASK 100R QA",
        phone: "+50588888888",
      },
      ticket: {
        items: "Subtotal: C$1029.95",
        total: "C$1262.95",
        payment: "PENDIENTE",
      },
      payload: {
        order_id: "D-COMPAT100",
      },
      body: {
        order_id: "D-COMPAT100",
      },
    });

    fetchSpy.mockRestore();
  });

  it("throws on HTTP error without leaking secret", async () => {
    const sender = createSender();
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "bad" }), { status: 500 }),
    );

    await expect(
      sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} }),
    ).rejects.toThrow("n8n webhook HTTP 500");

    fetchSpy.mockRestore();
  });

  it("sends payload without secret header when secret is omitted", async () => {
    const sender = createSender({ secret: undefined });
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    );

    await sender.send({
      eventType: "OrderCreated",
      aggregateType: "order",
      aggregateId: "ord_02",
      payload: { total: 100 },
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    expect((init as RequestInit).headers).not.toHaveProperty("X-N8N-Webhook-Secret");
    fetchSpy.mockRestore();
  });

  it("throws on timeout", async () => {
    const sender = createSender({ timeoutMs: 50 });
    const abortErr = new Error("The operation was aborted");
    abortErr.name = "AbortError";
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(abortErr);

    await expect(
      sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} }),
    ).rejects.toThrow("n8n webhook request timeout");

    fetchSpy.mockRestore();
  });

  it("does not include secret in thrown error message", async () => {
    const secret = "super-n8n-secret-abc";
    const sender = createSender({ secret });
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(
      new Error(`Network error with secret ${secret}`),
    );

    try {
      await sender.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).not.toContain(secret);
      expect(msg).toContain("[REDACTED]");
    }

    fetchSpy.mockRestore();
  });
});
