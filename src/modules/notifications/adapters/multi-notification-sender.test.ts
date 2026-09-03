import { describe, expect, it, vi } from "vitest";

import type { NotificationSender } from "@/modules/notifications/ports/notification-sender";

import { MultiNotificationSender } from "./multi-notification-sender";

function createMockSender(fail = false): NotificationSender {
  return {
    send: vi.fn().mockImplementation(async () => {
      if (fail) throw new Error("mock failure");
    }),
  };
}

describe("MultiNotificationSender", () => {
  it("routes to multiple channels", async () => {
    const a = createMockSender();
    const b = createMockSender();
    const multi = new MultiNotificationSender({
      senders: { a, b },
      router: () => ["a", "b"],
    });

    await multi.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} });

    expect(a.send).toHaveBeenCalledTimes(1);
    expect(b.send).toHaveBeenCalledTimes(1);
  });

  it("deduplicates channels within a single send", async () => {
    const a = createMockSender();
    const multi = new MultiNotificationSender({
      senders: { a },
      router: () => ["a", "a", "a"],
    });

    await multi.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} });

    expect(a.send).toHaveBeenCalledTimes(1);
  });

  it("throws aggregated error when a channel fails", async () => {
    const a = createMockSender();
    const b = createMockSender(true);
    const multi = new MultiNotificationSender({
      senders: { a, b },
      router: () => ["a", "b"],
    });

    await expect(
      multi.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} }),
    ).rejects.toThrow("Multi sender failures: b: mock failure");

    expect(a.send).toHaveBeenCalledTimes(1);
  });

  it("reports missing sender as error", async () => {
    const multi = new MultiNotificationSender({
      senders: {},
      router: () => ["missing"],
    });

    await expect(
      multi.send({ eventType: "Test", aggregateType: "test", aggregateId: "1", payload: {} }),
    ).rejects.toThrow("Multi sender failures: missing: missing sender");
  });
});
