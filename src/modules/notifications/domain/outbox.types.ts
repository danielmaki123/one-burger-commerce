export type OutboxEventRecord = {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  status: "pending" | "processing" | "processed" | "failed";
  payload: unknown;
  attemptCount: number;
  errorMessage: string | null;
  lockedAt: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
