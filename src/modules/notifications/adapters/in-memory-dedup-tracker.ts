import type { OutboxDedupTracker } from "@/modules/notifications/ports/outbox-dedup";

export class InMemoryDedupTracker implements OutboxDedupTracker {
  private seen = new Map<string, number>();
  private readonly windowMs: number;

  constructor(windowMs = 5 * 60 * 1000) {
    this.windowMs = windowMs;
  }

  isDuplicate(key: string): boolean {
    this.gc();
    return this.seen.has(key);
  }

  track(key: string): void {
    this.gc();
    this.seen.set(key, Date.now());
  }

  private gc() {
    const cutoff = Date.now() - this.windowMs;
    for (const [k, ts] of this.seen.entries()) {
      if (ts < cutoff) {
        this.seen.delete(k);
      }
    }
  }
}
