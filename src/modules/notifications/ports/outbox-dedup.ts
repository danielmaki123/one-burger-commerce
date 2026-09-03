export interface OutboxDedupTracker {
  isDuplicate(key: string): boolean;
  track(key: string): void;
}
