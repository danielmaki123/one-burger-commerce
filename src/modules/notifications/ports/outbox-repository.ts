import type { OutboxEventRecord } from "@/modules/notifications/domain/outbox.types";

export type CreateOutboxEventInput = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload?: unknown;
};

export type ListOutboxFilter = {
  status?: string;
  eventType?: string;
};

export type LockPendingEventsFilter = {
  eventTypes?: string[];
  minCreatedAt?: string;
};

export interface OutboxRepository {
  createEvent(input: CreateOutboxEventInput): Promise<OutboxEventRecord>;

  listEvents(filter: ListOutboxFilter): Promise<OutboxEventRecord[]>;

  lockPendingEvents(
    limit: number,
    filter?: LockPendingEventsFilter,
  ): Promise<OutboxEventRecord[]>;

  markProcessed(id: string): Promise<void>;

  incrementAttempt(id: string, errorMessage: string): Promise<void>;

  markPermanentlyFailed(id: string, errorMessage: string): Promise<void>;
}
